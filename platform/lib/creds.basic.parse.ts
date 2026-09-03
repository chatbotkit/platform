/**
 * Basic auth credentials parser.
 *
 * Parses username/password credentials from various formats including YAML,
 * properties files, and JSON. Handles common key aliases (user/username,
 * pass/password).
 *
 * @example
 * // YAML style
 * parseBasicCredentials('username: john\npassword: secret')
 * // => { success: true, credentials: { username: 'john', password: 'secret' } }
 *
 * @example
 * // Properties style
 * parseBasicCredentials('user=john\npass=secret')
 * // => { success: true, credentials: { username: 'john', password: 'secret' } }
 *
 * @example
 * // JSON
 * parseBasicCredentials('{"username": "john", "password": "secret"}')
 * // => { success: true, credentials: { username: 'john', password: 'secret' } }
 *
 * @example
 * // Raw user:pass format (not parsed as key-value)
 * parseBasicCredentials('myuser:mypass')
 * // => { success: false, isStructured: false }
 *
 * @example
 * // Valid JSON but empty credentials
 * parseBasicCredentials('{"other": "field"}')
 * // => { success: false, isStructured: true }
 */
import { parseKeyValue } from './keyvalue'

/**
 * Recognized key aliases for basic auth credentials.
 */
const CREDENTIAL_KEYS = ['username', 'user', 'password', 'pass']

export interface BasicCredentials {
  username: string
  password: string
}

export type ParseBasicCredentialsResult =
  | {
      /**
       * Whether valid credentials were found.
       */
      success: true

      /**
       * The parsed credentials.
       */
      credentials: BasicCredentials

      /**
       * Whether the input was a structured format (JSON, YAML, properties).
       */
      isStructured: true
    }
  | {
      /**
       * Whether valid credentials were found.
       */
      success: false

      /**
       * Whether the input was a structured format (JSON, YAML, properties).
       * When true and success is false, the input was structured but had no valid
       * credentials. When false and success is false, the input should be treated
       * as raw user:pass format.
       */
      isStructured: boolean
    }

/**
 * Check if the input looks like a structured format (JSON, YAML, or properties).
 *
 * For single-line input, only JSON and properties style (=) are considered
 * structured. This avoids ambiguity with raw `user:pass` format.
 *
 * For multi-line input, YAML style (key: value) is also considered structured.
 */
function looksLikeStructuredFormat(input: string): boolean {
  const trimmed = input.trim()

  if (!trimmed) {
    return false
  }

  // @note JSON object

  if (trimmed.startsWith('{')) {
    try {
      JSON.parse(trimmed)

      return true
    } catch {
      // not valid JSON
    }
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => {
    const t = l.trim()

    return t && !t.startsWith('#')
  })

  const isSingleLine = lines.length === 1

  for (const line of lines) {
    const trimmedLine = line.trim()

    // @note properties style (key=value) is always unambiguous

    if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*.+$/.test(trimmedLine)) {
      return true
    }

    // @note YAML style with space (key: value) is unambiguous

    if (/^[a-zA-Z_][a-zA-Z0-9_]*:\s+.+$/.test(trimmedLine)) {
      return true
    }

    // @note compact YAML (key:value) is only structured for multi-line input
    // @note single-line "user:pass" could be raw credentials, not key-value

    if (
      !isSingleLine &&
      /^(username|user|password|pass):.+$/i.test(trimmedLine)
    ) {
      return true
    }
  }

  return false
}

/**
 * Parse basic auth credentials from various formats.
 *
 * Supports:
 * - YAML style: `username: value` or `username:value`
 * - Properties style: `username=value`
 * - JSON: `{"username": "value", "password": "value"}`
 *
 * Recognizes key aliases:
 * - `username` or `user` for the username
 * - `password` or `pass` for the password
 *
 * @returns Result object indicating success, credentials, and whether input was structured
 */
export function parseBasicCredentials(
  input: string
): ParseBasicCredentialsResult {
  const isStructured = looksLikeStructuredFormat(input)

  // @note if input doesn't look structured, don't try to parse it as key-value
  // @note this prevents ambiguous single-line "user:pass" from being parsed

  if (!isStructured) {
    return { success: false, isStructured: false }
  }

  const result = parseKeyValue(input, {
    recognizedKeys: CREDENTIAL_KEYS,
  })

  if (!result.success) {
    return { success: false, isStructured: true }
  }

  const { data } = result

  // @note normalize key aliases

  const username = data.username ?? data.user ?? ''
  const password = data.password ?? data.pass ?? ''

  if (!username && !password) {
    return { success: false, isStructured: true }
  }

  return {
    success: true,
    credentials: { username, password },
    isStructured: true,
  }
}
