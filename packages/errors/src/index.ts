// @ts-check
import observability from '@chatbotkit-dev/observability'

import joi from 'joi'

/**
 * @todo use from response if possible
 */
export const GENERIC_ERROR_CODE = 'GENERIC_ERROR'
export const TIMEOUT_ERROR_CODE = 'TIMEOUT'
export const BAD_REQUEST_ERROR_CODE = 'BAD_REQUEST'
export const CONFLICT_REQUEST_ERROR_CODE = 'CONFLICT'
export const NOT_FOUND_ERROR_CODE = 'NOT_FOUND'
export const NOT_AUTHENTICATED_ERROR_CODE = 'NOT_AUTHENTICATED'
export const CONTENT_MODERATION_ERROR_CODE = 'CONTENT_MODERATION'

/**
 * Represents any error that is thrown by the system.
 */
/**
 * A value that was thrown. JavaScript lets anything be thrown, and the helpers
 * below exist precisely to make sense of whatever arrived - an `Error`, a
 * string, a plain object from a foreign SDK - so the parameter type is `any`
 * on purpose, declared once here rather than at every signature.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Thrown = any

export class SystemError extends Error {
  public code: string

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public data: any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(message: string, code: string, data?: any) {
    super(message)

    this.code = code
    this.data = data
  }
}

/**
 * Represents an error that is composed of multiple errors.
 */
export class CompositeError extends SystemError {
  public errors: Error[]

  constructor(message: string, code: string, errors: Error[]) {
    super(message, code)

    this.errors = errors
  }
}

/**
 * Represents an error that is safe to show to the user.
 */
export class SafeError extends SystemError {
  constructor(message: string, code: string) {
    super(message, code)
  }
}

/**
 * Represents an error that is not safe to show to the user.
 */
export class UnsafeError extends SystemError {
  constructor(message: string, code: string) {
    super(message, code)
  }
}

/**
 * Represents an error that is related to the user input.
 */
export class UserInputError extends SafeError {
  constructor(message: string) {
    super(message, BAD_REQUEST_ERROR_CODE)
  }
}

/**
 * Represents an error that is related to the user authentication.
 */
export class UserAuthError extends SafeError {
  constructor(message: string) {
    super(message, NOT_AUTHENTICATED_ERROR_CODE)
  }
}

/**
 * Represents an error that is related to a user resource not being found.
 */
export class UserResourceNotFoundError extends SafeError {
  constructor(message: string) {
    super(message, NOT_FOUND_ERROR_CODE)
  }
}

/**
 * Represents an error that is related to bot input.
 */
export class SafeInputError extends SafeError {
  constructor(message: string) {
    super(message, BAD_REQUEST_ERROR_CODE)
  }
}

/**
 * Represents an error that is related to bot input.
 */
export class BotInputError extends SafeError {
  constructor(message: string) {
    super(message, BAD_REQUEST_ERROR_CODE)
  }
}

/**
 * Represents a rejection by a provider-side content moderation / safety filter.
 *
 * @note These are not malformed requests - the provider refused to process the
 * input on policy grounds. They are expected provider behaviour rather than
 * bugs, so they are SafeError (the message is meaningful to the caller) and are
 * excluded from Sentry bug tracking. They deliberately carry no `data` payload
 * so the offending request body is never serialized to a client.
 */
export class ContentModerationError extends SafeError {
  constructor(message: string) {
    super(message, CONTENT_MODERATION_ERROR_CODE)
  }
}

/**
 * Returns true if the error represents a provider content moderation rejection.
 *
 */
export function isContentModerationError(error: Thrown): boolean {
  return (
    error instanceof ContentModerationError ||
    (!!error && error.code === CONTENT_MODERATION_ERROR_CODE)
  )
}

/**
 * Represents an error that is related to user configuration.
 */
export class UserConfigError extends UnsafeError {
  constructor(message: string) {
    super(message, BAD_REQUEST_ERROR_CODE)
  }
}

/**
 * Represents an error that is related to the admin authentication
 */
export class AdminAuthError extends UnsafeError {
  constructor(message: string) {
    super(message, NOT_AUTHENTICATED_ERROR_CODE)
  }
}

/**
 *
 */
export class ObservationError extends Error {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public data?: any

  /**
   * Whether this observation should additionally be reported. Observations are
   * log-only by default; high-signal ones (e.g. stuck-run detections) opt in so
   * they are searchable and carry their context.
   */
  public sentry: boolean

  /**
   * Severity to use when the observation is reported.
   */
  public level: 'info' | 'warning' | 'error'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(message: string, data?: any) {
    super(message)

    if (data !== undefined && data !== null) {
      this.data = data
    }

    this.sentry = false
    this.level = 'warning'
  }
}

/**
 */
export class UnexpectedStateError extends Error {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public data?: any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(message: string, data?: any) {
    super(message)

    if (data !== undefined && data !== null) {
      this.data = data
    }
  }
}

/**
 */
export const KNOWN_PRISMA_ERRORS = [
  // prisma
  // @see https://www.prisma.io/docs/reference/api-reference/error-reference#prismaclientvalidationerror

  'PrismaClientKnownRequestError',
  'PrismaClientUnknownRequestError',
  'PrismaClientRustPanicError',
  'PrismaClientInitializationError',
  'PrismaClientValidationError',
]

/**
 */
export const KNOWN_TIMEOUT_ERRORS = [
  // timeout

  'TimeoutError',
]

/**
 */
export const KNOWN_SUBSCRIPTION_ERRORS = [
  // limits

  'Limits reached',
  'You have exceeded your allocated database limits: database/dataset',
  'You have exceeded your allocated database limits: database/record',
  'You have exceeded your allocated database limits: database/skillset',
  'You have exceeded your allocated database limits: database/ability',
  'You have exceeded your allocated database limits: database/file',
]

/**
 * @returns boolean
 */
export function errorIn(error: Error, collection: string[]) {
  if (!error || typeof error !== 'object') {
    return false
  }

  return collection.includes(error.name) || collection.includes(error.message)
}

export function isKnownError(error: Error|string): boolean {
  if (typeof error === 'string') {
    error = new Error(error)
  }

  for (const collection of [
    KNOWN_PRISMA_ERRORS,
    KNOWN_TIMEOUT_ERRORS,
    KNOWN_SUBSCRIPTION_ERRORS,
  ]) {
    if (errorIn(error, collection)) {
      return true
    }
  }

  return false
}

/**
 * Converts any error to a standardized error response format, which includes a
 * code and a message.
 *
 */
export function errorToErrorResponse(error: Thrown): {
  code: string
  message: string
} {
  // @note handle undefined/null errors explicitly to avoid confusing trace logs

  if (error === undefined || error === null) {
    void captureUnexpectedState('Undefined or null error encountered')

    return { code: GENERIC_ERROR_CODE, message: 'An unknown error occurred' }
  }

  switch (true) {
    case error instanceof SystemError: {
      return { code: error.code, message: error.message.toString() }
    }

    case error instanceof joi.ValidationError: {
      return { code: BAD_REQUEST_ERROR_CODE, message: error.message.toString() }
    }

    case errorIn(error, KNOWN_PRISMA_ERRORS): {
      if (error.code === 'P2002') {
        return {
          code: CONFLICT_REQUEST_ERROR_CODE,
          message: 'Unique constraint violation',
        }
      } else {
        return { code: GENERIC_ERROR_CODE, message: 'System error occurred' }
      }
    }

    case errorIn(error, KNOWN_TIMEOUT_ERRORS): {
      return { code: TIMEOUT_ERROR_CODE, message: 'Response timeout' }
    }

    case error instanceof Error: {
      return { code: GENERIC_ERROR_CODE, message: error.message.toString() }
    }

    case typeof error === 'string': {
      return { code: GENERIC_ERROR_CODE, message: error }
    }

    default: {
      return { code: GENERIC_ERROR_CODE, message: 'Something went wrong' }
    }
  }
}

/**
 * Converts an error to a public error response. Only SafeError messages are
 * exposed; all other errors are intentionally collapsed to a generic response.
 *
 */
export function errorToSafeErrorResponse(error: Thrown): {
  code: string
  message: string
} {
  if (error instanceof SafeError) {
    return errorToErrorResponse(error)
  }

  return {
    code: GENERIC_ERROR_CODE,
    message: 'Something went wrong',
  }
}

/**
 * Converts an error response to a SystemError instance.
 */
export function errorResponseToError(
  errorResponse: { code: string; message: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
): SystemError {
  return new SystemError(errorResponse.message, errorResponse.code, data)
}

/**
 * Converts any error to a SystemError instance.
 *
 */
export function errorToSystemError(error: Thrown, data?: unknown): SystemError {
  if (error instanceof SystemError) {
    return error
  }

  const systemError = errorResponseToError(errorToErrorResponse(error), data)

  // @note preserve the original error as the `cause` so its underlying detail
  // (e.g. an undici "terminated" whose real reason lives on its own `cause`)
  // survives normalization and can be surfaced to Sentry via
  // `extractCauseChain`. Defined non-enumerable - matching native `Error.cause`
  // semantics - so that even an accidental raw serialization of the
  // `SystemError` (e.g. `JSON.stringify`) can never leak the underlying error
  // to the client. Client-facing responses only ever expose `{code, message}`
  // via `errorToErrorResponse`/`errorToSafeErrorResponse`.

  if (error instanceof Error) {
    Object.defineProperty(systemError, 'cause', {
      value: error,
      enumerable: false,
      configurable: true,
      writable: true,
    })
  }

  return systemError
}

export async function logError(e: Thrown): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line
    console.error(e)
  }
}

export async function debugError(e: Thrown): Promise<void> {
  if (!!process.env.DEBUG) {
    // eslint-disable-next-line
    console.error(e)
  }
}

export function setTag(name: string, value: string) {
  observability.setTag(name, value)
}

/**
 * Handles an `ObservationError`: always logs it, and additionally reports it to
 * Sentry as a (non-exception) message when the observation opted in via
 * `sentry`. Observations are not bugs, so they are sent with their own severity
 * and a stable fingerprint (keyed on the observation `event`) so related stuck
 * runs group together and carry the supporting context needed to troubleshoot.
 *
 */
function reportObservation(e: ObservationError): void {
  // eslint-disable-next-line
  console.log(`ObservationError: ${e.message}`)

  if (!e.sentry) {
    return
  }

  const event = e.data?.event

  try {
    observability.captureMessage(e.message, {
      level: e.level || 'warning',
      tags: { observation: event || 'observation' },
      fingerprint: ['observation', event || e.message],
      extra: e.data || undefined,
    })
  } catch (err) {
    // eslint-disable-next-line
    console.error(err)
  }
}

const MAX_CAUSE_DEPTH = 5

/**
 * Walks the `cause` chain of an error and returns a compact, serializable
 * summary of each link.
 *
 * This is what lets us see *why* an otherwise opaque error happened. A Node
 * `fetch` (undici) failure, for example, surfaces only as `Error: terminated`
 * while the real reason - `ECONNRESET`, "other side closed", a body timeout -
 * lives on `error.cause`. We attach this chain to the Sentry event server-side
 * only (as `extra.cause`); it is never emitted to the client, which only ever
 * sees `{code, message}` via `errorToErrorResponse`/`errorToSafeErrorResponse`.
 *
 */
export function extractCauseChain(
  error: Thrown
):
  | Array<{ name?: string; message?: string; code?: string }>
  | undefined {
  /** @type {Array<{name?: string, message?: string, code?: string}>} */
  const chain: {
    name: string | undefined
    message: string | undefined
    code: string | undefined
  }[] = []

  const seen = new Set()

  let current = error?.cause

  while (
    current !== undefined &&
    current !== null &&
    chain.length < MAX_CAUSE_DEPTH &&
    !seen.has(current)
  ) {
    seen.add(current)

    chain.push({
      name: typeof current.name === 'string' ? current.name : undefined,

      message:
        typeof current.message === 'string'
          ? current.message
          : typeof current === 'string'
            ? current
            : undefined,

      code:
        current.code !== undefined && current.code !== null
          ? String(current.code)
          : undefined,
    })

    current = typeof current === 'object' ? current.cause : undefined
  }

  return chain.length > 0 ? chain : undefined
}

/**
 * Builds the Sentry capture context for an error, merging any existing
 * `error.data` context with the serialized `cause` chain (under `extra.cause`).
 *
 * When the error has no cause, the original `error.data` is returned untouched
 * - preserving reference identity and the prior capture behaviour.
 *
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCaptureContext(e: Thrown): any {
  const cause = extractCauseChain(e)

  const data = e?.data

  if (!cause) {
    return data ?? undefined
  }

  // @note merge the cause into a structured `extra` without clobbering any
  // context the error already carries. If `data` is not a plain object (e.g. a
  // raw string passed as context) keep it intact alongside the cause.

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return {
      ...data,

      extra: {
        ...(data.extra && typeof data.extra === 'object' ? data.extra : {}),

        cause,
      },
    }
  }

  return {
    extra: data === undefined ? { cause } : { cause, data },
  }
}

export async function captureError(e: Thrown): Promise<void> {
  // @note it is important to exclude some errors from being logged or even sent
  // to Sentry, because it is a user-facing error that contains sensitive
  // information

  if (e instanceof UserAuthError) {
    // eslint-disable-next-line
    console.log(`UserAuthError: ${e.message}`)

    return
  }

  if (e instanceof UserInputError) {
    // eslint-disable-next-line
    console.log(`UserInputError: ${e.message}`)

    return
  }

  if (e instanceof BotInputError) {
    // eslint-disable-next-line
    console.log(`BotInputError: ${e.message}`)

    return
  }

  if (e instanceof UserConfigError) {
    // eslint-disable-next-line
    console.log(`UserConfigError: ${e.message}`)

    return
  }

  // @note content moderation rejections are expected provider behaviour, not
  // bugs - log them but keep them out of Sentry
  if (e instanceof ContentModerationError) {
    // eslint-disable-next-line
    console.log(`ContentModerationError: ${e.message}`)

    return
  }

  // @note ObservationError is for logging/analysis, not bug tracking - but an
  // observation may opt in to Sentry (as a message, not an exception)
  if (e instanceof ObservationError) {
    reportObservation(e)

    return
  }

  // eslint-disable-next-line
  console.error(e)

  // @note only trace if error has a stack property to avoid "Trace: undefined"
  if (e?.stack) {
    // eslint-disable-next-line
    console.trace(e)
  }

  try {
    await observability.captureException(e, buildCaptureContext(e))
  } catch (e) {
    // eslint-disable-next-line
    console.error(e)
  }
}

export async function captureException(e: Thrown): Promise<void> {
  // @note it is important to exclude some errors from being logged or even sent
  // to Sentry, because it is a user-facing error that contains sensitive
  // information

  if (e instanceof UserAuthError) {
    // eslint-disable-next-line
    console.log(`UserAuthError: ${e.message}`)

    return
  }

  if (e instanceof UserInputError) {
    // eslint-disable-next-line
    console.log(`UserInputError: ${e.message}`)

    return
  }

  if (e instanceof BotInputError) {
    // eslint-disable-next-line
    console.log(`BotInputError: ${e.message}`)

    return
  }

  if (e instanceof UserConfigError) {
    // eslint-disable-next-line
    console.log(`UserConfigError: ${e.message}`)

    return
  }

  // @note content moderation rejections are expected provider behaviour, not
  // bugs - log them but keep them out of Sentry
  if (e instanceof ContentModerationError) {
    // eslint-disable-next-line
    console.log(`ContentModerationError: ${e.message}`)

    return
  }

  // @note ObservationError is for logging/analysis, not bug tracking - but an
  // observation may opt in to Sentry (as a message, not an exception)
  if (e instanceof ObservationError) {
    reportObservation(e)

    return
  }

  // eslint-disable-next-line
  console.error(e)

  // @note only trace if error has a stack property to avoid "Trace: undefined"
  if (e?.stack) {
    // eslint-disable-next-line
    console.trace(e)
  }

  try {
    await observability.captureException(e, buildCaptureContext(e))
  } catch (e) {
    // eslint-disable-next-line
    console.error(e)
  }
}

export async function captureInputError(e: Thrown, data: unknown): Promise<void> {
  // eslint-disable-next-line
  console.error(e)

  // @note only trace if error has a stack property to avoid "Trace: undefined"
  if (e?.stack) {
    // eslint-disable-next-line
    console.trace(e)
  }

  try {
    await observability.captureException(e, { extra: { data } })
  } catch (e) {
    // eslint-disable-next-line
    console.error(e)
  }
}

export async function captureObservation(
  message: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any,
  options: { sentry?: boolean; level?: 'info' | 'warning' | 'error' } = {}
): Promise<void> {
  const error = new ObservationError(message, context)

  if (options.sentry) {
    error.sentry = true
    error.level = options.level || 'warning'
  }

  await captureError(error)
}

export async function captureUnexpectedState(
  message: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any
): Promise<void> {
  await captureError(new UnexpectedStateError(message, context))
}
