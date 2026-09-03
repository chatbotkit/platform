import { getContextRequestIpAddress } from '@/lib/context.store'
import debug from '@/lib/debug'
import { isDevelopment } from '@/lib/env'
import type { AnyRequest } from '@/lib/header'
import { slidingWindow } from '@/lib/ratelimit'

/**
 * Abuse controls for the unauthenticated authentication surface: sign-in code
 * issuance and verification, OAuth token exchange and refresh, and dynamic
 * client registration. These are not entitlements - they are fixed ceilings a
 * session cannot opt out of - so they live apart from `lib/rate.ts`, which
 * keys on an authenticated user.
 *
 * Every limit is keyed on the client address plus, where one exists, the
 * identity being attacked (the email a code was sent to, the OAuth client).
 * Keying on the identity is what makes the code limits meaningful: the email
 * sign-in code is six hex characters valid for fifteen minutes, so without a
 * per-email attempt ceiling an online brute force is a matter of minutes.
 */

type Rate =
  | `${number} ms`
  | `${number} s`
  | `${number} m`
  | `${number} h`
  | `${number} d`

export interface AuthRateLimit {
  tokens: number
  window: Rate
}

/**
 * Sign-in code issuance (POST /api/auth/signin/email), per source address.
 */
export const SIGNIN_EMAIL_ISSUE_PER_IP: AuthRateLimit = {
  tokens: 20,
  window: '15 m',
}

/**
 * Sign-in code issuance, per target email. Each hit sends an email, so this is
 * also sender-reputation protection.
 */
export const SIGNIN_EMAIL_ISSUE_PER_EMAIL: AuthRateLimit = {
  tokens: 5,
  window: '15 m',
}

/**
 * Sign-in code verification (/api/auth/callback/email), per source address.
 */
export const SIGNIN_EMAIL_VERIFY_PER_IP: AuthRateLimit = {
  tokens: 30,
  window: '15 m',
}

/**
 * Sign-in code verification, per target email. Ten guesses against a 16^6
 * space inside the code's own lifetime is the property that matters.
 */
export const SIGNIN_EMAIL_VERIFY_PER_EMAIL: AuthRateLimit = {
  tokens: 10,
  window: '15 m',
}

/**
 * OAuth token and refresh exchanges, per source address.
 */
export const OAUTH_TOKEN_PER_IP: AuthRateLimit = {
  tokens: 60,
  window: '1 m',
}

/**
 * OAuth token and refresh exchanges, per client id. Sized so a single busy
 * client is never throttled by normal refresh traffic while credential
 * stuffing against one client still hits a wall.
 */
export const OAUTH_TOKEN_PER_CLIENT: AuthRateLimit = {
  tokens: 300,
  window: '1 m',
}

/**
 * OAuth dynamic client registration (RFC 7591), per source address. Every
 * call creates a record, so this is also storage protection.
 */
export const OAUTH_REGISTER_PER_IP: AuthRateLimit = {
  tokens: 10,
  window: '15 m',
}

/**
 * Source address for rate keys. The request boundary promotes an authenticated
 * portal assertion or Vercel's trusted x-real-ip into context. Without either,
 * the directly connected socket is the only address trusted here.
 */
export function getClientAddress(req: AnyRequest): string {
  const real = getContextRequestIpAddress()

  if (real) {
    return real.trim()
  }

  const remote = (req as { socket?: { remoteAddress?: string } }).socket
    ?.remoteAddress

  if (remote) {
    return remote
  }

  return 'unknown'
}

/**
 * The email identity for a sign-in rate key, normalized exactly as next-auth's
 * email provider normalizes the identifier it stores the code against
 * (`normalizeIdentifier` in next-auth/core/routes/signin): NFKC, trimmed,
 * lowercased, and anything after a comma in the domain dropped. Without this,
 * `victim@example.com,1`, `victim@example.com,2`, ... each get their own
 * per-email budget while next-auth sends every one of them to the same
 * inbox. Returns null for anything next-auth would reject, so the caller
 * skips the identity rather than keying on garbage.
 */
export function normalizeSigninEmail(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null
  }

  const trimmed = input.normalize('NFKC').trim()

  if ((trimmed.match(/@/g) ?? []).length !== 1 || trimmed.includes('"')) {
    return null
  }

  const [local, rawDomain] = trimmed.toLowerCase().split('@')

  const domain = rawDomain.split(',')[0]

  if (!local || !domain || !domain.includes('.')) {
    return null
  }

  return `${local}@${domain}`
}

/**
 * Consumes one token for `scope` against each of the supplied identities and
 * reports whether all of them are still within their limit. A missing
 * identity is skipped rather than counted, so callers can pass whatever they
 * have without special-casing.
 */
export async function checkAuthRate(
  scope: string,
  checks: Array<{
    identity: string | null | undefined
    limit: AuthRateLimit
  }>
): Promise<boolean> {
  if (isDevelopment) {
    return true
  }

  let allowed = true

  for (const { identity, limit } of checks) {
    if (!identity) {
      continue
    }

    const key = `auth-rate:${scope}:${identity.toLowerCase()}`

    const { success } = await slidingWindow(key, limit.tokens, limit.window)

    debug(`checking auth rate`, { key, success }).log('auth.rate.checkAuthRate')

    if (!success) {
      allowed = false
    }
  }

  return allowed
}

export const TOO_MANY_ATTEMPTS_MESSAGE = 'Too many attempts. Try again later.'
