import {
  API_AUDIENCE,
  APP_AUDIENCE,
  USER_AUDIENCE,
} from '@/lib/audience.consts'

import type { Session } from './session.get'

export function isUserAudience(audience: string | null | undefined): boolean {
  return audience === USER_AUDIENCE
}

export function isApiAudience(audience: string | null | undefined): boolean {
  return audience === API_AUDIENCE
}

export function isAppAudience(audience: string | null | undefined): boolean {
  return audience === APP_AUDIENCE
}

/**
 * Determines if the provided audience is trusted. A trusted audience is either
 * the USER_AUDIENCE or the API_AUDIENCE as defined in the application's
 * configuration. This restricts audiences to session types related to users
 * authenticated with the dashboard or API clients.
 *
 * @param audience
 * @returns
 */
export function isTrustedAudience(
  audience: string | null | undefined
): boolean {
  return isUserAudience(audience) || isApiAudience(audience)
}

/**
 * Determines if the provided audience is an extended trusted audience. An
 * extended trusted audience includes the USER_AUDIENCE, API_AUDIENCE, and
 * APP_AUDIENCE as defined in the application's configuration. This allows for
 * additional flexibility in audience management.
 *
 * @param audience
 * @returns
 */
export function isExtendedTrustedAudience(
  audience: string | null | undefined
): boolean {
  return (
    isUserAudience(audience) ||
    isApiAudience(audience) ||
    isAppAudience(audience)
  )
}

/**
 * Uses the isTrustedAudience function to check if the session audience is
 * trusted. For more information see isTrustedAudience.
 *
 * @param session
 * @returns
 */
export function isTrustedSession(session: Session) {
  return isTrustedAudience(session.payload.aud)
}
