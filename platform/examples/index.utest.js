import abilities from '@/data/abilities/all'

import { getReferenceFieldType } from '@/lib/blueprint.fields'
import { parseTemplateInstruction } from '@/lib/instruction.template.parse'

import { buildTemplate } from '@/app/apps/(adhoc)/c0de9a7f/factory-template'
import examples from '@/examples'

import yaml from 'js-yaml'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Extracts the template name from an instruction string.
 * Handles both YAML format (template: name) and simple format (@name).
 */
function extractTemplateName(instruction) {
  if (!instruction || typeof instruction !== 'string') {
    return null
  }

  const parsed = parseTemplateInstruction(instruction)

  return parsed.template || null
}

/**
 * Checks if a value is an internal resource reference (e.g., '#bot:::id123')
 */
function isInternalResourceRef(value) {
  return typeof value === 'string' && value.startsWith('#')
}

/**
 * Get all blueprints from examples that have a blueprint property
 */
function getBlueprintExamples() {
  return examples.filter(
    (example) => 'blueprint' in example && example.blueprint
  )
}

describe('examples', () => {
  it('blueprints must not reference secrets with oauth credentials', () => {
    for (const example of examples) {
      if (!('blueprint' in example)) {
        continue
      }

      const blueprint = example.blueprint
      const resources = blueprint.resources

      for (const resource of Object.values(resources)) {
        if (resource.type !== 'secret') {
          continue
        }

        if (resource.data.type !== 'oauth') {
          continue
        }

        const config = resource.data.config || {}

        expect(config.clientId).toBeFalsy()
        expect(config.clientSecret).toBeFalsy()
      }
    }
  })
})

describe('blueprints', () => {
  const blueprintExamples = getBlueprintExamples()

  describe('resource linkage', () => {
    it('ability skillsetId references must exist within blueprint', () => {
      for (const example of blueprintExamples) {
        const { blueprint } = example
        const resources = blueprint.resources
        const resourceIds = Object.keys(resources)

        for (const [, resource] of Object.entries(resources)) {
          if (resource.type !== 'ability') {
            continue
          }

          const skillsetId = resource.data?.skillsetId

          if (skillsetId && isInternalResourceRef(skillsetId)) {
            expect(resourceIds).toContain(skillsetId)
          }
        }
      }
    })

    it('ability linkedSecretId references must exist within blueprint', () => {
      for (const example of blueprintExamples) {
        const { blueprint } = example
        const resources = blueprint.resources
        const resourceIds = Object.keys(resources)

        for (const [, resource] of Object.entries(resources)) {
          if (resource.type !== 'ability') {
            continue
          }

          const secretId = resource.data?.linkedSecretId

          if (secretId && isInternalResourceRef(secretId)) {
            expect(resourceIds).toContain(secretId)
          }
        }
      }
    })

    it('ability linkedSpaceId references must exist within blueprint', () => {
      const brokenReferences = []

      for (const example of blueprintExamples) {
        const { blueprint, slug } = example
        const resources = blueprint.resources
        const resourceIds = Object.keys(resources)

        for (const [resourceId, resource] of Object.entries(resources)) {
          if (resource.type !== 'ability') {
            continue
          }

          const spaceId = resource.data?.linkedSpaceId

          if (spaceId && isInternalResourceRef(spaceId)) {
            if (!resourceIds.includes(spaceId)) {
              brokenReferences.push({
                slug,
                resourceId,
                spaceId,
                abilityName: resource.data?.name || 'unnamed',
              })
            }
          }
        }
      }

      if (brokenReferences.length > 0) {
        const errorMsg = brokenReferences
          .map(
            ({ slug, resourceId, spaceId, abilityName }) =>
              `Blueprint "${slug}" ability "${resourceId}" (${abilityName}) references non-existent space "${spaceId}"`
          )
          .join('\n')

        throw new Error(
          `${brokenReferences.length} broken space references found:\n${errorMsg}`
        )
      }
    })

    it('bot skillsetId references must exist within blueprint', () => {
      for (const example of blueprintExamples) {
        const { blueprint } = example
        const resources = blueprint.resources
        const resourceIds = Object.keys(resources)

        for (const [, resource] of Object.entries(resources)) {
          if (resource.type !== 'bot') {
            continue
          }

          const skillsetId = resource.data?.skillsetId

          if (skillsetId && isInternalResourceRef(skillsetId)) {
            expect(resourceIds).toContain(skillsetId)
          }
        }
      }
    })

    it('bot datasetId references must exist within blueprint', () => {
      for (const example of blueprintExamples) {
        const { blueprint } = example
        const resources = blueprint.resources
        const resourceIds = Object.keys(resources)

        for (const [, resource] of Object.entries(resources)) {
          if (resource.type !== 'bot') {
            continue
          }

          const datasetId = resource.data?.datasetId

          if (datasetId && isInternalResourceRef(datasetId)) {
            expect(resourceIds).toContain(datasetId)
          }
        }
      }
    })

    it('integration botId references must exist within blueprint', () => {
      const integrationTypes = [
        'slackIntegration',
        'discordIntegration',
        'telegramIntegration',
        'whatsappIntegration',
        'messengerIntegration',
        'emailIntegration',
        'triggerIntegration',
        'widgetIntegration',
        'sitemapIntegration',
        'mcpserverIntegration',
      ]

      for (const example of blueprintExamples) {
        const { blueprint } = example
        const resources = blueprint.resources
        const resourceIds = Object.keys(resources)

        for (const [, resource] of Object.entries(resources)) {
          if (!integrationTypes.includes(resource.type)) {
            continue
          }

          const botId = resource.data?.botId

          if (botId && isInternalResourceRef(botId)) {
            expect(resourceIds).toContain(botId)
          }
        }
      }
    })

    it('referenced resource types must match expected types', () => {
      const referenceFields = [
        'skillsetId',
        'secretId',
        'spaceId',
        'botId',
        'datasetId',
        'fileId',
        // ability links carry the `linked` prefix
        'linkedSecretId',
        'linkedSpaceId',
        'linkedBotId',
        'linkedFileId',
      ]

      for (const example of blueprintExamples) {
        const { blueprint } = example
        const resources = blueprint.resources

        for (const [, resource] of Object.entries(resources)) {
          const data = resource.data || {}

          for (const fieldName of referenceFields) {
            const expectedType = getReferenceFieldType(fieldName)
            const refValue = data[fieldName]

            if (refValue && isInternalResourceRef(refValue)) {
              const referencedResource = resources[refValue]

              if (referencedResource) {
                expect(referencedResource.type).toBe(expectedType)
              }
            }
          }
        }
      }
    })
  })

  describe('template references', () => {
    // @note collect all valid template names including those starting with @
    // Platform templates start with @ or 'platform/'
    const validTemplateNames = new Set(Object.keys(abilities))

    it('ability templates must reference valid existing templates', () => {
      const invalidTemplates = []

      for (const example of blueprintExamples) {
        const { blueprint, slug } = example
        const resources = blueprint.resources

        for (const [resourceId, resource] of Object.entries(resources)) {
          if (resource.type !== 'ability') {
            continue
          }

          const instruction = resource.data?.instruction

          if (!instruction) {
            continue
          }

          const templateName = extractTemplateName(instruction)

          if (!templateName) {
            continue
          }

          // @note skip platform templates (they start with @ or 'platform/')
          // and skip internal templates that use # references
          if (
            templateName.startsWith('@') ||
            templateName.startsWith('platform/') ||
            templateName.startsWith('#')
          ) {
            continue
          }

          // Check if template exists in abilities catalogue
          const normalizedTemplate = templateName.toLowerCase().trim()

          if (!validTemplateNames.has(normalizedTemplate)) {
            invalidTemplates.push({
              slug,
              resourceId,
              templateName: normalizedTemplate,
              abilityName: resource.data?.name || 'unnamed',
            })
          }
        }
      }

      if (invalidTemplates.length > 0) {
        const errorMsg = invalidTemplates
          .map(
            ({ slug, resourceId, templateName, abilityName }) =>
              `Blueprint "${slug}" ability "${resourceId}" (${abilityName}) references non-existent template "${templateName}"`
          )
          .join('\n')

        throw new Error(
          `${invalidTemplates.length} invalid template references found:\n${errorMsg}`
        )
      }
    })
  })

  describe('positions', () => {
    it('position references must exist as resources, annotations, or tools', () => {
      const invalidPositions = []

      for (const example of blueprintExamples) {
        const { blueprint, slug } = example
        const resources = blueprint.resources || {}
        const positions = blueprint.positions || {}
        const notes = blueprint.notes || {}
        const images = blueprint.images || {}
        const frames = blueprint.frames || {}
        const tools = blueprint.tools || {}

        const resourceIds = new Set(Object.keys(resources))
        const noteIds = new Set(Object.keys(notes))
        const imageIds = new Set(Object.keys(images))
        const frameIds = new Set(Object.keys(frames))
        const toolIds = new Set(Object.keys(tools))
        const allValidIds = new Set([
          ...resourceIds,
          ...noteIds,
          ...imageIds,
          ...frameIds,
          ...toolIds,
        ])

        for (const positionId of Object.keys(positions)) {
          if (!allValidIds.has(positionId)) {
            invalidPositions.push({ slug, positionId })
          }
        }
      }

      if (invalidPositions.length > 0) {
        const errorMsg = invalidPositions
          .map(
            ({ slug, positionId }) =>
              `Blueprint "${slug}" position "${positionId}" references non-existent resource, annotation, or tool`
          )
          .join('\n')

        throw new Error(
          `${invalidPositions.length} invalid position references found:\n${errorMsg}`
        )
      }
    })

    it('all resources should have corresponding positions when positions are defined', () => {
      const missingPositions = []

      for (const example of blueprintExamples) {
        const { blueprint, slug } = example
        const resources = blueprint.resources || {}
        const positions = blueprint.positions

        // Skip blueprints without positions (they're optional)
        if (!positions) {
          continue
        }

        const positionIds = new Set(Object.keys(positions))

        for (const resourceId of Object.keys(resources)) {
          if (!positionIds.has(resourceId)) {
            missingPositions.push({ slug, resourceId })
          }
        }
      }

      if (missingPositions.length > 0) {
        const errorMsg = missingPositions
          .map(
            ({ slug, resourceId }) =>
              `Blueprint "${slug}" resource "${resourceId}" is missing a position definition`
          )
          .join('\n')

        throw new Error(
          `${missingPositions.length} resources are missing positions:\n${errorMsg}`
        )
      }
    })
  })

  describe('structural validation', () => {
    it('all blueprints must have resources defined', () => {
      for (const example of blueprintExamples) {
        const { blueprint } = example

        expect(blueprint.resources).toBeDefined()
        expect(typeof blueprint.resources).toBe('object')
        expect(Object.keys(blueprint.resources).length).toBeGreaterThan(0)
      }
    })

    it('all resources must have type and data properties', () => {
      for (const example of blueprintExamples) {
        const { blueprint } = example
        const resources = blueprint.resources

        for (const [, resource] of Object.entries(resources)) {
          expect(resource.type).toBeDefined()
          expect(typeof resource.type).toBe('string')
          expect(resource.data).toBeDefined()
          expect(typeof resource.data).toBe('object')
        }
      }
    })

    it('resource IDs should follow the expected pattern', () => {
      // Valid patterns:
      // 1. '#type:::id' (with alphanumeric, hyphenated, or slashed IDs) e.g., '#bot:::abc123', '#nubela/proxycurl/person/search:::abc'
      // 2. 'custom-note-id' e.g., 'shell-note'
      // 3. '#cuid' format e.g., '#cm4epwzmu2ns2dmjhppn7co7y' (legacy format without type prefix)
      const validPattern =
        /^(#[a-zA-Z0-9/_-]+:::[a-zA-Z0-9_-]+|#[a-z0-9]+|[a-zA-Z0-9_-]+)$/

      for (const example of blueprintExamples) {
        const { blueprint } = example
        const resources = blueprint.resources

        for (const resourceId of Object.keys(resources)) {
          expect(resourceId).toMatch(validPattern)
        }
      }
    })

    it('abilities must have instruction property', () => {
      // @note structural template blueprints intentionally have empty instructions
      // to serve as visual architecture references that users customize
      const structuralTemplates = ['mcp-factory-reference-architecture']

      const missingInstructions = []

      for (const example of blueprintExamples) {
        const { blueprint, slug } = example

        if (structuralTemplates.includes(slug)) {
          continue
        }

        const resources = blueprint.resources

        for (const [resourceId, resource] of Object.entries(resources)) {
          if (resource.type !== 'ability') {
            continue
          }

          if (
            !resource.data.instruction ||
            typeof resource.data.instruction !== 'string' ||
            resource.data.instruction.length === 0
          ) {
            missingInstructions.push({
              slug,
              resourceId,
              name: resource.data.name || 'unnamed',
            })
          }
        }
      }

      if (missingInstructions.length > 0) {
        const errorMsg = missingInstructions
          .map(
            ({ slug, resourceId, name }) =>
              `Blueprint "${slug}" ability "${resourceId}" (${name}) is missing instruction property`
          )
          .join('\n')

        throw new Error(
          `${missingInstructions.length} abilities are missing instructions:\n${errorMsg}`
        )
      }
    })
  })

  describe('orphan detection', () => {
    // @note reference architecture blueprints may have intentionally unconnected
    // resources for dynamic installation patterns
    const dynamicArchitecturePatterns = [
      'dynamic',
      'reference-architecture',
      'orchestrator',
      'multi-agent',
      'playbook',
      'factory',
      'proactive',
      'dual-agent',
      'swarm',
      'catalogue',
      'supply-chain',
      'harness',
      'heartbeat-async-operator',
    ]

    function isDynamicArchitecture(slug) {
      return dynamicArchitecturePatterns.some((pattern) =>
        slug.toLowerCase().includes(pattern)
      )
    }

    it('skillsets should be referenced by at least one ability or bot', () => {
      const orphanSkillsets = []

      for (const example of blueprintExamples) {
        const { blueprint, slug } = example

        // Skip blueprints that use dynamic installation patterns
        if (isDynamicArchitecture(slug)) {
          continue
        }

        const resources = blueprint.resources

        // Collect all skillset IDs
        const skillsetIds = Object.entries(resources)
          .filter(([, r]) => r.type === 'skillset')
          .map(([id]) => id)

        if (skillsetIds.length === 0) {
          continue
        }

        // Collect all referenced skillset IDs from abilities and bots
        const referencedSkillsetIds = new Set()

        for (const [, resource] of Object.entries(resources)) {
          if (resource.type === 'ability' || resource.type === 'bot') {
            const skillsetId = resource.data?.skillsetId

            if (skillsetId && isInternalResourceRef(skillsetId)) {
              referencedSkillsetIds.add(skillsetId)
            }
          }
        }

        // Check each skillset is referenced
        for (const skillsetId of skillsetIds) {
          if (!referencedSkillsetIds.has(skillsetId)) {
            const skillsetName = resources[skillsetId]?.data?.name || 'unnamed'

            orphanSkillsets.push({
              slug,
              skillsetId,
              name: skillsetName,
            })
          }
        }
      }

      if (orphanSkillsets.length > 0) {
        const errorMsg = orphanSkillsets
          .map(
            ({ slug, skillsetId, name }) =>
              `Blueprint "${slug}" skillset "${skillsetId}" (${name}) is not referenced by any ability or bot`
          )
          .join('\n')

        throw new Error(
          `${orphanSkillsets.length} orphan skillsets found:\n${errorMsg}`
        )
      }
    })

    it('secrets should be referenced by at least one ability', () => {
      const orphanSecrets = []

      for (const example of blueprintExamples) {
        const { blueprint, slug } = example
        const resources = blueprint.resources

        // Collect all secret IDs
        const secretIds = Object.entries(resources)
          .filter(([, r]) => r.type === 'secret')
          .map(([id]) => id)

        if (secretIds.length === 0) {
          continue
        }

        // Collect all referenced secret IDs from abilities
        const referencedSecretIds = new Set()

        for (const [, resource] of Object.entries(resources)) {
          if (resource.type === 'ability') {
            const secretId = resource.data?.linkedSecretId

            if (secretId && isInternalResourceRef(secretId)) {
              referencedSecretIds.add(secretId)
            }
          }
        }

        // Check each secret is referenced
        for (const secretId of secretIds) {
          if (!referencedSecretIds.has(secretId)) {
            const secretName = resources[secretId]?.data?.name || 'unnamed'

            orphanSecrets.push({
              slug,
              secretId,
              name: secretName,
            })
          }
        }
      }

      if (orphanSecrets.length > 0) {
        const errorMsg = orphanSecrets
          .map(
            ({ slug, secretId, name }) =>
              `Blueprint "${slug}" secret "${secretId}" (${name}) is not referenced by any ability`
          )
          .join('\n')

        throw new Error(
          `${orphanSecrets.length} orphan secrets found:\n${errorMsg}`
        )
      }
    })

    it('spaces should be referenced by at least one ability', () => {
      const orphanSpaces = []

      for (const example of blueprintExamples) {
        const { blueprint, slug } = example
        const resources = blueprint.resources

        // Collect all space IDs
        const spaceIds = Object.entries(resources)
          .filter(([, r]) => r.type === 'space')
          .map(([id]) => id)

        if (spaceIds.length === 0) {
          continue
        }

        // Collect all referenced space IDs from abilities
        const referencedSpaceIds = new Set()

        for (const [, resource] of Object.entries(resources)) {
          if (resource.type === 'ability') {
            const spaceId = resource.data?.linkedSpaceId

            if (spaceId && isInternalResourceRef(spaceId)) {
              referencedSpaceIds.add(spaceId)
            }
          }
        }

        // Check each space is referenced
        for (const spaceId of spaceIds) {
          if (!referencedSpaceIds.has(spaceId)) {
            const spaceName = resources[spaceId]?.data?.name || 'unnamed'

            orphanSpaces.push({
              slug,
              spaceId,
              name: spaceName,
            })
          }
        }
      }

      if (orphanSpaces.length > 0) {
        const errorMsg = orphanSpaces
          .map(
            ({ slug, spaceId, name }) =>
              `Blueprint "${slug}" space "${spaceId}" (${name}) is not referenced by any ability`
          )
          .join('\n')

        throw new Error(
          `${orphanSpaces.length} orphan spaces found:\n${errorMsg}`
        )
      }
    })

    it('bots should be referenced by at least one integration', () => {
      const integrationTypes = [
        'slackIntegration',
        'discordIntegration',
        'telegramIntegration',
        'whatsappIntegration',
        'messengerIntegration',
        'emailIntegration',
        'triggerIntegration',
        'widgetIntegration',
        'sitemapIntegration',
        'mcpserverIntegration',
      ]

      const orphanBots = []

      for (const example of blueprintExamples) {
        const { blueprint, slug } = example

        // Skip blueprints that use dynamic installation patterns
        // Multi-agent and orchestrator patterns may have bots that are called
        // programmatically rather than through integrations
        if (isDynamicArchitecture(slug)) {
          continue
        }

        const resources = blueprint.resources

        // Collect all bot IDs
        const botIds = Object.entries(resources)
          .filter(([, r]) => r.type === 'bot')
          .map(([id]) => id)

        if (botIds.length === 0) {
          continue
        }

        // @note skip blueprints that have no integrations at all
        // (they might be bot-only blueprints for use with SDK or API)
        const hasIntegrations = Object.values(resources).some((r) =>
          integrationTypes.includes(r.type)
        )

        if (!hasIntegrations) {
          continue
        }

        // @note skip blueprints where the only integrations are
        // mcpserverIntegration since MCP servers reference a skillset
        // rather than a bot
        const hasNonMcpIntegrations = Object.values(resources).some(
          (r) =>
            integrationTypes.includes(r.type) &&
            r.type !== 'mcpserverIntegration'
        )

        if (!hasNonMcpIntegrations) {
          continue
        }

        // Collect all referenced bot IDs from integrations, plus abilities
        // (a worker bot wired to a bot/call-style ability is reached
        // programmatically rather than through a channel)
        const referencedBotIds = new Set()

        for (const [, resource] of Object.entries(resources)) {
          if (
            integrationTypes.includes(resource.type) ||
            resource.type === 'ability'
          ) {
            // integrations keep `botId`; abilities link via `linkedBotId`
            const botId =
              resource.type === 'ability'
                ? resource.data?.linkedBotId
                : resource.data?.botId

            if (botId && isInternalResourceRef(botId)) {
              referencedBotIds.add(botId)
            }
          }
        }

        // Check each bot is referenced
        for (const botId of botIds) {
          if (!referencedBotIds.has(botId)) {
            const botName = resources[botId]?.data?.name || 'unnamed'

            orphanBots.push({
              slug,
              botId,
              name: botName,
            })
          }
        }
      }

      if (orphanBots.length > 0) {
        const errorMsg = orphanBots
          .map(
            ({ slug, botId, name }) =>
              `Blueprint "${slug}" bot "${botId}" (${name}) is not referenced by any integration`
          )
          .join('\n')

        throw new Error(`${orphanBots.length} orphan bots found:\n${errorMsg}`)
      }
    })
  })
})

/**
 * Every checked-in blueprint source - the examples catalogue, the embedded
 * factory template, and the YAML blueprints (whole documents or fenced
 * ```yaml blocks) in the platform's prompts, content and docs - is parsed
 * and its ability resources checked for the pre-rename link keys, so the
 * catalogue is guarded against the old keys reappearing. Non-blueprint source
 * remains covered by the line-based scan in
 * `lib/ability.links.guard.utest.js`.
 */
describe('ability link keys', () => {
  const ROOT = path.resolve(__dirname, '..')

  // the pre-rename ability link keys; a regression guard, not compatibility
  const OLD_ABILITY_LINK_KEYS = ['secretId', 'fileId', 'botId', 'spaceId']

  // the platform trees whose YAML / Markdown may embed a blueprint
  const DOC_DIRS = [
    'prompts',
    'content',
    'lib',
    'pages',
    'app',
    'components',
    'scripts',
    'schemas',
  ]

  const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.yaml', '.yml'])

  const SKIP_DIRS = new Set(['node_modules', 'dist'])

  // a fenced ```yaml block, possibly indented (prompts embed them in a YAML
  // string); the closing fence sits at the same indentation
  const FENCE_REGEXP = /^([ \t]*)```ya?ml[^\n]*\n([\s\S]*?)^\1```/gm

  function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) {
        continue
      }

      const full = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        yield* walk(full)
      } else if (
        DOC_EXTENSIONS.has(path.extname(entry.name)) &&
        !/\.(utest|itest|test|spec)\./.test(entry.name)
      ) {
        yield full
      }
    }
  }

  /**
   * The resources of a parsed blueprint document: either a `resources` map
   * or a bare map of `{ type, data }` nodes. Anything else is not a blueprint.
   * @returns {Record<string, any>}
   */
  function resourcesOf(doc) {
    if (!doc || typeof doc !== 'object') {
      return {}
    }

    const map =
      doc.resources && typeof doc.resources === 'object' ? doc.resources : doc

    return Object.fromEntries(
      Object.entries(map).filter(
        ([, node]) =>
          node &&
          typeof node === 'object' &&
          typeof node.type === 'string' &&
          node.data &&
          typeof node.data === 'object'
      )
    )
  }

  /**
   * @param {string} text
   * @returns {any | null} null when the text is not (blueprint-shaped) YAML
   */
  function tryLoad(text) {
    try {
      return yaml.load(text)
    } catch {
      // custom tags (`!string`), fragments etc. - not a blueprint
      return null
    }
  }

  /**
   * Every resource map found in a file: the whole document for YAML files,
   * plus each fenced ```yaml block (dedented) for any file.
   * @param {string} file
   * @returns {Record<string, any>[]}
   */
  function resourceMapsOf(file) {
    const text = fs.readFileSync(file, 'utf8')
    const docs = []

    if (/\.ya?ml$/.test(file)) {
      docs.push(tryLoad(text))
    }

    for (const match of text.matchAll(FENCE_REGEXP)) {
      const indent = match[1]
      const block = match[2]
        .split('\n')
        .map((line) =>
          line.startsWith(indent) ? line.slice(indent.length) : line
        )
        .join('\n')

      docs.push(tryLoad(block))
    }

    return docs.map(resourcesOf).filter((map) => Object.keys(map).length)
  }

  /**
   * @param {string} source
   * @param {Record<string, any>} resources
   * @param {{ checked: number, violations: string[] }} tally
   */
  function checkAbilities(source, resources, tally) {
    for (const [id, resource] of Object.entries(resources)) {
      if (resource.type !== 'ability') {
        continue
      }

      tally.checked++

      const data = resource.data

      if (!data || typeof data !== 'object') {
        continue
      }

      for (const key of OLD_ABILITY_LINK_KEYS) {
        if (Object.hasOwn(data, key)) {
          tally.violations.push(`${source} ${id}: ability \`${key}\``)
        }
      }
    }
  }

  it('the examples catalogue carries no pre-rename ability link key', () => {
    const tally = { checked: 0, violations: [] }

    for (const { slug, blueprint } of getBlueprintExamples()) {
      checkAbilities(`examples/${slug}`, blueprint.resources, tally)
    }

    expect(tally.violations).toEqual([])
    expect(tally.checked).toBeGreaterThan(0)

    // eslint-disable-next-line no-console
    console.info(
      `ability link keys: examples catalogue - ${tally.checked} abilities checked`
    )
  })

  it('the factory template carries no pre-rename ability link key', () => {
    const tally = { checked: 0, violations: [] }

    checkAbilities('factory-template', buildTemplate('f-test').resources, tally)

    expect(tally.violations).toEqual([])
    expect(tally.checked).toBeGreaterThan(0)

    // eslint-disable-next-line no-console
    console.info(
      `ability link keys: factory template - ${tally.checked} abilities checked`
    )
  })

  it('the YAML blueprints in prompts, content and docs carry no pre-rename ability link key', () => {
    /** @type {Record<string, { checked: number, violations: string[] }>} */
    const tallies = {}

    for (const dir of DOC_DIRS) {
      const full = path.join(ROOT, dir)
      const tally = { checked: 0, violations: [] }

      tallies[dir] = tally

      if (!fs.existsSync(full)) {
        continue
      }

      for (const file of walk(full)) {
        for (const resources of resourceMapsOf(file)) {
          checkAbilities(path.relative(ROOT, file), resources, tally)
        }
      }
    }

    expect(Object.values(tallies).flatMap((tally) => tally.violations)).toEqual(
      []
    )

    // @note the blueprint assistant prompt documents the ability shape with
    // a YAML blueprint, so the scan must find at least that one
    expect(tallies.prompts.checked).toBeGreaterThan(0)

    // eslint-disable-next-line no-console
    console.info(
      `ability link keys: ${Object.entries(tallies)
        .map(([dir, tally]) => `${dir} - ${tally.checked} abilities checked`)
        .join(', ')}`
    )
  })

  it('detects the stale key it guards against', () => {
    const tally = { checked: 0, violations: [] }

    checkAbilities(
      'fixture',
      resourcesOf(
        yaml.load(
          [
            '"#a":',
            '  type: ability',
            '  data:',
            '    name: A',
            '    instruction: x',
            '    secretId: "#s"',
          ].join('\n')
        )
      ),
      tally
    )

    expect(tally.checked).toBe(1)
    expect(tally.violations).toEqual(['fixture #a: ability `secretId`'])

    expect(resourcesOf(yaml.load('template: "slack/message/send"'))).toEqual({})
    expect(resourcesOf('not an object')).toEqual({})
  })
})
