import type { ActionOptions } from '@/lib/action.exec.all'
import { getContextBot } from '@/lib/context.store'
import { debug } from '@/lib/debug'
import { BotInputError } from '@/lib/error'
import { merge } from '@/lib/object'
import { tryParse } from '@/lib/yaml'
import { ZodError, getFriendlyErrorMessage } from '@/lib/zod.error'
import type { ZodSchema } from '@/lib/zod.schema'

/**
 * Linked resource types that can be passed explicitly at runtime.
 *
 * These come from the execution context and include resources like
 * botId, secretId, fileId, and spaceId that are known at runtime.
 */
export type LinkedResourceType = keyof NonNullable<
  ActionOptions['linkedResources']
>

/**
 * Context resource types that can be passed explicitly at runtime.
 *
 * These come from the execution context and include resources like
 * skillsetId, abilityId, and blueprintId that are known at runtime.
 */
export type ContextResourceType = keyof NonNullable<
  ActionOptions['contextResources']
>

/**
 * Resolver function type for linked resources with context fallback.
 *
 * These functions are called at execution time when context is available.
 * They should check linked resources first, then fall back to context values.
 */
type LinkedResourceResolver = (options: {
  linkedResources?: Partial<Record<LinkedResourceType, string>>
  contextResources?: Partial<Record<ContextResourceType, string>>
}) => string | undefined

/**
 * Maps each LinkedResourceType to its placeholder pattern.
 */
type LinkedResourcePlaceholderMap = {
  botId: '${BOT_DEFAULT}'
  secretId: '${SECRET_DEFAULT}'
  fileId: '${FILE_DEFAULT}'
  spaceId: '${SPACE_DEFAULT}'
}

// @note compile-time check that all LinkedResourceTypes have a placeholder mapping
{
  type _AssertAllLinkedResourcesHavePlaceholders =
    LinkedResourceType extends keyof LinkedResourcePlaceholderMap ? true : false
  const _checkLinked: _AssertAllLinkedResourcesHavePlaceholders = true
}

/**
 * Maps each ContextResourceType to its placeholder pattern.
 */
type ContextResourcePlaceholderMap = {
  blueprintId: '${BLUEPRINT_DEFAULT}'
  skillsetId: '${SKILLSET_DEFAULT}'
  abilityId: '${ABILITY_DEFAULT}'
}

// @note compile-time check that all ContextResourceTypes have a placeholder mapping
{
  type _AssertAllContextResourcesHavePlaceholders =
    ContextResourceType extends keyof ContextResourcePlaceholderMap
      ? true
      : false
  const _checkContext: _AssertAllContextResourcesHavePlaceholders = true
}

/**
 * Union of all placeholder patterns (both linked and context resources).
 */
type ResourcePlaceholderPattern =
  | LinkedResourcePlaceholderMap[keyof LinkedResourcePlaceholderMap]
  | ContextResourcePlaceholderMap[keyof ContextResourcePlaceholderMap]

/**
 * Maps placeholder patterns to resolver functions that handle context fallback.
 *
 * Resolution order (strongest signal first):
 * 1. Explicitly linked/context resources
 * 2. Context values from getContextBot() (when available at execution time)
 *
 * @note these functions are called during config substitution when context is
 * available. They check linked/context resources first (stronger signal), then
 * fall back to context values.
 *
 * @note TypeScript will error if a placeholder from the placeholder maps
 * doesn't have a corresponding resolver defined here.
 */
const RESOURCE_RESOLVERS: Record<
  ResourcePlaceholderPattern,
  LinkedResourceResolver
> = {
  // @note blueprint comes from contextResources and can also fallback to context bot's blueprintId

  '${BLUEPRINT_DEFAULT}': ({ contextResources }) => {
    // @note check context resource first (stronger signal)

    const contextValue = contextResources?.blueprintId

    if (contextValue) {
      debug('resolved ${BLUEPRINT_DEFAULT} from context resource', {
        contextValue,
      }).log('action.config.resolve.blueprint')

      return contextValue
    }

    // @note fallback to context bot's blueprintId

    const contextBot = getContextBot()

    if (contextBot?.blueprintId) {
      debug('resolved ${BLUEPRINT_DEFAULT} from context bot', {
        contextValue: contextBot.blueprintId,
      }).log('action.config.resolve.blueprint.fallback')

      return contextBot.blueprintId
    }

    return undefined
  },

  '${SKILLSET_DEFAULT}': ({ contextResources }) => contextResources?.skillsetId,

  '${ABILITY_DEFAULT}': ({ contextResources }) => contextResources?.abilityId,

  // ---

  '${BOT_DEFAULT}': ({ linkedResources }) => {
    // @note check linked resource first (stronger signal)

    const linkedValue = linkedResources?.botId

    if (linkedValue) {
      debug('resolved ${BOT_DEFAULT} from linked resource', {
        linkedValue,
      }).log('action.config.resolve.bot')

      return linkedValue
    }

    // @note fallback to context bot

    const contextBot = getContextBot()

    if (contextBot?.id) {
      debug('resolved ${BOT_DEFAULT} from context', {
        contextValue: contextBot.id,
      }).log('action.config.resolve.bot.fallback')

      return contextBot.id
    }

    return undefined
  },

  // @note these resources don't have direct context equivalents, so they only
  // check linked resources

  '${FILE_DEFAULT}': ({ linkedResources }) => linkedResources?.fileId,
  '${SPACE_DEFAULT}': ({ linkedResources }) => linkedResources?.spaceId,

  // @note special handling for secrets to avoid accidental leakage, we simply
  // return the reference pattern here and let the individual action handle
  // secret resolution securely

  '${SECRET_DEFAULT}': () => '${SECRET_DEFAULT}',
}

/**
 * Options for linked resource resolution in getConfigBySchema.
 */
export interface LinkedResourceOptions {
  linkedResources?: Partial<Record<LinkedResourceType, string>>
  contextResources?: Partial<Record<ContextResourceType, string>>
}

/**
 * Substitutes resource placeholders in a config object.
 *
 * Traverses the config and replaces any `${RESOURCE_DEFAULT}` patterns with
 * the corresponding value from linkedResources, contextResources, or context (as fallback).
 *
 * Resolution order:
 * 1. Explicitly provided resources (highest priority / strongest signal)
 * 2. Context values (fallback when available)
 * 3. Empty string (if neither available)
 */
function substituteResources(
  input: Record<string, unknown>,
  options?: LinkedResourceOptions
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value in RESOURCE_RESOLVERS) {
      // @note use resolver function to check linked resources first, then
      // fallback to context

      const resolver = RESOURCE_RESOLVERS[value as ResourcePlaceholderPattern]

      result[key] =
        resolver({
          linkedResources: options?.linkedResources,
          contextResources: options?.contextResources,
        }) || ''
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key] = substituteResources(
        value as Record<string, unknown>,
        options
      )
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Parses YAML input and merges it with initial values and parameters to create
 * a configuration object.
 *
 * The merge order is: initial → YAML → params (params have highest priority)
 *
 * @param input - YAML string to parse. If invalid YAML, it will be ignored gracefully
 * @param params - Parameters that override both initial and YAML values
 * @param initial - Initial/default configuration values
 * @returns Merged configuration object
 *
 * @example
 * ```typescript
 * const config = getConfig({
 *   input: 'prompt: hello\nbatch: true',
 *   initial: { prompt: 'default', silent: false },
 *   params: { timeout: 30 }
 * })
 * // Result: { prompt: 'hello', batch: true, silent: false, timeout: 30 }
 * ```
 */
export function getConfig({
  input,
  params = {},
  initial = {},
}: {
  input: string
  params?: Record<string, unknown>
  initial?: Record<string, unknown>
}): Record<string, unknown> {
  debug(`get config`, { input, params, initial })

  // @note tryParse returns null for invalid YAML, which we handle gracefully

  const yaml = tryParse(input)

  const body: Record<string, unknown> =
    typeof yaml === 'object' && yaml !== null
      ? (yaml as Record<string, unknown>)
      : {}

  // @note params doubles as the action's operation-routing channel: dispatchers
  // encode the operation as bare boolean flags here (e.g. `{ replace: true }`
  // for the shell/file `replace` operation, see toActionResult and the legacy
  // `type/operation` bracket syntax), while the real field values live in the
  // body (input). When an operation name collides with a field name, that bare
  // `true` would clobber the field value in the merge below and break schema
  // validation ("Expected string, received boolean at replace"). A routing flag
  // is always exactly `true`, so when the body already supplies a non-boolean
  // value for the same key the body is authoritative - drop the flag. Genuine
  // overrides (a real value, or a boolean field) are left untouched.

  const overrides: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(params)) {
    const shadowsTypedBodyField =
      value === true &&
      Object.prototype.hasOwnProperty.call(body, key) &&
      typeof body[key] !== 'boolean'

    if (!shadowsTypedBodyField) {
      overrides[key] = value
    }
  }

  // @note merge order is important: initial → body → params (params override
  // everything, except routing flags that would clobber a typed body field)

  const result = merge(initial, body, overrides)

  debug(`result`, { result })

  return result
}

/**
 * Parses YAML input, merges it with initial values and parameters, then
 * validates the result against a Zod schema.
 *
 * This function combines configuration parsing with type-safe validation. It's
 * commonly used in action handlers to validate and parse user input with
 * default values and parameter overrides.
 *
 * When a `${RESOURCE_DEFAULT}` placeholder is encountered in string fields, it
 * will be automatically resolved using this order of precedence:
 * 1. Explicitly provided resources from `options.linkedResources` or `options.contextResources` (highest priority)
 * 2. Context values from the current execution context (fallback - bot only)
 * 3. Empty string (if neither is available)
 *
 * Supported placeholders:
 * - `${BLUEPRINT_DEFAULT}` → context blueprintId OR context bot's blueprintId
 * - `${SKILLSET_DEFAULT}` → context skillsetId only
 * - `${ABILITY_DEFAULT}` → context abilityId only
 * - `${BOT_DEFAULT}` → linked botId OR context bot's id
 * - `${SECRET_DEFAULT}` → preserved as-is (resolved by individual actions)
 * - `${FILE_DEFAULT}` → linked fileId only
 * - `${SPACE_DEFAULT}` → linked spaceId only
 *
 * @param input - YAML string to parse and validate
 * @param params - Parameters that override both initial and YAML values
 * @param initial - Initial/default configuration values
 * @param schema - Zod schema to validate the final configuration against
 * @param options - Optional linked resource options for placeholder substitution
 * @returns Validated and typed configuration object
 * @throws BotInputError with a friendly message if the configuration doesn't
 * match the schema (surfaced to the agent as feedback, excluded from Sentry)
 *
 * @example
 * ```typescript
 * // Basic usage without linked resources
 * const { prompt, batch, silent } = getConfigBySchema({
 *   input: 'prompt: hello\nbatch: true',
 *   params: {},
 *   initial: { prompt: input },
 *   schema: z.object({
 *     prompt: z.string().min(1),
 *     batch: z.boolean().default(false),
 *     silent: z.boolean().default(false),
 *   })
 * })
 *
 * // With explicit linked resource - takes precedence
 * const { spaceId, path } = getConfigBySchema({
 *   input: 'spaceId: ${SPACE_DEFAULT}\npath: /docs',
 *   params: {},
 *   initial: {},
 *   schema: z.object({
 *     spaceId: z.string().min(1).describe('The space ID'),
 *     path: z.string().min(1),
 *   }),
 *   options: { linkedResources: { spaceId: 'sp_123' } }
 * })
 * // Result: { spaceId: 'sp_123', path: '/docs' }
 *
 * // Without linked resource - will use empty string
 * const { botId } = getConfigBySchema({
 *   input: 'botId: ${BOT_DEFAULT}',
 *   params: {},
 *   initial: {},
 *   schema: z.object({ botId: z.string().optional() }),
 *   options: {} // no linked resources, will fallback to context bot
 * })
 * // Result: { botId: 'bot_from_context' } (if context bot exists)
 * ```
 */
export function getConfigBySchema<T>({
  input,
  params = {},
  initial = {} as Partial<T>,
  schema,
  options,
}: {
  input: string
  params?: Record<string, unknown>
  initial?: Partial<T>
  schema: ZodSchema<T>
  options?: LinkedResourceOptions
}): T {
  // @note we intentionally do NOT auto-merge linkedResources into initial
  // because implicit injection of resource IDs is dangerous - users may not
  // realize they're operating on a specific resource. Instead, users must
  // explicitly specify resource IDs via placeholder substitution (e.g.,
  // ${SPACE_DEFAULT}) which makes the intent visible in their input.

  // @note first parse and merge the configuration using getConfig

  const config = getConfig({
    input,
    params,
    initial: initial as Record<string, unknown>,
  })

  // @note substitute resource placeholders before validation

  const processedConfig = substituteResources(config, options)

  let result: T

  try {
    // @todo move to an async method

    // @note then validate against the schema - this will throw ZodError if
    // validation fails

    result = schema.parse(processedConfig)
  } catch (e) {
    if (e instanceof ZodError) {
      // @note schema validation failures here are almost always the agent
      // supplying a wrong-typed/missing argument for a tool (e.g. a boolean
      // where a string is expected). Throw a BotInputError so the friendly
      // message is surfaced back to the agent as actionable feedback (the
      // function-call catch returns SafeError messages verbatim) and is kept
      // out of Sentry, rather than a plain Error that hard-fails the call and
      // gives the agent only a generic "Function invocation exception".
      throw new BotInputError(getFriendlyErrorMessage(e))
    } else {
      throw e
    }
  }

  return result
}
