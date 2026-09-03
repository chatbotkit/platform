import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import { API_AUDIENCE, USER_AUDIENCE } from '@/lib/audience.consts'
import { sign } from '@/lib/jwt'

/**
 * Retrieve a temporary user token for the specified user ID.
 *
 * @param userId - The user ID for which to generate the token
 * @param options - Optional configuration for the token
 * @param options.durationInSeconds - Token validity duration in seconds (default: 900 / 15 minutes)
 * @param options.allowedRoutes - Optional array of glob patterns to restrict token usage to specific URL paths.
 *                                Supports wildcards (*), globstars (**), and negation (!pattern).
 *                                If not provided, token has no path restrictions.
 * @returns A JWT token string
 *
 * @example
 * ```typescript
 * // Token with no restrictions
 * const token = await getTemporaryUserToken('user-123')
 *
 * // Token restricted to bot endpoints only
 * const token = await getTemporaryUserToken('user-123', {
 *   allowedRoutes: ['/api/v1/bot/**']
 * })
 *
 * // Token with multiple allowed patterns
 * const token = await getTemporaryUserToken('user-123', {
 *   allowedRoutes: ['/api/v1/bot/**', '/api/v1/dataset/**']
 * })
 *
 * // Token allowing all except admin endpoints
 * const token = await getTemporaryUserToken('user-123', {
 *   allowedRoutes: ['/api/v1/**', '!/api/v1/admin/**']
 * })
 * ```
 *
 * @deprecated use getTemporarySessionToken instead
 */
export async function getTemporaryUserToken(
  userId: string, // @todo use more specific type, i.e. a user object
  options?: {
    durationInSeconds?: number
    allowedRoutes?: string[]
    contactId?: string
    namespace?: string
  }
): Promise<string> {
  // @todo use the proper type for payload

  const payload: {
    userId: string
    allowedRoutes?: string[]
    contactId?: string
    namespace?: string
  } = {
    userId: userId,
  }

  // @note include allowedRoutes in payload if provided to restrict token usage
  // to specific URL paths defined by glob patterns - empty array blocks all
  // routes

  if (options?.allowedRoutes) {
    payload.allowedRoutes = options.allowedRoutes
  }

  // @note include contactId and namespace if provided

  if (options?.contactId) {
    payload.contactId = options.contactId
  }

  if (options?.namespace) {
    payload.namespace = options.namespace
  }

  // @note the default value is set to 15 minutes because we want to make sure
  // it can be used in subsequent requests, but not too long so it can be used
  // securely

  const durationInSeconds =
    options?.durationInSeconds ?? QUARTER_HOUR_IN_SECONDS

  const result = await sign(payload, durationInSeconds, USER_AUDIENCE)

  return result
}

/**
 * Retrieve a temporary session token for the specified session.
 *
 * @param session - The session object containing id and user information
 * @param options - Optional configuration for the token
 * @param options.durationInSeconds - Token validity duration in seconds (default: 900 / 15 minutes)
 * @param options.allowedRoutes - Optional array of glob patterns to restrict token usage to specific URL paths.
 *                                Supports wildcards (*), globstars (**), and negation (!pattern).
 *                                If not provided, token has no path restrictions.
 * @returns A JWT token string
 *
 * @example
 * ```typescript
 * // Token with no restrictions
 * const token = await getTemporarySessionToken(session)
 *
 * // Token restricted to bot endpoints only
 * const token = await getTemporarySessionToken(session, {
 *   allowedRoutes: ['/api/v1/bot/**']
 * })
 *
 * // Token with multiple allowed patterns
 * const token = await getTemporarySessionToken(session, {
 *   allowedRoutes: ['/api/v1/bot/**', '/api/v1/dataset/**']
 * })
 *
 * // Token allowing all except admin endpoints
 * const token = await getTemporarySessionToken(session, {
 *   allowedRoutes: ['/api/v1/**', '!/api/v1/admin/**']
 * })
 * ```
 */
export async function getTemporaryUserSessionToken(
  session: { id: string; user: { id: string } }, // @todo use more specific type
  options?: {
    durationInSeconds?: number
    allowedRoutes?: string[]
    contactId?: string
    namespace?: string
  }
): Promise<string> {
  // @todo use the proper type for payload

  const payload: {
    sub: string
    userId: string
    allowedRoutes?: string[]
    contactId?: string
    namespace?: string
  } = {
    sub: session.id,
    userId: session.user.id,
  }

  // @note include allowedRoutes in payload if provided to restrict token usage
  // to specific URL paths defined by glob patterns - empty array blocks all
  // routes

  if (options?.allowedRoutes) {
    payload.allowedRoutes = options.allowedRoutes
  }

  // @note include contactId and namespace if provided

  if (options?.contactId) {
    payload.contactId = options.contactId
  }

  if (options?.namespace) {
    payload.namespace = options.namespace
  }

  // @note the default value is set to 15 minutes because we want to make sure
  // it can be used in subsequent requests, but not too long so it can be used
  // securely

  const durationInSeconds =
    options?.durationInSeconds ?? QUARTER_HOUR_IN_SECONDS

  const result = await sign(payload, durationInSeconds, USER_AUDIENCE)

  return result
}

/**
 * Retrieve a temporary API session token for the specified session.
 *
 * @param session - The session object containing id and user information
 * @param options - Optional configuration for the token
 * @param options.durationInSeconds - Token validity duration in seconds (default: 900 / 15 minutes)
 * @param options.allowedRoutes - Optional array of glob patterns to restrict token usage to specific API URL paths.
 *                                Supports wildcards (*), globstars (**), and negation (!pattern).
 *                                If not provided, token has no additional path restrictions beyond API routes.
 * @returns A JWT token string
 */
export async function getTemporaryAPISessionToken(
  session: { id: string; user: { id: string } }, // @todo use more specific type
  options?: {
    durationInSeconds?: number
    allowedRoutes?: string[]
    contactId?: string
    namespace?: string
  }
): Promise<string> {
  const payload: {
    sub: string
    userId: string
    allowedRoutes?: string[]
    contactId?: string
    namespace?: string
  } = {
    sub: session.id,
    userId: session.user.id,
  }

  if (options?.allowedRoutes) {
    payload.allowedRoutes = options.allowedRoutes
  }

  if (options?.contactId) {
    payload.contactId = options.contactId
  }

  if (options?.namespace) {
    payload.namespace = options.namespace
  }

  const durationInSeconds =
    options?.durationInSeconds ?? QUARTER_HOUR_IN_SECONDS

  const result = await sign(payload, durationInSeconds, API_AUDIENCE)

  return result
}
