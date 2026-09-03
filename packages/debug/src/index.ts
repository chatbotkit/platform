import { isDevelopment, isTest } from '@chatbotkit-dev/env'
import observability from '@chatbotkit-dev/observability'

import { ok } from 'assert'

/**
 * A map of log key patterns to whether they are enabled. Patterns may end in
 * `*` to match a namespace, for example `conversation.*`.
 */
export type LogKeys = Record<string, boolean>

export interface DebugConfig {
  /** Enables all debug output regardless of key. */
  debug: boolean

  /** Enables all error output regardless of key. */
  error: boolean

  /** Enables all warning output regardless of key. */
  warn: boolean

  log: {
    debug: LogKeys
    error: LogKeys
    warn: LogKeys
  }
}

export type KnownKeys = string

// @note always stringify objects to ensure consistent logging across
// environments and to properly serialize nested objects (avoids [Object] in
// logs)
const USE_SAFE_STRINGIFY = true

// @note maximum depth for safeStringify
const DEFAULT_MAX_DEPTH = isDevelopment ? 10 : 5

const MAX_STRING_LENGTH = isDevelopment ? 2_048 : 1_024
const MAX_ARRAY_LENGTH = isDevelopment ? 100 : 50
const MAX_OBJECT_KEYS = isDevelopment ? 100 : 50

// --- sensitive-value redaction ---

// @note outside development every log line is scrubbed of credential-shaped
// material before it is serialized. In development logs stay verbatim - the
// local email sign-in flow deliberately prints its code to the server log,
// and a developer machine is the one place full values are worth more than
// they cost. Persistence call sites (event metadata and similar) must not
// rely on this gate and should call redact() themselves, which always runs.

export const REDACTED = '[REDACTED]'

// key fragments that mark a value as a credential wherever the key appears
const SENSITIVE_KEY_FRAGMENTS = [
  'auth',
  'cookie',
  'password',
  'passwd',
  'secret',
  'token',
  'credential',
  'signature',
  'apikey',
  'api-key',
  'api_key',
  'privatekey',
  'private-key',
  'private_key',
]

// keys that contain a sensitive fragment but name a location, shape, or
// bookkeeping fact rather than a value ('tokenUrl', 'accessTokenExpiresAt',
// 'authorName', 'tokenType', 'tokens'/'maxTokens' usage counts)
const SAFE_KEY_SUFFIXES = [
  'url',
  'uri',
  'endpoint',
  'id',
  'at',
  'name',
  'type',
  'method',
  'count',
  'length',
  'size',
  'hint',
  'mask',
  'kind',
  'mode',
  'tokens',
]

/**
 * Whether a key names credential-shaped material. Case-insensitive; a key
 * counts when it contains a sensitive fragment and does not end in a suffix
 * that marks it as a location or bookkeeping fact.
 */
export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase()

  if (
    !SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))
  ) {
    return false
  }

  return !SAFE_KEY_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
}

/**
 * Scrubs credential-shaped material out of a string regardless of the key it
 * sits under: authorization scheme credentials ("Bearer x", "Basic y"), URL
 * userinfo passwords, and sensitive query-string parameters (tokens, keys,
 * codes, signatures, secrets, state), and slash-delimited configuration
 * fields such as custom model credentials.
 */
export function redactString(value: string): string {
  return value
    .replace(
      /\b(bearer|basic|digest)\s+[a-z0-9._~+/=-]+/gi,
      (match, scheme) => `${scheme} ${REDACTED}`
    )
    .replace(/(\/\/[^/\s@:]+):([^/\s@]+)@/g, `$1:${REDACTED}@`)
    .replace(
      /([?&](?:key|code|sig|state|[\w-]*(?:token|secret|password|passwd|signature|credential|auth|api[_-]?key)[\w-]*)=)[^&\s"']*/gi,
      `$1${REDACTED}`
    )
    .replace(
      /((?:^|\/)(?:key|code|sig|state|token|secret|password|passwd|passphrase|authorization|auth|credentials?|signature|api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|oauth[_-]?token|client[_-]?secret)=)[^/\s"']*/gi,
      `$1${REDACTED}`
    )
}

const MAX_REDACT_DEPTH = 8

function redactValue(
  value: unknown,
  forceAll: boolean,
  depth: number
): unknown {
  if (typeof value === 'string') {
    return forceAll ? REDACTED : redactString(value)
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return forceAll ? REDACTED : value
  }

  if (typeof value !== 'object' || value === null) {
    return value
  }

  // @note beyond this depth the value is passed through untouched - the
  // serializer's own depth limit sits lower, so nothing this deep is printed
  // in any detail anyway, and the cap keeps cycles finite

  if (depth >= MAX_REDACT_DEPTH) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, forceAll, depth + 1))
  }

  const prototype = Object.getPrototypeOf(value)

  if (prototype !== Object.prototype && prototype !== null) {
    // @note class instances (Date, Error, Map, buffers) are summarized by the
    // serializer rather than walked here
    return value
  }

  const result: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(value)) {
    result[k] = redactValue(v, forceAll || isSensitiveKey(k), depth + 1)
  }

  return result
}

/**
 * Deeply redacts credential-shaped material from a value: every string or
 * number under a sensitive key becomes '[REDACTED]' (shape preserved), and
 * every other string is scrubbed with redactString(). Always active - use
 * this at persistence boundaries (event metadata, stored records) where the
 * development-mode logging exemption must not apply.
 */
export function redact(value: unknown): unknown {
  return redactValue(value, false, 0)
}

// @note test runs can use injected staging credentials, so only interactive
// local development may bypass log redaction

const REDACT_LOGS = !isDevelopment || isTest

function prepareLogArg(arg: unknown): unknown {
  if (typeof arg === 'string') {
    return REDACT_LOGS ? redactString(arg) : arg
  }

  return safeStringify(REDACT_LOGS ? redact(arg) : arg, 2)
}

/**
 * Safely stringify an object, handling circular references and limiting depth.
 */
function safeStringify(
  obj: unknown,
  indent?: number,
  maxDepth: number = DEFAULT_MAX_DEPTH
): string {
  const seen = new WeakSet()

  function summarizeString(value: string): string {
    if (value.length <= MAX_STRING_LENGTH) {
      return value
    }

    return `${value.slice(0, MAX_STRING_LENGTH)}...[String(${value.length})]`
  }

  function summarizeBinary(value: ArrayBufferView): string {
    const constructorName = value.constructor?.name || 'ArrayBufferView'

    return `[${constructorName}(${value.byteLength})]`
  }

  function isPlainObject(value: object): boolean {
    const prototype = Object.getPrototypeOf(value)

    return prototype === Object.prototype || prototype === null
  }

  function summarizeObject(value: object): unknown {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime())
        ? value.toString()
        : value.toISOString()
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: summarizeString(value.stack || ''),
      }
    }

    if (value instanceof RegExp) {
      return value.toString()
    }

    if (value instanceof Map || value instanceof Set) {
      return `[${value.constructor.name}(${value.size})]`
    }

    return `[${value.constructor?.name || 'Object'}]`
  }

  function processValue(value: unknown, currentDepth: number): unknown {
    if (typeof value === 'string') {
      return summarizeString(value)
    }

    // handle primitives

    if (typeof value !== 'object' || value === null) {
      return value
    }

    if (ArrayBuffer.isView(value)) {
      return summarizeBinary(value)
    }

    if (value instanceof ArrayBuffer) {
      return `[ArrayBuffer(${value.byteLength})]`
    }

    // handle circular references

    if (seen.has(value)) {
      return '[Circular]'
    }

    seen.add(value)

    // handle max depth

    if (currentDepth >= maxDepth) {
      if (Array.isArray(value)) {
        return `[Array(${value.length})]`
      }

      return '[Object]'
    }

    // handle arrays

    if (Array.isArray(value)) {
      const result = value
        .slice(0, MAX_ARRAY_LENGTH)
        .map((item) => processValue(item, currentDepth + 1))

      if (value.length > MAX_ARRAY_LENGTH) {
        result.push(`...[Array(${value.length})]`)
      }

      return result
    }

    if (!isPlainObject(value)) {
      return summarizeObject(value)
    }

    // handle objects

    const result: Record<string, unknown> = {}
    const entries = Object.entries(value)

    for (const [k, v] of entries.slice(0, MAX_OBJECT_KEYS)) {
      result[k] = processValue(v, currentDepth + 1)
    }

    if (entries.length > MAX_OBJECT_KEYS) {
      result.__truncated = `...[Object(${entries.length})]`
    }

    return result
  }

  const processed = processValue(obj, 0)

  return JSON.stringify(processed, null, indent)
}

function toKeys(value: string | undefined): LogKeys {
  return Object.fromEntries(
    (value || '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)
      .map((key) => [key, true])
  )
}

// @note the built-in configuration enables nothing by default and is driven
// entirely by the environment. A deployment with opinions about its own
// subsystems supplies its own key map through configure(), typically at boot.

function defaultConfig(): DebugConfig {
  return {
    debug: false,
    error: false,
    warn: false,

    log: {
      debug: toKeys(process.env.DEBUG_KEYS),
      error: toKeys(process.env.ERROR_KEYS),
      warn: toKeys(process.env.WARN_KEYS),
    },
  }
}

type WildcardKeys = Record<string, boolean | string[]>

let activeConfig: DebugConfig | null = null
let wildcardKeys: WildcardKeys | null = null

function getConfig(): DebugConfig {
  if (!activeConfig) {
    activeConfig = defaultConfig()
  }

  return activeConfig
}

/**
 * Replaces the active debug configuration. Key matching is resolved against
 * the current configuration on every call, so this can run at any point during
 * boot and takes effect for all subsequent logging.
 */
export function configure(config: DebugConfig): void {
  activeConfig = config
  wildcardKeys = null
}

function getWildcardKeys(): WildcardKeys {
  if (!wildcardKeys) {
    wildcardKeys = Object.entries(getConfig().log).reduce(
      (acc, [category, value]) => {
        if (value.all) {
          acc[category] = true
        } else {
          const keys = Object.entries(value)
            .filter(([, e]) => e)
            .map(([k]) => (k.endsWith('*') ? k.slice(0, -1) : false))
            .filter((k): k is string => typeof k === 'string')

          acc[category] = keys
        }

        return acc
      },
      {} as WildcardKeys
    )
  }

  return wildcardKeys
}

function hasKey(key: string, category: keyof DebugConfig['log']): boolean {
  const config = getConfig()
  const wildcards = getWildcardKeys()

  return (
    config.log[category].all ||
    config.log[category][key] ||
    (Array.isArray(wildcards[category]) &&
      wildcards[category].length > 0 &&
      (wildcards[category] as string[]).some((k) => key.startsWith(k)))
  )
}

export interface DebugResult {
  log: (key?: KnownKeys) => DebugResult
  trace: () => DebugResult
}

export function print(...args: unknown[]): void {
  // eslint-disable-next-line
  console.log(...args)
}

export function log(...args: unknown[]): void {
  // eslint-disable-next-line
  console.log('*', ...(USE_SAFE_STRINGIFY ? args.map(prepareLogArg) : args))
}

export function debuglog(...args: unknown[]): void {
  // eslint-disable-next-line
  ;(console.debug || console.log)(
    ...(USE_SAFE_STRINGIFY ? args.map(prepareLogArg) : args)
  )

  if (process.env.TRACE_DEBUG) {
    try {
      // eslint-disable-next-line
      console.trace?.(...args)
    } catch {
      // @note for whatever reason it could fail
    }
  }
}

/**
 * Prints a debug message to the console if the DEBUG environment variable is
 * set.
 */
export function debug(...args: unknown[]): DebugResult {
  if (!!process.env.DEBUG || getConfig().debug) {
    debuglog('*', ...args)
  }

  return {
    log(key?: KnownKeys): DebugResult {
      if (!key || hasKey(key, 'debug')) {
        debuglog(key ? `[${key}]` : '*', ...args)
      }

      return this
    },

    trace(): DebugResult {
      try {
        // eslint-disable-next-line
        console.trace?.(...args)
      } catch {
        // @note for whatever reason it could fail
      }

      return this
    },
  }
}

export function errorlog(...args: unknown[]): void {
  // eslint-disable-next-line
  ;(console.error || console.log)(
    ...(USE_SAFE_STRINGIFY ? args.map(prepareLogArg) : args)
  )

  if (process.env.TRACE_ERROR) {
    try {
      // eslint-disable-next-line
      console.trace?.(...args)
    } catch {
      // @note for whatever reason it could fail
    }
  }
}

export function error(...args: unknown[]): DebugResult {
  errorlog('*', ...args)

  return {
    log(key?: KnownKeys): DebugResult {
      if (!key || hasKey(key, 'error')) {
        errorlog(key ? `[${key}]` : '*', ...args)
      }

      return this
    },

    trace(): DebugResult {
      try {
        // eslint-disable-next-line
        console.trace?.(...args)
      } catch {
        // @note for whatever reason it could fail
      }

      return this
    },
  }
}

export function warnlog(...args: unknown[]): void {
  // eslint-disable-next-line
  ;(console.warn || console.log)(
    ...(USE_SAFE_STRINGIFY ? args.map(prepareLogArg) : args)
  )

  if (process.env.TRACE_WARN) {
    try {
      // eslint-disable-next-line
      console.trace?.(...args)
    } catch {
      // @note for whatever reason it could fail
    }
  }
}

export function warn(...args: unknown[]): DebugResult {
  if (!!process.env.WARN || getConfig().warn) {
    warnlog('*', ...args)
  }

  return {
    log(key?: KnownKeys): DebugResult {
      if (!key || hasKey(key, 'warn')) {
        warnlog(key ? `[${key}]` : '*', ...args)
      }

      return this
    },

    trace(): DebugResult {
      try {
        // eslint-disable-next-line
        console.trace?.(...args)
      } catch {
        // @note for whatever reason it could fail
      }

      return this
    },
  }
}

export function exit(...args: unknown[]): never {
  if (args.length) {
    // eslint-disable-next-line
    ;(console.error || console.log)(...args)
  }

  process.exit(1)
}

export function assert(test: unknown, message: string): void {
  ok(test, message)
}

export function fassert(test: () => unknown, message: string): void {
  ok(test(), message)
}

/**
 * @deprecated
 * @throws {Error} Always throws an error indicating unreachable code was reached
 */
export function unreachable(test: never): never {
  throw new Error(`Unreachable code reached: ${test}`)
}

interface SpanOptions {
  name: string
  op?: string
}

interface Span {
  finish: () => void
  setAttribute: (name: string, value: unknown) => void
}

export function createSpan({ name, op }: SpanOptions): Span {
  return observability.startSpan({ name, op })
}

export function span(options: { name: string }, fn: () => void): void {
  const span = createSpan(options)

  try {
    fn()
  } finally {
    span.finish()
  }
}

export async function spanAsync(
  options: { name: string },
  fn: () => Promise<void>
): Promise<void> {
  const span = createSpan(options)

  try {
    await fn()
  } finally {
    span.finish()
  }
}

export default debug
