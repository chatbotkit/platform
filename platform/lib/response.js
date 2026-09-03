// @ts-check

/* eslint-disable no-console */
import {
  BAD_GATEWAY_CODE,
  BAD_GATEWAY_MESSAGE,
  BAD_GATEWAY_STATUS,
  BAD_REQUEST_CODE,
  BAD_REQUEST_MESSAGE,
  BAD_REQUEST_STATUS,
  CONFLICT_CODE,
  CONFLICT_MESSAGE,
  CONFLICT_STATUS,
  CREATED_STATUS,
  FAILURE_CODE_HEADER_NAME,
  GATEWAY_TIMEOUT_CODE,
  GATEWAY_TIMEOUT_MESSAGE,
  GATEWAY_TIMEOUT_STATUS,
  INTERNAL_SERVER_ERROR_CODE,
  INTERNAL_SERVER_ERROR_MESSAGE,
  INTERNAL_SERVER_ERROR_STATUS,
  LIMITS_REACHED_CODE,
  LIMITS_REACHED_MESSAGE,
  LIMITS_REACHED_STATUS,
  METHOD_NOT_ALLOWED_CODE,
  METHOD_NOT_ALLOWED_MESSAGE,
  METHOD_NOT_ALLOWED_STATUS,
  NOT_AUTHENTICATED_CODE,
  NOT_AUTHENTICATED_MESSAGE,
  NOT_AUTHENTICATED_STATUS,
  NOT_AUTHORIZED_CODE,
  NOT_AUTHORIZED_MESSAGE,
  NOT_AUTHORIZED_STATUS,
  NOT_FOUND_CODE,
  NOT_FOUND_MESSAGE,
  NOT_FOUND_STATUS,
  NOT_IMPLEMENTED_CODE,
  NOT_IMPLEMENTED_MESSAGE,
  NOT_IMPLEMENTED_STATUS,
  NOT_MODIFIED_CODE,
  NOT_MODIFIED_MESSAGE,
  NOT_MODIFIED_STATUS,
  NO_CONTENT_STATUS,
  NO_SUBSCRIPTION_CODE,
  NO_SUBSCRIPTION_MESSAGE,
  NO_SUBSCRIPTION_STATUS,
  OK_STATUS,
  SERVICE_UNAVAILABLE_CODE,
  SERVICE_UNAVAILABLE_MESSAGE,
  SERVICE_UNAVAILABLE_STATUS,
  TIMEOUT_CODE,
  TIMEOUT_MESSAGE,
  TIMEOUT_STATUS,
  TOO_MANY_REQUESTS_CODE,
  TOO_MANY_REQUESTS_MESSAGE,
  TOO_MANY_REQUESTS_STATUS,
  UNPROCESSABLE_ENTITY_CODE,
  UNPROCESSABLE_ENTITY_STATUS,
  UNPROCESSABLE_ENTITY_STATUS_MESSAGE,
  codeToStatusMap,
  knownExpectedCodes,
  messageToCodeMap,
} from '@chatbotkit-dev/http-codes'

import {
  SystemError,
  captureError,
  captureException,
  errorToErrorResponse,
} from '@/lib/error'
import { stringify } from '@/lib/json'
import { makeJsonSafe } from '@/lib/struct'

// @note the status and failure code vocabulary moved to a package so the
// platform's fetch client can share it without depending on these handlers.

export * from '@chatbotkit-dev/http-codes'

// @note error codes this application treats as expected alongside the HTTP
// ones. They are not HTTP codes: one comes from prisma, the other from the
// channel layer.

export const knownExpectedCodesExtra = [
  'P2002', // @note prisma specific for unique constraint violation
  'no_message_received_aborted', // @note channel wait timeout - expected behavior when AI takes too long
]

/**
 * @param {unknown} data
 * @returns {string}
 */
function json(data) {
  return stringify(makeJsonSafe(data))
}

// @todo split this into multiple files

/**
 * @param {any} [data]
 * @param {HeadersInit} [headers]
 * @returns {Response}
 */
export function send(data = null, headers = {}) {
  return new Response(data, {
    status: OK_STATUS,
    headers: headers,
  })
}

/**
 * @param {object} [data]
 * @param {HeadersInit} [headers]
 * @returns {Response}
 */
export function ok(data = {}, headers = {}) {
  const combinedHeaders = new Headers(headers)

  combinedHeaders.append('Content-Type', 'application/json')

  return new Response(json(data), {
    status: OK_STATUS,
    headers: combinedHeaders,
  })
}

/**
 * @param {object} [data]
 * @param {HeadersInit} [headers]
 * @returns {Response}
 */
export function created(data = {}, headers = {}) {
  const combinedHeaders = new Headers(headers)

  combinedHeaders.append('Content-Type', 'application/json')

  return new Response(json(data), {
    status: CREATED_STATUS,
    headers: combinedHeaders,
  })
}

/**
 * @returns {Response}
 */
export function noContent() {
  return new Response(null, {
    status: NO_CONTENT_STATUS,
  })
}

/**
 * @param {URL} location
 * @param {Record<string,any>} [headers]
 * @returns {Response}
 */
export function redirect(location, headers = {}) {
  // @note on edge functions the URL must be a fully qualified URL, therefore
  // instead of using a string we use a URL object

  const combinedHeaders = new Headers(headers)

  combinedHeaders.append('Location', location.href)

  return new Response(null, {
    status: 302,
    headers: combinedHeaders,
  })
}

/**
 * @param {string} [message]
 * @returns {Response}
 */
export function notModified(message = NOT_MODIFIED_MESSAGE) {
  message

  // @note status 304 does not allow a body, therefore we return null

  return new Response(null, {
    status: NOT_MODIFIED_STATUS,
  })
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwNotModified(message = NOT_MODIFIED_MESSAGE) {
  throw new SystemError(message, NOT_MODIFIED_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function badRequest(message = BAD_REQUEST_MESSAGE) {
  return new Response(
    json(
      typeof message === 'object' && message !== null
        ? message
        : { message: String(message), code: BAD_REQUEST_CODE }
    ),
    {
      status: BAD_REQUEST_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwBadRequest(message = BAD_REQUEST_MESSAGE) {
  throw new SystemError(message, BAD_REQUEST_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function notAuthenticated(message = NOT_AUTHENTICATED_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: NOT_AUTHENTICATED_CODE }
        : message
    ),
    {
      status: NOT_AUTHENTICATED_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwNotAuthenticated(message = NOT_AUTHENTICATED_MESSAGE) {
  throw new SystemError(message, NOT_AUTHENTICATED_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function notAuthorized(message = NOT_AUTHORIZED_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: NOT_AUTHORIZED_CODE }
        : message
    ),
    {
      status: NOT_AUTHORIZED_STATUS,
      headers: {
        'Content-Type': 'application/json',
        [FAILURE_CODE_HEADER_NAME]: NOT_AUTHORIZED_CODE,
      },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwNotAuthorized(message = NOT_AUTHORIZED_MESSAGE) {
  throw new SystemError(message, NOT_AUTHORIZED_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function noSubscription(message = NO_SUBSCRIPTION_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: NO_SUBSCRIPTION_CODE }
        : message
    ),
    {
      status: NO_SUBSCRIPTION_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwNoSubscription(message = NO_SUBSCRIPTION_MESSAGE) {
  throw new SystemError(message, NO_SUBSCRIPTION_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function notFound(message = NOT_FOUND_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: NOT_FOUND_CODE }
        : message
    ),
    {
      status: NOT_FOUND_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwNotFound(message = NOT_FOUND_MESSAGE) {
  throw new SystemError(message, NOT_FOUND_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function methodNotAllowed(message = METHOD_NOT_ALLOWED_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: METHOD_NOT_ALLOWED_CODE }
        : message
    ),
    {
      status: METHOD_NOT_ALLOWED_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwMethodNotAllowed(message = METHOD_NOT_ALLOWED_MESSAGE) {
  throw new SystemError(message, METHOD_NOT_ALLOWED_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function timeout(message = TIMEOUT_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: TIMEOUT_CODE }
        : message
    ),
    {
      status: TIMEOUT_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwTimeout(message = TIMEOUT_MESSAGE) {
  throw new SystemError(message, TIMEOUT_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function conflict(message = CONFLICT_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: CONFLICT_CODE }
        : message
    ),
    {
      status: CONFLICT_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwConflict(message = CONFLICT_MESSAGE) {
  throw new SystemError(message, CONFLICT_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function unprocessableEntity(
  message = UNPROCESSABLE_ENTITY_STATUS_MESSAGE
) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: UNPROCESSABLE_ENTITY_CODE }
        : message
    ),
    {
      status: UNPROCESSABLE_ENTITY_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwUnprocessableEntity(
  message = UNPROCESSABLE_ENTITY_STATUS_MESSAGE
) {
  throw new SystemError(message, UNPROCESSABLE_ENTITY_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function tooManyRequests(message = TOO_MANY_REQUESTS_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: TOO_MANY_REQUESTS_CODE }
        : message
    ),
    {
      status: TOO_MANY_REQUESTS_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwTooManyRequests(message = TOO_MANY_REQUESTS_MESSAGE) {
  throw new SystemError(message, TOO_MANY_REQUESTS_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function limitsReached(message = LIMITS_REACHED_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: LIMITS_REACHED_CODE }
        : message
    ),
    {
      status: LIMITS_REACHED_STATUS,
      headers: {
        'Content-Type': 'application/json',
        [FAILURE_CODE_HEADER_NAME]: LIMITS_REACHED_CODE,
      },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwLimitsReached(message = LIMITS_REACHED_MESSAGE) {
  throw new SystemError(message, LIMITS_REACHED_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function internalServerError(message = INTERNAL_SERVER_ERROR_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: INTERNAL_SERVER_ERROR_CODE }
        : message
    ),
    {
      status: INTERNAL_SERVER_ERROR_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwInternalServerError(
  message = INTERNAL_SERVER_ERROR_MESSAGE
) {
  throw new SystemError(message, INTERNAL_SERVER_ERROR_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function notImplemented(message = NOT_IMPLEMENTED_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: NOT_IMPLEMENTED_CODE }
        : message
    ),
    {
      status: NOT_IMPLEMENTED_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwNotImplemented(message = NOT_IMPLEMENTED_MESSAGE) {
  throw new SystemError(message, NOT_IMPLEMENTED_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function badGateway(message = BAD_GATEWAY_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: BAD_GATEWAY_CODE }
        : message
    ),
    {
      status: BAD_GATEWAY_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwBadGateway(message = BAD_GATEWAY_MESSAGE) {
  throw new SystemError(message, BAD_GATEWAY_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function serviceUnavailable(message = SERVICE_UNAVAILABLE_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: SERVICE_UNAVAILABLE_CODE }
        : message
    ),
    {
      status: SERVICE_UNAVAILABLE_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwServiceUnavailable(message = SERVICE_UNAVAILABLE_MESSAGE) {
  throw new SystemError(message, SERVICE_UNAVAILABLE_CODE)
}

/**
 * @param {string|Record<string,any>} [message]
 * @returns {Response}
 */
export function gatewayTimeout(message = GATEWAY_TIMEOUT_MESSAGE) {
  return new Response(
    json(
      typeof message === 'string'
        ? { message: String(message), code: GATEWAY_TIMEOUT_CODE }
        : message
    ),
    {
      status: GATEWAY_TIMEOUT_STATUS,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * @param {string} message
 * @returns {never}
 * @throws {Error}
 */
export function throwGatewayTimeout(message = GATEWAY_TIMEOUT_MESSAGE) {
  throw new SystemError(message, GATEWAY_TIMEOUT_CODE)
}

/**
 * @param {any} error
 * @returns {Response}
 */
export function genericError(error) {
  /* eslint-disable-next-line no-console */
  console.error(error)

  error = errorToErrorResponse(error)

  let status = codeToStatusMap[error.code] || error.code

  if (typeof status === 'number' && status >= 400 && status < 600) {
    status = status
  } else {
    status = INTERNAL_SERVER_ERROR_STATUS
  }

  return new Response(json(error), {
    status: status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * @param {any} error
 * @returns {Response}
 */
export function respondFromError(error) {
  switch (error.code) {
    case NOT_MODIFIED_STATUS:
    case NOT_MODIFIED_CODE:
      return notModified(error.message)

    case BAD_REQUEST_STATUS:
    case BAD_REQUEST_CODE:
      return badRequest(error.message)

    case NOT_AUTHENTICATED_STATUS:
    case NOT_AUTHENTICATED_CODE:
      return notAuthenticated(error.message)

    case NOT_AUTHORIZED_STATUS:
    case NOT_AUTHORIZED_CODE:
      return notAuthorized(error.message)

    case NO_SUBSCRIPTION_STATUS:
    case NO_SUBSCRIPTION_CODE:
      return noSubscription(error.message)

    case NOT_FOUND_STATUS:
    case NOT_FOUND_CODE:
      return notFound(error.message)

    case METHOD_NOT_ALLOWED_STATUS:
    case METHOD_NOT_ALLOWED_CODE:
      return methodNotAllowed(error.message)

    case TIMEOUT_STATUS:
    case TIMEOUT_CODE:
      return timeout(error.message)

    case CONFLICT_STATUS:
    case CONFLICT_CODE:
      return conflict(error.message)

    case UNPROCESSABLE_ENTITY_STATUS:
    case UNPROCESSABLE_ENTITY_CODE:
      return unprocessableEntity(error.message)

    case TOO_MANY_REQUESTS_STATUS:
    case TOO_MANY_REQUESTS_CODE:
      return tooManyRequests(error.message)

    case LIMITS_REACHED_STATUS:
    case LIMITS_REACHED_CODE:
      return limitsReached(error.message)

    case SERVICE_UNAVAILABLE_STATUS:
    case SERVICE_UNAVAILABLE_CODE:
      return serviceUnavailable(error.message)

    case GATEWAY_TIMEOUT_STATUS:
    case GATEWAY_TIMEOUT_CODE:
      return gatewayTimeout(error.message)

    default:
      return genericError(error)
  }
}

/**
 * @param {any} error
 * @returns {string}
 */
export function codeFromError(error) {
  if (!error || typeof error !== 'object') {
    return INTERNAL_SERVER_ERROR_CODE
  }

  if (error.code) {
    return error.code || INTERNAL_SERVER_ERROR_CODE
  }

  if (error.message) {
    return messageToCodeMap[error.message] || INTERNAL_SERVER_ERROR_CODE
  }

  return INTERNAL_SERVER_ERROR_CODE
}

/**
 * @param {any} e
 * @returns {boolean}
 */
export function isUnknownError(e) {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    return (
      !knownExpectedCodes.includes(e.code) &&
      !knownExpectedCodesExtra.includes(e.code)
    )
  }

  return true
}

/**
 * @param {any} e
 * @returns {Promise<void>}
 */
export async function captureUnknownError(e) {
  if (isUnknownError(e)) {
    await captureError(e)
  }

  // @note removed observational logging for expected errors - these are
  // business logic errors (NOT_AUTHORIZED, BAD_REQUEST, etc.) that don't
  // need to be logged as they're intentional responses, not bugs
}

/**
 * @param {any} e
 * @returns {Promise<void>}
 */
export async function captureUnknownException(e) {
  if (isUnknownError(e)) {
    await captureException(e)
  }

  // @note removed observational logging for expected errors - these are
  // business logic errors (NOT_AUTHORIZED, BAD_REQUEST, etc.) that don't
  // need to be logged as they're intentional responses, not bugs
}
