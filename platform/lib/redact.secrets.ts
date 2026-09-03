/**
 * Scrubs credential-bearing fields out of a value before it is logged.
 *
 * @note the platform's debug channel accepts arbitrary objects, and OAuth and
 * MCP code paths naturally have tokens, secrets and authorization headers in
 * hand when they log. Redacting at each call site is necessary but not
 * sufficient - one missed site turns an operator's log stream into a
 * credential store the moment a debug key is enabled - so `lib/debug.ts`
 * applies this to every payload as well. Keys are matched case-insensitively
 * and by suffix so `accessToken`, `access_token`, `refresh_token`,
 * `client_secret`, `Authorization` and friends are all covered.
 */

// @note suffix match in any casing (`accessToken`, `access_token`,
// `x-access-token`, `Authorization`), plus a few exact names; boolean
// flags *about* a credential (`hasClientSecret`, `isTokenValid`) are not
// credentials and stay

const SENSITIVE_SUFFIX =
  /(token|secret|password|passphrase|authorization|cookie|api[_-]?key|private[_-]?key)$/i
const SENSITIVE_EXACT =
  /^(code|id_token|access_token|refresh_token|client_secret)$/i

const FLAG_PREFIX = /^(has|is|with|without|should|needs?)(?=[A-Z_-])/

export const REDACTED = '[redacted]'

export function isSensitiveKey(key: string): boolean {
  if (FLAG_PREFIX.test(key)) {
    return false
  }

  return SENSITIVE_EXACT.test(key) || SENSITIVE_SUFFIX.test(key)
}

/**
 * Returns a copy of `value` with every sensitive field replaced. Cycles are
 * cut, depth is bounded, and non-plain objects (errors, dates, buffers,
 * class instances) are left as they are - they are not the shapes that carry
 * credentials in this codebase, and rewriting them would lose their meaning.
 */
export function scrubSecrets<T>(value: T, depth = 8): T {
  const seen = new WeakSet<object>()

  const walk = (input: unknown, remaining: number): unknown => {
    if (input === null || typeof input !== 'object' || remaining <= 0) {
      return input
    }

    if (seen.has(input)) {
      return '[circular]'
    }

    if (Array.isArray(input)) {
      seen.add(input)

      return input.map((item) => walk(item, remaining - 1))
    }

    if (input instanceof Headers) {
      const out: Record<string, string> = {}

      input.forEach((v, k) => {
        out[k] = isSensitiveKey(k) ? REDACTED : v
      })

      return out
    }

    const proto = Object.getPrototypeOf(input)

    if (proto !== Object.prototype && proto !== null) {
      return input
    }

    seen.add(input)

    const out: Record<string, unknown> = {}

    for (const [key, item] of Object.entries(
      input as Record<string, unknown>
    )) {
      out[key] =
        isSensitiveKey(key) && item !== undefined && item !== null
          ? REDACTED
          : walk(item, remaining - 1)
    }

    return out
  }

  return walk(value, depth) as T
}
