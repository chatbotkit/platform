// @ts-check

/**
 * Utility functions to convert ChatBotKit blueprint resources to Terraform HCL format
 */

/**
 * Escapes Terraform template sequences so the text is taken literally
 *
 * Both quoted strings and heredocs are template bodies in HCL: a bare `${`
 * opens an interpolation and `%{` a directive. Doubling the sigil (`$${`,
 * `%%{`) is the documented way to emit them literally.
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
function escapeTemplateSequences(str) {
  // @note function replacers: `$$` in a replacement string is itself an
  // escape for a single `$`, which would silently undo the doubling
  return str.replace(/\$\{/g, () => '$${').replace(/%\{/g, () => '%%{')
}

/**
 * Escapes a string for use inside a quoted Terraform HCL string
 *
 * Quotes and backslashes take a backslash escape; `${` and `%{` are doubled so
 * they are not read as template sequences. A raw newline is not valid inside a
 * quoted string - use `formatString` which switches to a heredoc for those.
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
function escapeHCL(str) {
  if (!str) {
    return ''
  }

  return escapeTemplateSequences(
    str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  )
}

/**
 * Picks a heredoc delimiter that does not occur in the content
 * @param {string} str - The heredoc body
 * @returns {string} The delimiter
 */
function heredocDelimiter(str) {
  let delimiter = 'EOT'

  for (let index = 1; str.includes(delimiter); index++) {
    delimiter = `EOT${index}`
  }

  return delimiter
}

/**
 * Formats a string as an HCL attribute value: a quoted string, or a HEREDOC
 * when the value contains a newline (a raw newline is not valid in a quoted
 * string)
 *
 * Heredoc bodies are templates too, so `${` and `%{` are escaped the same way
 * as in quoted strings. The delimiter is chosen so it never appears in the
 * body, which would otherwise end the heredoc early.
 * @param {string} str - The string to format
 * @param {string} indent - Indentation to use
 * @returns {string} The formatted HEREDOC
 */
function formatString(str, indent = '  ') {
  if (!str || !str.includes('\n')) {
    return `"${escapeHCL(str || '')}"`
  }

  const delimiter = heredocDelimiter(str)

  const lines = escapeTemplateSequences(str).split('\n')

  return `<<-${delimiter}\n${lines
    .map((line) => `${indent}${line}`)
    .join('\n')}\n${indent}${delimiter}`
}

/**
 * Converts a blueprint resource ID to a Terraform-friendly identifier
 * @param {string} id - The blueprint resource ID (e.g., '#bot:::abc123')
 * @returns {string} The sanitized identifier (e.g., 'bot_abc123')
 */
function sanitizeResourceId(id) {
  if (!id) {
    return 'resource'
  }

  // Remove # prefix and extract type and id parts
  const cleaned = id.replace(/^#/, '')
  const parts = cleaned.split(':::')

  if (parts.length === 2) {
    const [type, idPart] = parts

    return `${type}_${idPart}`
  }

  return cleaned.replace(/[^a-zA-Z0-9_]/g, '_')
}

/**
 * Blueprint resource types that have a matching Terraform provider resource.
 * The key is the blueprint type, the value is the provider resource name.
 *
 * @note keep in sync with the resources exposed by the public Terraform
 * provider
 */
const PROVIDER_RESOURCES = {
  dataset: 'chatbotkit_dataset',
  file: 'chatbotkit_file',
  secret: 'chatbotkit_secret',
  space: 'chatbotkit_space',
  skillset: 'chatbotkit_skillset',
  ability: 'chatbotkit_skillset_ability',
  bot: 'chatbotkit_bot',
  triggerIntegration: 'chatbotkit_trigger_integration',
}

/**
 * Renders a Terraform variable block
 * @param {string} name - The variable name
 * @param {string} description - The variable description
 * @param {Object} [options]
 * @param {boolean} [options.sensitive] - Whether the variable is sensitive
 * @param {string} [options.comment] - A comment to put above the block
 * @returns {string} The Terraform HCL code
 */
function formatVariable(name, description, { sensitive, comment } = {}) {
  const lines = []

  if (comment) {
    lines.push(`# ${comment}`)
  }

  lines.push(`variable "${name}" {`)
  lines.push(`  description = ${formatString(description)}`)
  lines.push(`  type        = string`)

  if (sensitive) {
    lines.push(`  sensitive   = true`)
  }

  lines.push('}')

  return lines.join('\n')
}

/**
 * Resolves resource references in data values
 *
 * A reference to a blueprint-local resource becomes `chatbotkit_<type>.<id>.id`
 * when the provider offers that resource type. When it does not, the reference
 * becomes a `var.<id>` placeholder and a matching `variable` block is added to
 * `variables` so the generated HCL stays valid.
 *
 * @param {any} value - The value to check for references
 * @param {Object} resourceMap - Map of resource IDs to Terraform identifiers
 * @param {string[]} [variables] - Collector for generated variable blocks
 * @returns {any} The resolved value
 */
function resolveReference(value, resourceMap, variables = []) {
  if (typeof value === 'string' && value.startsWith('#')) {
    const terraformId = sanitizeResourceId(value)
    const resourceParts = value.replace(/^#/, '').split(':::')

    if (resourceParts.length === 2 && resourceMap[value]) {
      const [type] = resourceParts

      if (PROVIDER_RESOURCES[type]) {
        return `${PROVIDER_RESOURCES[type]}.${terraformId}.id`
      }

      const variableName = `${terraformId}_id`

      if (!variables.some((block) => block.includes(`"${variableName}"`))) {
        variables.push(
          formatVariable(
            variableName,
            `ID of the ${type} resource ${value} (no Terraform resource for this type)`,
            {
              comment: `The provider has no resource for blueprint type "${type}"; supply the ID of ${value} manually.`,
            }
          )
        )
      }

      return `var.${variableName}`
    }
  }

  return value
}

/**
 * Formats a resolved reference as an HCL attribute value
 * @param {string} resolved - The value returned by `resolveReference`
 * @returns {string} The HCL expression
 */
function formatReference(resolved) {
  return resolved.startsWith('chatbotkit_') || resolved.startsWith('var.')
    ? resolved
    : formatString(resolved)
}

/**
 * Converts a bot resource to Terraform HCL
 * @param {string} resourceId - The Terraform resource identifier
 * @param {Object} data - The bot data
 * @param {Object} resourceMap - Map of resource IDs to Terraform identifiers
 * @returns {string} The Terraform HCL code
 */
function convertBot(resourceId, data, resourceMap) {
  const lines = [`resource "chatbotkit_bot" "${resourceId}" {`]

  if (data.name) {
    lines.push(`  name        = ${formatString(data.name)}`)
  }

  if (data.description) {
    lines.push(`  description = ${formatString(data.description)}`)
  }

  if (data.backstory) {
    lines.push(`  backstory   = ${formatString(data.backstory)}`)
  }

  if (data.model) {
    lines.push(`  model       = ${formatString(data.model)}`)
  }

  if (data.datasetId) {
    const resolved = resolveReference(data.datasetId, resourceMap)

    lines.push(`  dataset_id  = ${formatReference(resolved)}`)
  }

  if (data.skillsetId) {
    const resolved = resolveReference(data.skillsetId, resourceMap)

    lines.push(`  skillset_id = ${formatReference(resolved)}`)
  }

  if (data.visibility) {
    lines.push(`  visibility  = ${formatString(data.visibility)}`)
  }

  if (typeof data.privacy === 'boolean') {
    lines.push(`  privacy     = ${data.privacy}`)
  }

  if (typeof data.moderation === 'boolean') {
    lines.push(`  moderation  = ${data.moderation}`)
  }

  lines.push('}')

  return lines.join('\n')
}

/**
 * Converts a dataset resource to Terraform HCL
 * @param {string} resourceId - The Terraform resource identifier
 * @param {Object} data - The dataset data
 * @param {Object} resourceMap - Map of resource IDs to Terraform identifiers
 * @returns {string} The Terraform HCL code
 */
function convertDataset(resourceId, data, resourceMap) {
  const lines = [`resource "chatbotkit_dataset" "${resourceId}" {`]

  if (data.name) {
    lines.push(`  name        = ${formatString(data.name)}`)
  }

  if (data.description) {
    lines.push(`  description = ${formatString(data.description)}`)
  }

  if (data.visibility) {
    lines.push(`  visibility  = ${formatString(data.visibility)}`)
  }

  lines.push('}')

  return lines.join('\n')
}

/**
 * Converts a secret resource to Terraform HCL
 *
 * The secret value is never inlined: it is referenced as a sensitive
 * `var.<id>_value` variable which is added to `variables`.
 *
 * @param {string} resourceId - The Terraform resource identifier
 * @param {Object} data - The secret data
 * @param {Object} resourceMap - Map of resource IDs to Terraform identifiers
 * @param {string[]} variables - Collector for generated variable blocks
 * @returns {string} The Terraform HCL code
 */
function convertSecret(resourceId, data, resourceMap, variables) {
  const lines = [`resource "chatbotkit_secret" "${resourceId}" {`]

  if (data.name) {
    lines.push(`  name        = ${formatString(data.name)}`)
  }

  if (data.description) {
    lines.push(`  description = ${formatString(data.description)}`)
  }

  if (data.type) {
    lines.push(`  type        = ${formatString(data.type)}`)
  }

  if (data.kind) {
    lines.push(`  kind        = ${formatString(data.kind)}`)
  }

  if (data.visibility) {
    lines.push(`  visibility  = ${formatString(data.visibility)}`)
  }

  // @note the value is a credential: it is stripped from blueprint exports and
  // must never land in the HCL, so it is always sourced from a sensitive var
  const variableName = `${resourceId}_value`

  variables.push(
    formatVariable(
      variableName,
      `Value of the secret${data.name ? ` "${data.name}"` : ''}`,
      { sensitive: true }
    )
  )

  lines.push(`  value       = var.${variableName}`)

  lines.push('}')

  return lines.join('\n')
}

/**
 * Converts a space resource to Terraform HCL
 * @param {string} resourceId - The Terraform resource identifier
 * @param {Object} data - The space data
 * @param {Object} resourceMap - Map of resource IDs to Terraform identifiers
 * @returns {string} The Terraform HCL code
 */
function convertSpace(resourceId, data, resourceMap) {
  const lines = [`resource "chatbotkit_space" "${resourceId}" {`]

  if (data.name) {
    lines.push(`  name        = ${formatString(data.name)}`)
  }

  if (data.description) {
    lines.push(`  description = ${formatString(data.description)}`)
  }

  lines.push('}')

  return lines.join('\n')
}

/**
 * Converts a skillset resource to Terraform HCL
 * @param {string} resourceId - The Terraform resource identifier
 * @param {Object} data - The skillset data
 * @param {Object} resourceMap - Map of resource IDs to Terraform identifiers
 * @returns {string} The Terraform HCL code
 */
function convertSkillset(resourceId, data, resourceMap) {
  const lines = [`resource "chatbotkit_skillset" "${resourceId}" {`]

  if (data.name) {
    lines.push(`  name        = ${formatString(data.name)}`)
  }

  if (data.description) {
    lines.push(`  description = ${formatString(data.description)}`)
  }

  if (data.visibility) {
    lines.push(`  visibility  = ${formatString(data.visibility)}`)
  }

  lines.push('}')

  return lines.join('\n')
}

/**
 * Converts an ability resource to Terraform HCL
 * @param {string} resourceId - The Terraform resource identifier
 * @param {Object} data - The ability data
 * @param {Object} resourceMap - Map of resource IDs to Terraform identifiers
 * @param {string[]} variables - Collector for generated variable blocks
 * @returns {string} The Terraform HCL code
 */
function convertAbility(resourceId, data, resourceMap, variables) {
  const lines = [`resource "chatbotkit_skillset_ability" "${resourceId}" {`]

  if (data.skillsetId) {
    const resolved = resolveReference(data.skillsetId, resourceMap)

    lines.push(`  skillset_id = ${formatReference(resolved)}`)
  }

  if (data.name) {
    lines.push(`  name        = ${formatString(data.name)}`)
  }

  if (data.description) {
    lines.push(`  description = ${formatString(data.description)}`)
  }

  if (data.instruction) {
    lines.push(`  instruction = ${formatString(data.instruction)}`)
  }

  const links = [
    ['secret_id', data.linkedSecretId],
    ['file_id', data.linkedFileId],
    ['bot_id', data.linkedBotId],
    ['space_id', data.linkedSpaceId],
  ]

  for (const [attribute, link] of links) {
    if (!link) {
      continue
    }

    const resolved = resolveReference(link, resourceMap, variables)

    lines.push(`  ${attribute.padEnd(11)} = ${formatReference(resolved)}`)
  }

  lines.push('}')

  return lines.join('\n')
}

/**
 * Converts a file resource to Terraform HCL
 * @param {string} resourceId - The Terraform resource identifier
 * @param {Object} data - The file data
 * @param {Object} resourceMap - Map of resource IDs to Terraform identifiers
 * @returns {string} The Terraform HCL code
 */
function convertFile(resourceId, data, resourceMap) {
  const lines = [`resource "chatbotkit_file" "${resourceId}" {`]

  if (data.name) {
    lines.push(`  name        = ${formatString(data.name)}`)
  }

  if (data.description) {
    lines.push(`  description = ${formatString(data.description)}`)
  }

  if (data.type) {
    lines.push(`  type        = ${formatString(data.type)}`)
  }

  if (data.visibility) {
    lines.push(`  visibility  = ${formatString(data.visibility)}`)
  }

  lines.push('}')

  return lines.join('\n')
}

/**
 * Converts a trigger integration resource to Terraform HCL
 * @param {string} resourceId - The Terraform resource identifier
 * @param {Object} data - The integration data
 * @param {Object} resourceMap - Map of resource IDs to Terraform identifiers
 * @returns {string} The Terraform HCL code
 */
function convertTriggerIntegration(resourceId, data, resourceMap) {
  const lines = [`resource "chatbotkit_trigger_integration" "${resourceId}" {`]

  if (data.botId) {
    const resolved = resolveReference(data.botId, resourceMap)

    lines.push(`  bot_id      = ${formatReference(resolved)}`)
  }

  if (data.name) {
    lines.push(`  name        = ${formatString(data.name)}`)
  }

  if (data.description) {
    lines.push(`  description = ${formatString(data.description)}`)
  }

  if (data.schedule) {
    lines.push(`  schedule    = ${formatString(data.schedule)}`)
  }

  lines.push('}')

  return lines.join('\n')
}

/**
 * Converts blueprint resources to Terraform HCL code
 * @param {Object} blueprint - The blueprint object containing resources
 * @returns {string} The complete Terraform HCL code
 */
export function blueprintToTerraform(blueprint) {
  if (!blueprint || !blueprint.resources) {
    return ''
  }

  const resources = blueprint.resources
  const resourceMap = {}

  // First pass: build resource map
  Object.entries(resources).forEach(([id, resource]) => {
    if (resource.type) {
      resourceMap[id] = sanitizeResourceId(id)
    }
  })

  const terraformBlocks = []

  // Add provider configuration
  terraformBlocks.push(`terraform {
  required_providers {
    chatbotkit = {
      source = "chatbotkit/chatbotkit"
    }
  }
}

provider "chatbotkit" {
  # api_key = "..." # Or set CHATBOTKIT_API_KEY env var
}`)

  // Convert each resource type in order
  // @note types with links (ability, bot, triggerIntegration) come after the
  // types they can point at so a reader meets the declaration first
  const resourceOrder = [
    'dataset',
    'file',
    'secret',
    'space',
    'skillset',
    'ability',
    'bot',
    'triggerIntegration',
  ]

  /** @type {string[]} */
  const variables = []

  resourceOrder.forEach((type) => {
    const typeResources = Object.entries(resources).filter(
      ([, resource]) => resource.type === type
    )

    if (typeResources.length > 0) {
      terraformBlocks.push('')
      terraformBlocks.push(
        `# ============================================================================`
      )
      terraformBlocks.push(
        `# ${type.charAt(0).toUpperCase() + type.slice(1)} Resources`
      )
      terraformBlocks.push(
        `# ============================================================================`
      )

      typeResources.forEach(([id, resource]) => {
        const resourceId = sanitizeResourceId(id)
        let hcl = ''

        switch (type) {
          case 'bot':
            hcl = convertBot(resourceId, resource.data || {}, resourceMap)

            break
          case 'dataset':
            hcl = convertDataset(resourceId, resource.data || {}, resourceMap)

            break
          case 'skillset':
            hcl = convertSkillset(resourceId, resource.data || {}, resourceMap)

            break
          case 'ability':
            hcl = convertAbility(
              resourceId,
              resource.data || {},
              resourceMap,
              variables
            )

            break
          case 'secret':
            hcl = convertSecret(
              resourceId,
              resource.data || {},
              resourceMap,
              variables
            )

            break
          case 'space':
            hcl = convertSpace(resourceId, resource.data || {}, resourceMap)

            break
          case 'file':
            hcl = convertFile(resourceId, resource.data || {}, resourceMap)

            break
          case 'triggerIntegration':
            hcl = convertTriggerIntegration(
              resourceId,
              resource.data || {},
              resourceMap
            )

            break
          default:
            // Skip unknown types
            return
        }

        if (hcl) {
          terraformBlocks.push('')
          terraformBlocks.push(hcl)
        }
      })
    }
  })

  if (variables.length > 0) {
    terraformBlocks.push('')
    terraformBlocks.push(
      `# ============================================================================`
    )
    terraformBlocks.push(`# Variables`)
    terraformBlocks.push(
      `# ============================================================================`
    )

    variables.forEach((block) => {
      terraformBlocks.push('')
      terraformBlocks.push(block)
    })
  }

  return terraformBlocks.join('\n')
}
