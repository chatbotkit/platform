import type { Prisma as PrismaTypes } from '@chatbotkit-dev/db/client'

import { sha256 } from '@/lib/webcrypto'

export const DIGEST_PREFIX = 'sha256:'

type DigestFieldsMap = {
  readonly [M in PrismaTypes.ModelName]?: readonly (keyof PrismaTypes.TypeMap['model'][M]['payload']['scalars'])[]
}

/**
 * Lookup-only credential columns stored as deterministic digests.
 *
 * This map MUST match the `/// @digest` annotations in `schema.prisma`.
 * These values are never recoverable: minting paths return the plaintext once,
 * and authentication paths digest the caller-supplied credential before one
 * indexed database lookup.
 */
export const DIGEST_FIELDS = {
  OAuthApplication: ['clientSecret'],
  OAuthApplicationToken: ['accessToken', 'refreshToken'],
  Token: ['token'],
} as const satisfies DigestFieldsMap

/**
 * Produces the database representation of a lookup-only credential.
 *
 * @note this is deliberately not idempotent, so a leaked database digest
 * cannot be submitted as though it were the original bearer credential
 */
export async function digestCredential(value: string): Promise<string> {
  return `${DIGEST_PREFIX}${await sha256(value)}`
}

/**
 * Identifies rows already transformed by the offline migration.
 * Authentication code must not use this function as a compatibility branch.
 */
export function isCredentialDigest(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/.test(value)
}
