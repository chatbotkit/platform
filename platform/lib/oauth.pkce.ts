import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import { encodeUint8Array } from '@/lib/b64'
import { decrypt, encrypt } from '@/lib/cloak'
import debug from '@/lib/debug'
import memcache from '@/lib/memcache'
import {
  generateRandomBytes,
  generateRandomHex,
  sha256B,
} from '@/lib/webcrypto'

/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0.
 *
 * Implements RFC 7636 - Proof Key for Code Exchange by OAuth Public Clients.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7636
 */

/**
 * Length of the code verifier in bytes before base64url encoding. RFC 7636
 * requires verifiers to be 43-128 characters after encoding: 32 bytes = 43
 * characters after base64url encoding.
 */
const CODE_VERIFIER_BYTES = 32

/**
 * Generates a cryptographically random code verifier.
 *
 * Per RFC 7636 Section 4.1:
 * - Must be between 43 and 128 characters
 * - Must use only unreserved URI characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 *
 * @returns A random code verifier string
 */
export function generateCodeVerifier(): string {
  const randomBuffer = generateRandomBytes(CODE_VERIFIER_BYTES)
  const verifier = encodeUint8Array(randomBuffer, true)

  debug(`generated code verifier`, { length: verifier.length }).log(
    'oauth.pkce.generateCodeVerifier'
  )

  return verifier
}

/**
 * Generates a code challenge from a code verifier using S256 method.
 *
 * Per RFC 7636 Section 4.2:
 * code_challenge = BASE64URL(SHA256(code_verifier))
 *
 * @param codeVerifier - The code verifier to hash
 * @returns The code challenge (base64url encoded SHA-256 hash)
 */
export async function generateCodeChallenge(
  codeVerifier: string
): Promise<string> {
  const hashBuffer = await sha256B(codeVerifier)
  const challenge = encodeUint8Array(hashBuffer, true)

  debug(`generated code challenge`, { length: challenge.length }).log(
    'oauth.pkce.generateCodeChallenge'
  )

  return challenge
}

/**
 * Verifies that a code verifier matches a code challenge.
 *
 * @param codeVerifier - The code verifier to verify
 * @param codeChallenge - The expected code challenge
 * @param method - The challenge method (only 'S256' is supported)
 * @returns True if the verifier matches the challenge
 */
export async function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: 'S256' = 'S256'
): Promise<boolean> {
  if (method !== 'S256') {
    debug(`unsupported challenge method`, { method }).log(
      'oauth.pkce.verifyCodeChallenge'
    )

    return false
  }

  const computedChallenge = await generateCodeChallenge(codeVerifier)
  const isValid = computedChallenge === codeChallenge

  debug(`verified code challenge`, { isValid }).log(
    'oauth.pkce.verifyCodeChallenge'
  )

  return isValid
}

/**
 * Generates a PKCE pair (code verifier and code challenge).
 *
 * @returns An object containing the code verifier and code challenge
 */
export async function generatePkcePair(): Promise<{
  codeVerifier: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
}> {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  debug(`generated PKCE pair`).log('oauth.pkce.generatePkcePair')

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  }
}

/**
 * Redis key prefix for PKCE verifier storage.
 */
const PKCE_VERIFIER_KEY_PREFIX = 'oauth:pkce:verifier:'

/**
 * Stores a PKCE code verifier securely in Redis and returns a unique ID.
 *
 * The verifier is encrypted before storage and expires after 15 minutes
 * (the typical maximum duration of an OAuth authorization flow).
 *
 * @param codeVerifier - The PKCE code verifier to store
 * @returns A unique ID that can be used to retrieve the verifier
 */
export async function storePkceVerifier(codeVerifier: string): Promise<string> {
  const id = await generateRandomHex(16)
  const key = `${PKCE_VERIFIER_KEY_PREFIX}${id}`

  const encrypted = await encrypt(codeVerifier)

  await memcache.setex(key, QUARTER_HOUR_IN_SECONDS, encrypted)

  debug(`stored PKCE verifier`, { id }).log('oauth.pkce.storePkceVerifier')

  return id
}

/**
 * Retrieves a PKCE code verifier from Redis by its ID.
 *
 * The verifier is decrypted after retrieval and deleted from Redis to prevent
 * reuse (each verifier should only be used once).
 *
 * @param id - The unique ID returned by storePkceVerifier
 * @returns The code verifier, or null if not found or expired
 */
export async function retrievePkceVerifier(id: string): Promise<string | null> {
  const key = `${PKCE_VERIFIER_KEY_PREFIX}${id}`

  const encrypted = await memcache.get(key)

  if (!encrypted) {
    debug(`PKCE verifier not found`, { id }).log(
      'oauth.pkce.retrievePkceVerifier'
    )

    return null
  }

  // Delete immediately to prevent reuse

  await memcache.del(key)

  try {
    const codeVerifier = await decrypt(encrypted as string)

    debug(`retrieved PKCE verifier`, { id }).log(
      'oauth.pkce.retrievePkceVerifier'
    )

    return codeVerifier
  } catch (error) {
    debug(`failed to decrypt PKCE verifier`, { id, error }).log(
      'oauth.pkce.retrievePkceVerifier'
    )

    return null
  }
}
