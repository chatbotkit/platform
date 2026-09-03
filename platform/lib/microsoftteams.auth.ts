import debug from '@/lib/debug'
import fetch from '@/lib/fetch'
import memcache from '@/lib/memcache'

// @note Microsoft's OpenID metadata URL for Bot Framework token validation
const OPENID_METADATA_URL =
  'https://login.botframework.com/v1/.well-known/openidconfiguration'

// @note Bot Framework channel ID for Teams
const TEAMS_CHANNEL_ID = 'msteams'

const JWKS_CACHE_KEY = 'teams:botframework:jwks'

// @note 24 hours in seconds
const JWKS_CACHE_TTL = 24 * 60 * 60

interface OpenIDConfig {
  jwks_uri: string
}

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
 * Fetches and caches the OpenID signing keys from Bot Framework. Uses Redis
 * to store the raw JWK data so the cache survives across edge isolates.
 */
async function getSigningKeys(): Promise<Record<string, CryptoKey>> {
  const cached = await memcache.get<Record<string, JWK>>(JWKS_CACHE_KEY)

  if (cached) {
    return importKeys(cached)
  }

  const configResponse = await fetch(OPENID_METADATA_URL)
  const config: OpenIDConfig = await configResponse.json()

  const jwksResponse = await fetch(config.jwks_uri)
  const jwks: JWKSResponse = await jwksResponse.json()

  const rawKeys: Record<string, JWK> = {}

  for (const key of jwks.keys) {
    if (key.kty === 'RSA' && key.use !== 'enc') {
      rawKeys[key.kid] = key
    }
  }

  // @note cache raw JWK data in redis for 24 hours
  await memcache.set(JWKS_CACHE_KEY, rawKeys, { ex: JWKS_CACHE_TTL })

  return importKeys(rawKeys)
}

/**
 * Decodes a base64url-encoded string.
 */
function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)

  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}

interface JWTHeader {
  kid?: string
  alg?: string
}

interface JWTPayload {
  iss?: string
  aud?: string
  exp?: number
  serviceurl?: string
}

/**
 * Verifies a Bot Framework JWT token from the Authorization header.
 *
 * @param authHeader - The full Authorization header value (e.g. "Bearer <token>")
 * @param appId - The Bot Framework App ID to validate the audience against
 * @returns true if the token is valid, false otherwise
 */
export async function verifyBotFrameworkToken(
  authHeader: string,
  appId: string
): Promise<boolean> {
  if (!authHeader) {
    return false
  }

  const parts = authHeader.split(' ')

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return false
  }

  const token = parts[1]
  const segments = token.split('.')

  if (segments.length !== 3) {
    return false
  }

  try {
    const headerJson = new TextDecoder().decode(base64urlDecode(segments[0]))
    const header: JWTHeader = JSON.parse(headerJson)

    const payloadJson = new TextDecoder().decode(base64urlDecode(segments[1]))
    const payload: JWTPayload = JSON.parse(payloadJson)

    // @note validate claims

    if (
      payload.iss !== 'https://api.botframework.com' &&
      payload.iss !==
        'https://sts.windows.net/d6d49420-f39b-4df7-a1dc-d59a935871db/' &&
      payload.iss !==
        'https://login.microsoftonline.com/d6d49420-f39b-4df7-a1dc-d59a935871db/v2.0'
    ) {
      debug(`invalid issuer`, { iss: payload.iss }).log(
        'microsoftteams.auth.verifyBotFrameworkToken'
      )

      return false
    }

    if (payload.aud !== appId) {
      debug(`invalid audience`, { aud: payload.aud, appId }).log(
        'microsoftteams.auth.verifyBotFrameworkToken'
      )

      return false
    }

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      debug(`token expired`).log('microsoftteams.auth.verifyBotFrameworkToken')

      return false
    }

    // @note verify the signature

    const keys = await getSigningKeys()

    if (!header.kid || !keys[header.kid]) {
      debug(`unknown key id`, { kid: header.kid }).log(
        'microsoftteams.auth.verifyBotFrameworkToken'
      )

      return false
    }

    const signatureData = new TextEncoder().encode(
      `${segments[0]}.${segments[1]}`
    )
    const signature = base64urlDecode(segments[2])

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      keys[header.kid],
      signature.buffer as ArrayBuffer,
      signatureData.buffer as ArrayBuffer
    )

    return isValid
  } catch (e) {
    debug(`token verification error`, { error: e }).log(
      'microsoftteams.auth.verifyBotFrameworkToken'
    )

    return false
  }
}
