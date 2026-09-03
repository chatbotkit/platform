import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import type {
  API_AUDIENCE,
  ENDUSER_CONVERSATION_AUDIENCE,
  MCP_AUDIENCE,
  USER_AUDIENCE,
} from '@/lib/audience.consts'
import { NONE_AUDIENCE } from '@/lib/audience.consts'
import { decode as decodeB64 } from '@/lib/b64'
import { isDevelopment } from '@/lib/env'

import * as jose from 'jose'
import { z } from 'zod'

type AUDIENCE_TYPE =
  | typeof NONE_AUDIENCE
  | typeof USER_AUDIENCE
  | typeof API_AUDIENCE
  | typeof MCP_AUDIENCE
  | typeof ENDUSER_CONVERSATION_AUDIENCE

/**
 * Base type constraint for JWT payloads - accepts any object type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JWTPayloadConstraint = Record<string, any>

// @note HS256's own key-size floor (RFC 7518 3.2); jose does not enforce it
// and verifies against an empty key, so an unset variable means forgeable
// tokens for every user
const MINIMUM_SECRET_LENGTH = 32

// @note the value .env.example ships for local work
const DEVELOPMENT_SECRET_PREFIX = 'dev-only-'

const secretSchema = z
  .string()
  .min(
    MINIMUM_SECRET_LENGTH,
    `JWT_TOKEN_SECRET_KEY must be set to at least ${MINIMUM_SECRET_LENGTH} characters`
  )
  .refine(
    (value) => isDevelopment || !value.startsWith(DEVELOPMENT_SECRET_PREFIX),
    'JWT_TOKEN_SECRET_KEY is the development placeholder; set a generated secret (openssl rand -hex 32)'
  )

/**
 * The HMAC secret, validated on every use so a misconfigured deployment fails
 * at the first sign or verify rather than accepting forged tokens. Read per
 * call rather than at load: the image generates the secret at first boot,
 * after the build.
 *
 * @throws {z.ZodError} when the secret is unset, too short, or the dev placeholder
 */
export function getSecret(): Uint8Array {
  const secret = secretSchema.parse(process.env.JWT_TOKEN_SECRET_KEY ?? '')

  return new Uint8Array(new TextEncoder().encode(secret))
}

/**
 * Signs a JWT token with the given payload and options
 */
export async function sign<T extends JWTPayloadConstraint>(
  payload: T,
  durationInSeconds: number = ONE_HOUR_IN_SECONDS,
  audience: AUDIENCE_TYPE = NONE_AUDIENCE
): Promise<string> {
  const secret = getSecret()

  return await new jose.SignJWT(payload as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.round(Date.now() / 1000) + durationInSeconds)
    .setAudience(audience)
    .sign(secret)
}

/**
 * Attempts to sign a JWT token, returning null on failure
 */
export async function trySign<T extends JWTPayloadConstraint>(
  payload: T,
  durationInSeconds: number = ONE_HOUR_IN_SECONDS,
  audience: AUDIENCE_TYPE = NONE_AUDIENCE
): Promise<string | null> {
  try {
    return await sign(payload, durationInSeconds, audience)
  } catch {
    return null
  }
}

/**
 * Verifies a JWT token and returns its payload
 */
export async function verify<
  T extends JWTPayloadConstraint = JWTPayloadConstraint,
>(token: string): Promise<T> {
  const secret = getSecret()

  const { payload } = await jose.jwtVerify(token, secret)

  return payload as T
}

/**
 * Attempts to verify a JWT token, returning null on failure
 */
export async function tryVerify<
  T extends JWTPayloadConstraint = JWTPayloadConstraint,
>(token: string): Promise<T | null> {
  try {
    return await verify<T>(token)
  } catch {
    return null
  }
}

/**
 * Extracts the expiration date from a JWT token
 */
export function tokenExpiration(token: string): Date | null {
  try {
    const [, payload] = token.split('.')

    const decoded = JSON.parse(decodeB64(payload)) as { exp?: number }

    if (decoded.exp) {
      return new Date(decoded.exp * 1000)
    }

    return null
  } catch {
    return null
  }
}

/**
 * Checks if a JWT token is still valid (not expired)
 */
export function tokenIsFresh(token: string): boolean {
  const date = tokenExpiration(token)

  if (date) {
    return date > new Date()
  } else {
    return false
  }
}
