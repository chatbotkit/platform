import { SystemError } from '@/lib/error'
import {
  RETRIABLE_ERROR_PATTERNS,
  getErrorStatus,
  isRetriableError,
  isRetriableStatus,
} from '@/lib/model.retry'

// @note the exact message the Vercel AI Gateway returned when it 503'd on
// zai/glm-5.2, which the old `/service unavailable/i` pattern did not match -
// "temporarily" sits between the two words - so the error was treated as
// terminal and hard-failed the task run instead of being retried.
const GATEWAY_503_MESSAGE =
  'Service temporarily unavailable. Please try again shortly. (503)'

describe('getErrorStatus', () => {
  it('should read the status appended to a provider error message', () => {
    expect(getErrorStatus(new Error(GATEWAY_503_MESSAGE))).toBe(503)
    expect(getErrorStatus('Internal server error (500)')).toBe(500)
  })

  it('should read the status from a normalized SystemError code', () => {
    expect(
      getErrorStatus(new SystemError('boom', 'VR_SERVICE_UNAVAILABLE'))
    ).toBe(503)
    expect(
      getErrorStatus(new SystemError('boom', 'OI_INTERNAL_SERVER_ERROR'))
    ).toBe(500)
    expect(getErrorStatus(new SystemError('boom', 'VR_NOT_FOUND'))).toBe(404)
  })

  it('should read a direct status field', () => {
    expect(getErrorStatus({ status: 502 })).toBe(502)
    expect(getErrorStatus({ statusCode: 504 })).toBe(504)
    expect(getErrorStatus({ response: { status: 503 } })).toBe(503)
  })

  it('should return undefined when no status is present', () => {
    expect(getErrorStatus(new Error('Bad gateway'))).toBeUndefined()
    expect(getErrorStatus('Rate limit exceeded')).toBeUndefined()
    expect(getErrorStatus(null)).toBeUndefined()
  })
})

describe('isRetriableStatus', () => {
  it('should treat 5xx as retriable', () => {
    expect(isRetriableStatus(500)).toBe(true)
    expect(isRetriableStatus(502)).toBe(true)
    expect(isRetriableStatus(503)).toBe(true)
    expect(isRetriableStatus(504)).toBe(true)
  })

  it('should not treat 4xx as retriable', () => {
    expect(isRetriableStatus(400)).toBe(false)
    expect(isRetriableStatus(401)).toBe(false)
    expect(isRetriableStatus(404)).toBe(false)

    // @note a rate limit needs Retry-After backoff, not this tight retry loop
    expect(isRetriableStatus(429)).toBe(false)
  })
})

describe('isRetriableError', () => {
  it('should retry the gateway 503 that hard-failed the task run', () => {
    expect(isRetriableError(new Error(GATEWAY_503_MESSAGE))).toBe(true)
    expect(isRetriableError(GATEWAY_503_MESSAGE)).toBe(true)
    expect(
      isRetriableError(
        new SystemError(GATEWAY_503_MESSAGE, 'VR_SERVICE_UNAVAILABLE')
      )
    ).toBe(true)
  })

  it('should retry other transient 5xx failures', () => {
    expect(isRetriableError('Internal server error (500)')).toBe(true)
    expect(isRetriableError('Bad gateway (502)')).toBe(true)
    expect(isRetriableError('Service unavailable (503)')).toBe(true)
    expect(isRetriableError('Gateway timeout (504)')).toBe(true)
    expect(isRetriableError({ status: 500 })).toBe(true)
  })

  it('should retry status-less errors that match a known pattern', () => {
    expect(isRetriableError('Provider returned error')).toBe(true)
    expect(isRetriableError('Internal server error')).toBe(true)
    expect(isRetriableError('Bad gateway')).toBe(true)
    expect(isRetriableError('Service unavailable')).toBe(true)
    expect(isRetriableError('Gateway timeout')).toBe(true)
    expect(isRetriableError('The model is overloaded')).toBe(true)
  })

  it('should match case-insensitively', () => {
    expect(isRetriableError('INTERNAL SERVER ERROR')).toBe(true)
    expect(isRetriableError('provider RETURNED error')).toBe(true)
  })

  it('should let the status overrule a misleading message', () => {
    // @note the gemini-3.1-flash-lite 404 - the word "unavailable" appears, but
    // a missing publisher model is terminal and must never be retried
    expect(
      isRetriableError(
        new SystemError(
          'Publisher model gemini-3.1-flash-lite-preview was not found or your project does not have access to it. (404)',
          'VR_NOT_FOUND'
        )
      )
    ).toBe(false)
  })

  it('should not retry client errors', () => {
    expect(isRetriableError('Invalid API key')).toBe(false)
    expect(isRetriableError('Rate limit exceeded')).toBe(false)
    expect(isRetriableError('Model not found')).toBe(false)
    expect(isRetriableError('Unauthorized (401)')).toBe(false)
    expect(isRetriableError(null)).toBe(false)
    expect(isRetriableError(undefined)).toBe(false)
  })
})

describe('RETRIABLE_ERROR_PATTERNS', () => {
  it('should have patterns for common 5xx errors', () => {
    expect(RETRIABLE_ERROR_PATTERNS.length).toBeGreaterThanOrEqual(5)
  })
})
