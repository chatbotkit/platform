import { codeToStatusMap } from '@/lib/response'

/**
 * Patterns for errors that should be retried, used as a *fallback* when the
 * error carries no recoverable HTTP status (see `getErrorStatus`).
 *
 * @note matching on prose is inherently fragile - gateways word the same status
 * differently ("Service unavailable" vs "Service temporarily unavailable"), and
 * a wording the list does not anticipate silently turns a transient blip into a
 * terminal failure (a Vercel AI Gateway 503 phrased "Service
 * temporarily unavailable" slipped past `/service unavailable/i` and hard-failed
 * task runs). Prefer the status; keep these only for errors that never carry one.
 */
export const RETRIABLE_ERROR_PATTERNS: RegExp[] = [
  /provider returned error/i,
  /internal server error/i,
  /bad gateway/i,
  // @note tolerate an adverb between the two words - "service temporarily
  // unavailable", "service currently unavailable", as well as the bare form
  /service\s+(?:\w+\s+)?unavailable/i,
  /temporarily unavailable/i,
  /gateway timeout/i,
  /\boverloaded\b/i,
]

/**
 * The inclusive HTTP status range treated as transient. A 5xx means the upstream
 * failed to serve a request that is, as far as we can tell, well formed - so
 * re-issuing it is worthwhile. 4xx are deliberately excluded: they are caused by
 * the request itself (a bad key, a model the provider does not have) and retrying
 * only burns the budget. 429 is excluded too - a rate limit needs `Retry-After`
 * backoff rather than this tight retry loop, and retrying it aggressively makes
 * the throttling worse.
 */
const RETRIABLE_STATUS_MIN = 500
const RETRIABLE_STATUS_MAX = 599

/**
 * Strips the provider prefix a normalized error code carries (`VR_`, `OI_`, ...)
 * so it can be looked up in the shared code -> status map.
 */
function stripErrorCodePrefix(code: string): string {
  return code.replace(/^[A-Z]{2,4}_/, '')
}

/**
 * Recovers the HTTP status behind an error, if it carries one.
 *
 * Provider errors reach us as a `SystemError` whose `code` is the normalized
 * status name prefixed per provider (e.g. `VR_SERVICE_UNAVAILABLE`), and whose
 * message has the raw status appended by `getOpenAIError` (e.g. `... (503)`).
 * Either is a far more reliable signal than the prose, so we try both before
 * falling back to pattern matching.
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      status?: unknown
      statusCode?: unknown
      code?: unknown
      response?: { status?: unknown }
    }

    // @note direct status fields, as attached by fetch-style and SDK errors

    for (const status of [
      candidate.status,
      candidate.statusCode,
      candidate.response?.status,
    ]) {
      if (typeof status === 'number' && status >= 100 && status <= 599) {
        return status
      }
    }

    // @note normalized SystemError code (e.g. `VR_SERVICE_UNAVAILABLE`)

    if (typeof candidate.code === 'string' && candidate.code) {
      const status =
        codeToStatusMap[candidate.code] ??
        codeToStatusMap[stripErrorCodePrefix(candidate.code)]

      if (typeof status === 'number') {
        return status
      }
    }
  }

  // @note the status `getOpenAIError` appends to the message, e.g.
  // "Service temporarily unavailable. Please try again shortly. (503)"

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : ''

  const match = message.match(/\((\d{3})\)\s*$/)

  if (match) {
    const status = Number(match[1])

    if (status >= 100 && status <= 599) {
      return status
    }
  }

  return undefined
}

/**
 * Whether an HTTP status should be retried.
 */
export function isRetriableStatus(status: number): boolean {
  return status >= RETRIABLE_STATUS_MIN && status <= RETRIABLE_STATUS_MAX
}

/**
 * Check whether an error is a transient provider/gateway failure worth retrying.
 *
 * The status - when the error carries one - is authoritative in both directions:
 * a 5xx retries, and a 4xx does not, no matter what the message happens to say.
 * Only a status-less error falls through to the message patterns.
 */
export function isRetriableError(error: unknown): boolean {
  const status = getErrorStatus(error)

  if (status !== undefined) {
    return isRetriableStatus(status)
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : ''

  if (!message) {
    return false
  }

  return RETRIABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}
