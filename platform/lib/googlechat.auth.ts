import debug from '@/lib/debug'
import fetch from '@/lib/fetch'
import memcache from '@/lib/memcache'

// @note Google Chat supports two JWT signing modes depending on the
// "Authentication Audience" configured for the Chat app:
//
//   1. Project Number - Google Chat self-signs a JWT with the system service
//      account `chat@system.gserviceaccount.com`. The `aud` claim is the
//      Cloud project number. Keys are published at the per-service-account
//      JWKS endpoint below.
//
//   2. HTTP endpoint URL - Google issues a standard OpenID Connect ID token
//      via `accounts.google.com`. The `aud` claim is the exact endpoint URL
//      that Google was told to POST to. Keys are published at the public
//      Google OIDC certs endpoint below.
//
// We auto-detect which mode is in use by inspecting the `iss` claim of the
// incoming token, then verify against the matching JWKS.
const GOOGLE_CHAT_SERVICE_ACCOUNT = 'chat@system.gserviceaccount.com'

const CHAT_SYSTEM_JWKS_URL = `https://www.googleapis.com/service_accounts/v1/jwk/${GOOGLE_CHAT_SERVICE_ACCOUNT}`
const GOOGLE_OIDC_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'

const GOOGLE_OIDC_ISSUERS = new Set([
  'https://accounts.google.com',
  'accounts.google.com',
])

const CHAT_SYSTEM_JWKS_CACHE_KEY = 'googlechat:jwks'
const GOOGLE_OIDC_JWKS_CACHE_KEY = 'googlechat:jwks:oidc'

// @note 24 hours in seconds
const JWKS_CACHE_TTL = 24 * 60 * 60

interface JWK {
  kid: string
  kty: string
  n: string
  e: string
  use?: string
}

interface JWKSResponse {
  keys: JWK[]
}

/**
 * Imports raw JWK objects into CryptoKey instances for signature verification.
 */
async function importKeys(
  rawKeys: Record<string, JWK>
): Promise<Record<string, CryptoKey>> {
  const keys: Record<string, CryptoKey> = {}

  for (const [kid, key] of Object.entries(rawKeys)) {
    try {
      const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        {
          kty: key.kty,
          n: key.n,
          e: key.e,
          alg: 'RS256',
          ext: true,
        },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      )

      keys[kid] = cryptoKey
    } catch {
      // @note skip keys that fail to import
    }
  }

  return keys
}

/**
 * Fetches and caches a JWKS document for request verification. Caches raw
 * JWK data in redis so the cache survives across edge isolates. Pass
 * `forceRefresh` to bypass the cache - used to recover when a JWT arrives
 * signed with a key id that is not in the cached set (i.e. the issuer has
 * rotated keys since we last fetched).
 */
async function getSigningKeys(
  jwksUrl: string,
  cacheKey: string,
  forceRefresh = false
): Promise<Record<string, CryptoKey>> {
  if (!forceRefresh) {
    const cached = await memcache.get<Record<string, JWK>>(cacheKey)

    if (cached) {
      return importKeys(cached)
    }
  }

  const jwksResponse = await fetch(jwksUrl)
  const jwks: JWKSResponse = await jwksResponse.json()

  const rawKeys: Record<string, JWK> = {}

  for (const key of jwks.keys) {
    if (key.kty === 'RSA' && key.use !== 'enc') {
      rawKeys[key.kid] = key
    }
  }

  await memcache.set(cacheKey, rawKeys, { ex: JWKS_CACHE_TTL })

  return importKeys(rawKeys)
}

/**
 * Decodes a base64url-encoded string.
 */
function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '='
  )
  const binary = atob(padded)

  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)))
}

/**
 * Normalises a URL string for audience comparison: drops a single trailing
 * slash so values like `https://x/y/` and `https://x/y` compare equal.
 */
function normaliseAudienceUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

interface VerifyOptions {
  /** Required for chat@system tokens (Project Number audience mode). */
  projectNumber?: string | null
  /**
   * Required for OIDC tokens (HTTP endpoint URL audience mode). The full
   * URL Google was told to POST to - must equal the JWT `aud` claim.
   */
  expectedEndpointUrl?: string | null
}

/**
 * Verifies a Bearer JWT token sent by Google Chat. Auto-detects which of
 * Google's two signing modes is in use (chat@system self-signed vs Google
 * OIDC ID token) based on the `iss` claim, then validates the signature
 * against the matching JWKS and checks the audience accordingly.
 *
 * Returns the decoded payload if valid, throws on failure.
 *
 * @param authHeader  The raw Authorization header value (e.g. "Bearer eyJ...")
 * @param options     `projectNumber` for chat@system mode; `expectedEndpointUrl`
 *                    for OIDC mode. Whichever applies to the incoming token
 *                    must be provided or audience verification will fail.
 */
export async function verifyGoogleChatToken(
  authHeader: string,
  options: VerifyOptions = {}
): Promise<Record<string, unknown>> {
  const { projectNumber, expectedEndpointUrl } = options

  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    throw new Error('Missing Bearer token')
  }

  const parts = token.split('.')

  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }

  const [headerB64, payloadB64, signatureB64] = parts

  let header: { kid?: string; alg?: string }

  try {
    header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64)))
  } catch {
    throw new Error('Failed to decode JWT header')
  }

  if (!header.kid) {
    throw new Error('JWT header missing kid')
  }

  // @note decode payload before signature verification so we can route to
  // the correct JWKS based on `iss`. We intentionally do NOT trust any
  // claim until after the signature has been verified against the JWKS
  // selected from `iss` - a forged `iss` will simply point us at a JWKS
  // that will not contain the signing key, and verification will fail.
  let payload: Record<string, unknown>

  try {
    payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)))
  } catch {
    throw new Error('Failed to decode JWT payload')
  }

  const iss = typeof payload.iss === 'string' ? payload.iss : ''

  let jwksUrl: string
  let cacheKey: string
  let mode: 'chat-system' | 'oidc'

  if (iss === GOOGLE_CHAT_SERVICE_ACCOUNT) {
    jwksUrl = CHAT_SYSTEM_JWKS_URL
    cacheKey = CHAT_SYSTEM_JWKS_CACHE_KEY
    mode = 'chat-system'
  } else if (GOOGLE_OIDC_ISSUERS.has(iss)) {
    jwksUrl = GOOGLE_OIDC_JWKS_URL
    cacheKey = GOOGLE_OIDC_JWKS_CACHE_KEY
    mode = 'oidc'
  } else {
    throw new Error(
      `JWT issuer mismatch: expected '${GOOGLE_CHAT_SERVICE_ACCOUNT}' (Project Number audience mode) or 'https://accounts.google.com' (HTTP endpoint URL audience mode), got '${iss || '(missing)'}'`
    )
  }

  let keys = await getSigningKeys(jwksUrl, cacheKey)

  let key = keys[header.kid]

  // @note kid miss most likely means the issuer rotated keys since we last
  // cached the JWKS; bust the cache and try once more before giving up.
  // Tolerate refetch failures so tests (and transient network blips) still
  // produce the "Unknown JWT kid" error rather than an opaque fetch error.
  if (!key) {
    debug(`JWT kid not in cached JWKS, refetching`, {
      kid: header.kid,
      mode,
    }).log('googlechat.auth.verifyGoogleChatToken')

    try {
      keys = await getSigningKeys(jwksUrl, cacheKey, true)
      key = keys[header.kid]
    } catch {
      // @note fall through to the "Unknown JWT kid" throw below
    }
  }

  if (!key) {
    throw new Error(`Unknown JWT kid: ${header.kid} (issuer ${iss})`)
  }

  const signingInput = `${headerB64}.${payloadB64}`
  const signature = Buffer.from(base64urlDecode(signatureB64))

  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    new TextEncoder().encode(signingInput)
  )

  if (!isValid) {
    throw new Error('JWT signature verification failed')
  }

  // @note audience verification is skipped when the matching expectation
  // is not provided, preserving the existing "soft" behaviour for callers
  // that have not configured the relevant value yet (e.g. development /
  // testing without a Project Number).
  if (mode === 'chat-system' && projectNumber) {
    const aud = payload.aud
    const audList = Array.isArray(aud) ? aud : [aud]

    const audContainsProject = audList.some(
      (a) => typeof a === 'string' && a.includes(projectNumber)
    )

    if (!audContainsProject) {
      debug(`JWT audience mismatch`, { aud, projectNumber, mode }).log(
        'googlechat.auth.verifyGoogleChatToken'
      )

      throw new Error(
        `JWT audience does not contain project number ${projectNumber}`
      )
    }
  }

  if (mode === 'oidc' && expectedEndpointUrl) {
    const aud = payload.aud
    const audList = Array.isArray(aud) ? aud : [aud]
    const expected = normaliseAudienceUrl(expectedEndpointUrl)

    const audMatches = audList.some(
      (a) => typeof a === 'string' && normaliseAudienceUrl(a) === expected
    )

    if (!audMatches) {
      debug(`JWT audience mismatch`, { aud, expectedEndpointUrl, mode }).log(
        'googlechat.auth.verifyGoogleChatToken'
      )

      throw new Error(
        `JWT audience does not equal expected endpoint URL ${expectedEndpointUrl}`
      )
    }
  }

  // @note verify token is not expired
  if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) {
    throw new Error('JWT token has expired')
  }

  return payload
}
