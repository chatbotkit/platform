import { getAbilityFunctionParameters } from '@/lib/ability.function'
import fetch, { withRetry, withTimeout } from '@/lib/fetch'
import { buildTemplateInstruction } from '@/lib/instruction.template.parse'
import { applySkillset } from '@/lib/skillset.apply'
import { parse as parseYaml } from '@/lib/yaml'

import { fromOpenApi } from '@msw/source/open-api'

import { readFileSync } from 'fs'
import { JSONSchemaFaker } from 'json-schema-faker'
import { convertObj } from 'swagger2openapi'

export { setupServer } from 'msw/node'

const fetchOpenApiDefinition = withRetry(withTimeout(fetch, { timeout: 10000 }), {
  retries: 5,
  retryDelay: 250,
  retryTimeout: true,
})

const GITHUB_RAW_URL_PATTERN =
  /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(.+)$/

/**
 * Maps a raw.githubusercontent.com URL to the equivalent api.github.com
 * contents endpoint. GitHub throttles unauthenticated raw fetches per IP
 * (datacenter/CI addresses get 429'd outright and the throttle is not
 * transient, so retries cannot recover), while the contents API serves the
 * same bytes under its own, far more workable rate limit.
 *
 * @param {string} url - The definition URL
 * @returns {string|null} The API fallback URL, or null when the URL is not a raw GitHub URL
 */
export function getGitHubApiFallbackUrl(url) {
  const match = url.match(GITHUB_RAW_URL_PATTERN)

  if (!match) {
    return null
  }

  const [, owner, repo, rest] = match

  // @note raw URLs carry the ref either as `refs/heads/<branch>/<path>` or
  // directly as `<branch-or-sha>/<path>`

  const segments = rest.startsWith('refs/heads/')
    ? rest.slice('refs/heads/'.length).split('/')
    : rest.split('/')

  const ref = segments[0]
  const path = segments.slice(1).join('/')

  if (!ref || !path) {
    return null
  }

  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`
}

/**
 * Fetches the text of a remote OpenAPI definition. Raw GitHub URLs that fail
 * (typically the per-IP 429 throttle on raw.githubusercontent.com) are
 * refetched through the api.github.com contents endpoint with the raw media
 * type, authenticated with GITHUB_TOKEN when available.
 *
 * @param {string} url - The definition URL
 * @returns {Promise<string>} The definition text
 */
async function fetchOpenApiDefinitionText(url) {
  const fallbackUrl = getGitHubApiFallbackUrl(url)

  let failure

  try {
    // @note when an API fallback exists there is no point burning the retry
    // budget on the raw host - its throttle outlives any backoff

    const response = await fetchOpenApiDefinition(
      url,
      fallbackUrl ? { retries: 0 } : undefined
    )

    if (response.ok) {
      return await response.text()
    }

    failure = new Error(`Cannot fetch ${url} (status ${response.status})`)
  } catch (error) {
    failure = error
  }

  if (!fallbackUrl) {
    throw failure
  }

  const headers = {
    accept: 'application/vnd.github.raw+json',
  }

  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const response = await fetchOpenApiDefinition(fallbackUrl, { headers })

  if (!response.ok) {
    throw new Error(`Cannot fetch ${fallbackUrl} (status ${response.status})`)
  }

  return await response.text()
}

/**
 * Adds default 200 responses to OpenAPI operations that have no responses defined.
 * This prevents MSW from returning 501 "Not Implemented" errors when using fromOpenApi.
 *
 * @param {Object} openApiDefinition - The OpenAPI v3 specification object
 * @returns {Object} The modified OpenAPI specification with default responses
 */
export function addMissingResponses(openApiDefinition) {
  if (!openApiDefinition?.paths) {
    return openApiDefinition
  }

  const definition = JSON.parse(JSON.stringify(openApiDefinition))

  Object.keys(definition.paths).forEach((pathKey) => {
    const pathItem = definition.paths[pathKey]

    const httpMethods = [
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'head',
      'options',
      'trace',
    ]

    httpMethods.forEach((method) => {
      const operation = pathItem[method]

      if (!operation) {
        return
      }

      if (
        !operation.responses ||
        Object.keys(operation.responses).length === 0
      ) {
        operation.responses = {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                },
                example: {},
              },
            },
          },
        }
      }

      if (!operation.responses.default) {
        const responseKeys = Object.keys(operation.responses).sort()

        operation.responses.default = operation.responses[responseKeys[0]]
      }
    })
  })

  return definition
}

/**
 * Replaces wildcard response status ranges with a concrete status that MSW can
 * pass to the Fetch API Response constructor.
 *
 * @param {Object} openApiDefinition - The OpenAPI v3 specification object
 * @returns {Object} The normalized OpenAPI specification
 */
export function normalizeResponseStatuses(openApiDefinition) {
  if (!openApiDefinition?.paths) {
    return openApiDefinition
  }

  const definition = JSON.parse(JSON.stringify(openApiDefinition))
  const httpMethods = [
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'head',
    'options',
    'trace',
  ]

  for (const pathItem of Object.values(definition.paths)) {
    for (const method of httpMethods) {
      const responses = pathItem[method]?.responses

      if (!responses) {
        continue
      }

      for (const statusCode of Object.keys(responses)) {
        const match = statusCode.match(/^([1-5])[xX]{2}$/)

        if (!match) {
          continue
        }

        const concreteStatus = `${match[1]}00`

        if (!responses[concreteStatus]) {
          responses[concreteStatus] = responses[statusCode]
        }

        delete responses[statusCode]
      }
    }
  }

  return definition
}

/**
 * Recursively resolves $ref pointers in a schema using the provided components.
 *
 * @param {Object} schema - The schema to resolve
 * @param {Object} components - The OpenAPI components object
 * @param {Set} visited - Set of visited refs to prevent infinite recursion
 * @returns {Object} The resolved schema with $ref replaced by actual definitions
 */
function resolveRefs(schema, components, visited = new Set()) {
  if (!schema || typeof schema !== 'object') {
    return schema
  }

  // @note handle $ref pointers
  if (schema.$ref) {
    const refPath = schema.$ref

    // @note prevent infinite recursion for circular references
    if (visited.has(refPath)) {
      return { type: 'object' }
    }

    visited.add(refPath)

    // @note parse #/components/schemas/Name format
    const match = refPath.match(/^#\/components\/schemas\/(.+)$/)

    if (match && components?.schemas?.[match[1]]) {
      return resolveRefs(components.schemas[match[1]], components, visited)
    }

    // @note if ref cannot be resolved, return a simple object
    return { type: 'object' }
  }

  // @note handle anyOf - pick the first option for simplicity
  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return resolveRefs(schema.anyOf[0], components, visited)
  }

  // @note handle oneOf - pick the first option for simplicity
  if (schema.oneOf && Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return resolveRefs(schema.oneOf[0], components, visited)
  }

  // @note handle allOf - merge all schemas
  if (schema.allOf && Array.isArray(schema.allOf)) {
    const merged = { type: 'object', properties: {} }

    for (const subSchema of schema.allOf) {
      const resolved = resolveRefs(subSchema, components, visited)

      if (resolved.properties) {
        Object.assign(merged.properties, resolved.properties)
      }
    }

    return merged
  }

  // @note recursively resolve nested objects
  const resolved = Array.isArray(schema) ? [] : {}

  for (const [key, value] of Object.entries(schema)) {
    resolved[key] = resolveRefs(value, components, visited)
  }

  return resolved
}

/**
 * Automatically adds examples to OpenAPI v3 response schemas that don't have them.
 * This enables MSW (Mock Service Worker) to generate meaningful mock responses
 * instead of empty responses when using fromOpenApi.
 *
 * @param {Object} openApiDefinition - The OpenAPI v3 specification object
 * @returns {Object} The modified OpenAPI specification with generated examples
 */
export function addMissingResponseExamples(openApiDefinition) {
  if (!openApiDefinition?.paths) {
    return openApiDefinition
  }

  const definition = JSON.parse(JSON.stringify(openApiDefinition))
  const components = definition.components

  const httpMethods = [
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'head',
    'options',
    'trace',
  ]

  for (const pathKey of Object.keys(definition.paths)) {
    const pathItem = definition.paths[pathKey]

    for (const method of httpMethods) {
      if (!pathItem[method]?.responses) {
        continue
      }

      for (const statusCode of Object.keys(pathItem[method].responses)) {
        const response = pathItem[method].responses[statusCode]

        if (!response.content) {
          continue
        }

        for (const contentType of Object.keys(response.content)) {
          const mediaType = response.content[contentType]

          if (mediaType.schema && !mediaType.example && !mediaType.examples) {
            try {
              // @note resolve $ref pointers before generating example
              const resolvedSchema = resolveRefs(mediaType.schema, components)
              const generatedExample = JSONSchemaFaker.generate(resolvedSchema)

              mediaType.example = generatedExample
            } catch {
              // @note silently handle generation errors to prevent test failures
              // when JSONSchemaFaker cannot generate from complex schemas
            }
          }
        }
      }
    }
  }

  return definition
}

/**
 * Generate a sample input object for an ability from its parameter schema.
 *
 * The parameter schema is FLAT - fields live at the top level - so the generated
 * object is the field input directly (there is no `input` wrapper to unwrap). If
 * the schema shape ever regresses, this is the single seam that breaks, so it is
 * unit-tested directly rather than only via the catalogue template suites.
 *
 * @param {Object} ability - The ability (needs an `instruction`)
 * @returns {Record<string, any>}
 */
export function generateAbilityInput(ability) {
  return /** @type {Record<string, any>} */ (
    JSONSchemaFaker.generate(getAbilityFunctionParameters(ability))
  )
}

/**
 * Executes a template with generated input data and returns the result.
 *
 * @param {Object} user - The user object with at least an id property
 * @param {string} template - The template name to execute
 * @param {Object} [options] - Optional configuration
 * @param {Function} [options.processInput] - Function to process/transform the generated input before execution
 * @param {string} [options.secret] - Optional secret value to use in the ability
 * @returns {Promise<{error: string|undefined, result: Object|undefined}>}
 */
export async function executeTemplate(user, template, options = {}) {
  const { processInput } = options

  const abilityName = 'test'

  const skillset = {
    name: 'Test Skillset',

    abilities: [
      {
        name: abilityName,
        description: 'This is a test ability',
        instruction: buildTemplateInstruction({
          template: template,
          params: {},
        }),

        inlineSecrets: {
          default: {
            value: options?.secret || 'Bearer test-123',
          },
        },
      },
    ],
  }

  let input = generateAbilityInput(skillset.abilities[0])

  // @note allow tests to transform generated input for API-specific requirements

  if (processInput) {
    input = processInput(input)
  }

  const abilityInput = JSON.stringify(input)

  const { error, result } = await applySkillset(
    user.id,

    skillset,

    abilityName,
    abilityInput
  )

  return { error, result }
}

/**
 * Creates MSW handlers from an OpenAPI definition object.
 *
 * This utility takes an OpenAPI specification object, applies common fixes
 * (trailing slashes, missing responses, missing examples), and returns MSW
 * handlers ready to be used with setupServer.
 *
 * @param {Object} definition - The OpenAPI specification object
 * @param {Object} [options] - Optional configuration
 * @param {Function} [options.transformDefinition] - Function to transform the definition before creating handlers
 * @returns {Promise<{handlers: Array, definition: Object}>} The MSW handlers and the processed definition
 *
 * @example
 * const server = setupServer()
 *
 * beforeAll(async () => {
 *   const definition = parseYaml(readFileSync('spec.yaml', 'utf8'))
 *   const { handlers } = await createOpenApiHandlersFromDefinition(definition)
 *   server.use(...handlers)
 *   server.listen()
 * })
 */
export async function createOpenApiHandlersFromDefinition(
  definition,
  options = {}
) {
  const { transformDefinition } = options

  // @note fix trailing slash in server URL to prevent double slashes

  if (definition.servers?.[0]?.url) {
    definition.servers[0].url = definition.servers[0].url.replace(/\/$/, '')
  }

  // @note allow custom transformations for API-specific fixes

  if (transformDefinition) {
    definition = transformDefinition(definition)
  }

  const handlers = await fromOpenApi(
    addMissingResponseExamples(
      addMissingResponses(normalizeResponseStatuses(definition))
    )
  )

  return { handlers, definition }
}

/**
 * Creates MSW handlers from an OpenAPI definition URL or local file path.
 *
 * This utility fetches an OpenAPI specification from a URL or reads it from a
 * local file, applies common fixes (trailing slashes, missing responses, missing
 * examples), and returns MSW handlers ready to be used with setupServer.
 * Remote definitions are fetched with retries to reduce catalogue test flake
 * from transient upstream errors, and raw.githubusercontent.com sources fall
 * back to the api.github.com contents endpoint when the raw host throttles
 * the runner's IP.
 *
 * @param {string} definitionSource - URL (https://) or local file path to the OpenAPI specification
 * @param {Object} [options] - Optional configuration
 * @param {Function} [options.transformDefinition] - Function to transform the definition before creating handlers
 * @returns {Promise<{handlers: Array, definition: Object}>} The MSW handlers and the processed definition
 *
 * @example
 * // From URL
 * const { handlers } = await createOpenApiHandlers(
 *   'https://api.example.com/openapi.json'
 * )
 *
 * // From local file
 * const { handlers } = await createOpenApiHandlers(
 *   join(__dirname, 'spec.yaml')
 * )
 */
export async function createOpenApiHandlers(definitionSource, options = {}) {
  const { transformDefinition } = options

  let text

  // @note detect URL vs local file path

  if (definitionSource.startsWith('https://')) {
    text = await fetchOpenApiDefinitionText(definitionSource)
  } else {
    text = readFileSync(definitionSource, 'utf8')
  }

  // @note always use YAML parsing since JSON is a valid subset of YAML

  let definition = parseYaml(text, { json: true })

  // @note auto-detect Swagger 2.0 and convert to OpenAPI 3.0

  if (definition.swagger === '2.0') {
    const { openapi: convertedDefinition } = await convertObj(definition, {
      patch: true,
      warnOnly: true,
    })

    definition = convertedDefinition
  }

  return createOpenApiHandlersFromDefinition(definition, {
    transformDefinition,
  })
}
