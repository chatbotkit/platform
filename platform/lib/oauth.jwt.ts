import {
  ONE_HOUR_IN_SECONDS,
  ONE_MONTH_IN_SECONDS,
  TEN_MINUTES_IN_SECONDS,
} from '@chatbotkit-dev/time'

import cuid from '@/lib/cuid'
import debug from '@/lib/debug'
import { sign as signJWT, tryVerify as tryVerifyJWT } from '@/lib/jwt'
import { ALLOWED_AUDIENCES, ALLOWED_SCOPES } from '@/lib/mcp.oauth.constants'
import memcache from '@/lib/memcache'
import { sha256 } from '@/lib/webcrypto'

export { ALLOWED_SCOPES }

// ---
// Constants (OAuth 2.1)
// ---

/**
 * Refresh token lifetime in seconds (30 days)
 */
export const REFRESH_TOKEN_TTL_SECONDS = ONE_MONTH_IN_SECONDS

// ---
// Validation Functions (RFC 6749, RFC 7636)
// ---

/**
 * Validate the *shape* of a redirect URI: a parsable URL, https (or http on
 * localhost for development), no fragment.
 *
 * @note this is deliberately only the format half of redirect-URI security.
 * The authorization half - that the URI is one the specific client
 * registered - is enforced by the MCP authorize endpoint, which loads the
 * dynamic client in the integration's namespace and requires an exact
 * member of `registeredClient.redirectUris` before constructing any
 * redirect (see `oauth/authorize.ts` and its "not registered for the
 * client" test). Keep the two layers where they are: this helper has no
 * client context, and the endpoint check is what prevents authorization
 * code interception and open redirects.
 *
 * @param redirectUri - The redirect URI to validate
 * @returns True if valid, false otherwise
 */
export function validateRedirectUri(redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri)

    // Disallow fragments per OAuth 2.0 spec

    if (url.hash) {
      return false
    }

    // Require https or http://localhost for development

    if (url.protocol === 'https:') {
      return true
    }

    if (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    ) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Validate the *shape* of a client id: a non-empty string.
 *
 * @note deliberately shape-only, like `validateRedirectUri`. Whether the id
 * names a registered client is decided by the MCP authorize endpoint, which
 * loads the dynamic client in the integration's namespace and exact-matches
 * its registered redirect URI - the endpoint-level registry test is the
 * executable proof. This helper has no client context and must not be read
 * as the registry.
 *
 * @param clientId - The client ID to validate
 * @returns True if valid, false otherwise
 */
export function validateClientId(clientId: string): boolean {
  // Basic validation: non-empty string

  if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
    return false
  }

  // @todo check against registered clients in database or allowlist pattern
  // @note needs to be made optional via portal configuration, deferred
  // @todo SECURITY: Implement client registry to prevent arbitrary client_ids
  // and potential impersonation.

  return true
}

/**
 * Validate and normalize requested scopes
 *
 * @param requestedScopes - Space-separated scope string
 * @returns Array of valid scopes, or null if any invalid scope requested
 */
export function validateScopes(
  requestedScopes: string | null | undefined
): string[] | null {
  if (!requestedScopes) {
    // Return default scopes if none requested

    return [...ALLOWED_SCOPES]
  }

  const scopes = requestedScopes.split(' ').filter((s) => s.trim() !== '')

  // Check all scopes are in allowed list

  for (const scope of scopes) {
    if (!ALLOWED_SCOPES.includes(scope as (typeof ALLOWED_SCOPES)[number])) {
      return null
    }
  }

  return scopes.length > 0 ? scopes : [...ALLOWED_SCOPES]
}

/**
 * Check if token has required scope for operation
 *
 * @param tokenScopes - Space-separated scopes from token
 * @param requiredScope - Required scope for operation
 * @returns True if token has required scope
 */
export function hasScope(tokenScopes: string, requiredScope: string): boolean {
  const scopes = tokenScopes.split(' ')

  return scopes.includes(requiredScope)
}

// ---
// Pending Authorization Request Storage
// ---

/**
 * Pending OAuth Authorization Request
 *
 * This represents a pending authorization request before user consent.
 * It contains all the OAuth parameters but not the user/contact info yet.
 */
export interface PendingOAuthAuthorizationRequest {
  requestId: string
  clientId: string
  clientName?: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
  scope: string
  state?: string
  portalId: string
  createdAt: number
}

/**
 * Gets the Redis key for a pending OAuth authorization request
 *
 * @param requestId - The request ID
 * @returns The Redis key
 */
function getPendingAuthorizationRequestRedisKey(requestId: string): string {
  return `apps:oauth:pending:${requestId}`
}

/**
 * Store a pending OAuth authorization request in Redis
 *
 * @param request - The pending authorization request to store
 * @param expirySeconds - Time to live in seconds (default: 10 minutes)
 */
export async function storePendingAuthorizationRequest(
  request: PendingOAuthAuthorizationRequest,
  expirySeconds: number = TEN_MINUTES_IN_SECONDS
): Promise<void> {
  debug('storing pending authorization request', {
    requestId: request.requestId,
    portalId: request.portalId,
    clientId: request.clientId,
    expirySeconds,
  }).log('oauth.jwt.storePendingAuthorizationRequest')

  const redisKey = getPendingAuthorizationRequestRedisKey(request.requestId)

  await memcache.set(redisKey, JSON.stringify(request), {
    ex: expirySeconds,
  })
}

/**
 * Retrieve a pending OAuth authorization request from Redis
 *
 * @param requestId - The request ID
 * @returns The pending authorization request or null if not found
 */
export async function retrievePendingAuthorizationRequest(
  requestId: string
): Promise<PendingOAuthAuthorizationRequest | null> {
  debug('retrieving pending authorization request', { requestId }).log(
    'oauth.jwt.retrievePendingAuthorizationRequest'
  )

  const redisKey = getPendingAuthorizationRequestRedisKey(requestId)

  const requestJson = await memcache.get(redisKey)

  if (!requestJson) {
    debug('pending authorization request not found', { requestId }).log(
      'oauth.jwt.retrievePendingAuthorizationRequest'
    )

    return null
  }

  const request =
    typeof requestJson === 'string' ? JSON.parse(requestJson) : requestJson

  debug('retrieved pending authorization request', {
    requestId,
    portalId: request.portalId,
    clientId: request.clientId,
  }).log('oauth.jwt.retrievePendingAuthorizationRequest')

  return request as PendingOAuthAuthorizationRequest
}

/**
 * Delete a pending OAuth authorization request from Redis
 *
 * @param requestId - The request ID
 */
export async function deletePendingAuthorizationRequest(
  requestId: string
): Promise<void> {
  debug('deleting pending authorization request', { requestId }).log(
    'oauth.jwt.deletePendingAuthorizationRequest'
  )

  const redisKey = getPendingAuthorizationRequestRedisKey(requestId)

  await memcache.del(redisKey)
}

// ---
// Authorization Request Storage (RFC 6749 Section 4.1)
// ---

/**
 * OAuth 2.0 Authorization Request
 *
 * Represents the authorization request stored in Redis during the OAuth flow.
 * This is created during the authorization step and retrieved during token
 * exchange.
 */
export interface OAuthAuthorizationRequest {
  code: string
  clientId: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
  scope: string
  state?: string
  portalId: string
  portalUserId: string
  userId: string
  contactId: string
  createdAt: number
}

/**
 * Gets the Redis key for an OAuth authorization request
 *
 * @param code - The authorization code
 * @returns The Redis key
 */
function getAuthorizationRequestRedisKey(code: string): string {
  return `apps:oauth:authcode:${code}`
}

/**
 * Store an OAuth authorization request in Redis
 *
 * @param request - The authorization request to store
 * @param expirySeconds - Time to live in seconds (default: 10 minutes)
 */
export async function storeAuthorizationRequest(
  request: OAuthAuthorizationRequest,
  expirySeconds: number = TEN_MINUTES_IN_SECONDS
): Promise<void> {
  debug('storing authorization request', {
    code: request.code.substring(0, 8) + '...',
    portalId: request.portalId,
    clientId: request.clientId,
    userId: request.userId,
    expirySeconds,
  }).log('oauth.jwt.storeAuthorizationRequest')

  const redisKey = getAuthorizationRequestRedisKey(request.code)

  await memcache.set(redisKey, JSON.stringify(request), {
    ex: expirySeconds,
  })
}

/**
 * Retrieve an OAuth authorization request from Redis
 *
 * @param code - The authorization code
 * @returns The authorization request or null if not found
 */
export async function retrieveAuthorizationRequest(
  code: string
): Promise<OAuthAuthorizationRequest | null> {
  debug('retrieving authorization request', {
    code: code.substring(0, 8) + '...',
  }).log('oauth.jwt.retrieveAuthorizationRequest')

  const redisKey = getAuthorizationRequestRedisKey(code)

  const authRequestJson = await memcache.get(redisKey)

  if (!authRequestJson) {
    debug('authorization request not found').log(
      'oauth.jwt.retrieveAuthorizationRequest'
    )

    return null
  }

  const authRequest =
    typeof authRequestJson === 'string'
      ? JSON.parse(authRequestJson)
      : authRequestJson

  debug('retrieved authorization request', {
    portalId: authRequest.portalId,
    clientId: authRequest.clientId,
    userId: authRequest.userId,
  }).log('oauth.jwt.retrieveAuthorizationRequest')

  return authRequest as OAuthAuthorizationRequest
}

/**
 * Delete an OAuth authorization request from Redis
 *
 * @param code - The authorization code
 */
export async function deleteAuthorizationRequest(code: string): Promise<void> {
  debug('deleting authorization request', {
    code: code.substring(0, 8) + '...',
  }).log('oauth.jwt.deleteAuthorizationRequest')

  const redisKey = getAuthorizationRequestRedisKey(code)

  await memcache.del(redisKey)
}

// ---
// Access Token Management (RFC 6749 Section 5, RFC 9068)
// ---

/**
 * Portal OAuth Token Claims
 *
 * JWT claims structure for portal OAuth access tokens
 */
/**
 * @note what the MCP token endpoint (`oauth/token.ts`) puts in these claims:
 * `portalId` = the `mcpserverIntegrationId` that issued the token,
 * `portalUserId` = the IdP subject. Renaming the claims on the wire is a
 * token-format change (live tokens carry these names).
 */
export interface OAuthTokenClaims {
  sub: string // the IdP subject
  portalId: string // set to mcpserverIntegrationId by oauth/token.ts
  portalUserId: string // set to the IdP subject by oauth/token.ts
  contactId: string
  scope: string
  aud: (typeof ALLOWED_AUDIENCES)[number]
}

/**
 * Sign an MCP OAuth access token (JWT)
 *
 * @param claims - Token claims
 * @param expirySeconds - Time to live in seconds (default: 1 hour)
 * @returns JWT access token
 */
export async function signOAuthToken(
  claims: Omit<OAuthTokenClaims, 'aud'>,
  expirySeconds: number = ONE_HOUR_IN_SECONDS
): Promise<string> {
  debug('signing portal oauth token', {
    sub: claims.sub,
    portalId: claims.portalId,
    portalUserId: claims.portalUserId,
    scope: claims.scope,
    expirySeconds,
  }).log('oauth.jwt.signOAuthToken')

  const token = await signJWT(claims, expirySeconds, 'mcp')

  return token
}

/**
 * Verify and decode a portal OAuth access token
 *
 * @param token - JWT access token to verify
 * @returns Token claims or null if invalid
 */
export async function verifyOAuthToken(
  token: string
): Promise<OAuthTokenClaims | null> {
  debug('verifying portal oauth token', {
    tokenPrefix: token.substring(0, 12) + '...',
  }).log(
    'oauth.jwt.verifyOAuthToken'
  )

  const payload = await tryVerifyJWT<OAuthTokenClaims>(token)

  if (!payload) {
    debug('token verification failed').log('oauth.jwt.verifyOAuthToken')

    return null
  }

  if (!ALLOWED_AUDIENCES.includes(payload.aud)) {
    debug('invalid token audience', { aud: payload.aud }).log(
      'oauth.jwt.verifyOAuthToken'
    )

    return null
  }

  debug('portal oauth token verified successfully', {
    sub: payload.sub,
    portalId: payload.portalId,
    scope: payload.scope,
  }).log('oauth.jwt.verifyOAuthToken')

  return payload
}

/**
 * OAuth Token Metadata
 *
 * Additional metadata stored in Redis for token validation and revocation.
 * The JWT itself is self-contained, but this metadata enables features like
 * token revocation.
 */
export interface OAuthTokenMetadata {
  portalId: string
  userId: string
  scope: string
  createdAt: number
  revoked?: boolean
}

/**
 * Gets the Redis key for an OAuth token metadata
 *
 * @param accessToken - The complete access token
 * @returns The Redis key
 *
 * @note keyed by a SHA-256 digest of the whole token. An earlier version
 * keyed by the token's first 16 characters, which for the JWTs this
 * platform signs is the shared encoded JOSE header - every token mapped to
 * one record, and a fabricated token carrying that public prefix could
 * revoke it through the unauthenticated revocation endpoint. The digest is
 * token-specific and never stores bearer material in the key.
 */
async function getTokenMetadataRedisKey(accessToken: string): Promise<string> {
  return `apps:oauth:token:${await sha256(accessToken)}`
}

/**
 * Store OAuth token metadata in Redis
 *
 * @note currently used for potential future revocation, not actively checked
 * @param accessToken - The JWT access token
 * @param metadata - Token metadata to store
 * @param expirySeconds - Time to live in seconds (default: 1 hour)
 */
export async function storeTokenMetadata(
  accessToken: string,
  metadata: OAuthTokenMetadata,
  expirySeconds: number = ONE_HOUR_IN_SECONDS
): Promise<void> {
  debug('storing token metadata', {
    portalId: metadata.portalId,
    userId: metadata.userId,
    scope: metadata.scope,
    expirySeconds,
  }).log('oauth.jwt.storeTokenMetadata')

  const redisKey = await getTokenMetadataRedisKey(accessToken)

  await memcache.set(redisKey, JSON.stringify(metadata), {
    ex: expirySeconds,
  })
}

/**
 * Check if a token has been revoked
 *
 * @param accessToken - The JWT access token
 * @returns True if token is revoked, false otherwise
 */
export async function isTokenRevoked(accessToken: string): Promise<boolean> {
  debug('checking if token is revoked').log('oauth.jwt.isTokenRevoked')

  const redisKey = await getTokenMetadataRedisKey(accessToken)

  const metadataJson = await memcache.get(redisKey)

  if (!metadataJson) {
    // @note metadata doesn't exist - token may have expired or never been stored

    // @todo SECURITY: If metadata doesn't exist (token TTL expired), we can't
    // check revocation status. Consider storing revocation flags separately
    // with longer TTL, or maintaining a revocation list that persists beyond
    // token expiry.

    debug('token metadata not found, assuming not revoked').log(
      'oauth.jwt.isTokenRevoked'
    )

    return false
  }

  const metadata =
    typeof metadataJson === 'string' ? JSON.parse(metadataJson) : metadataJson

  const isRevoked = metadata.revoked === true

  debug('token revocation check result', { isRevoked }).log(
    'oauth.jwt.isTokenRevoked'
  )

  return isRevoked
}

/**
 * Revoke an OAuth token
 *
 * @param accessToken - The JWT access token to revoke
 * @returns True if token was revoked, false if token not found
 */
export async function revokeToken(accessToken: string): Promise<boolean> {
  debug('revoking token').log('oauth.jwt.revokeToken')

  const redisKey = await getTokenMetadataRedisKey(accessToken)

  const metadataJson = await memcache.get(redisKey)

  if (!metadataJson) {
    // Token doesn't exist in our system

    debug('token not found for revocation').log('oauth.jwt.revokeToken')

    return false
  }

  const metadata =
    typeof metadataJson === 'string' ? JSON.parse(metadataJson) : metadataJson

  // Mark as revoked and update in Redis with original TTL

  const updatedMetadata: OAuthTokenMetadata = {
    ...metadata,
    revoked: true,
  }

  // Get remaining TTL to preserve expiry

  const ttl = await memcache.ttl(redisKey)

  debug('updating token metadata with revocation', { ttl }).log(
    'oauth.jwt.revokeToken'
  )

  if (ttl > 0) {
    await memcache.set(redisKey, JSON.stringify(updatedMetadata), { ex: ttl })
  } else {
    // If no TTL, just set without expiry (shouldn't happen)

    await memcache.set(redisKey, JSON.stringify(updatedMetadata))
  }

  debug('token revoked successfully').log('oauth.jwt.revokeToken')

  return true
}

// ---
// Refresh Token Management (RFC 6749 Section 6)
// ---

/**
 * Refresh Token Data
 *
 * Data structure stored in Redis for refresh tokens
 */
export interface RefreshTokenData {
  token: string
  userId: string
  portalId: string
  portalUserId: string
  contactId: string
  scope: string
  clientId: string
  createdAt: number
  revoked?: boolean
}

/**
 * Prefix for refresh tokens to distinguish them from access tokens
 */
export const REFRESH_TOKEN_PREFIX = 'cbk_rt_'

/**
 * Check if a token is a refresh token based on its prefix
 *
 * @param token - The token to check
 * @returns True if the token starts with the refresh token prefix
 */
export function isRefreshToken(token: string): boolean {
  return token.startsWith(REFRESH_TOKEN_PREFIX)
}

/**
 * Gets the Redis key for a refresh token
 *
 * @param token - The refresh token
 * @returns The Redis key
 */
function getRefreshTokenRedisKey(token: string): string {
  return `apps:oauth:refresh:${token}`
}

/**
 * Generate and store a refresh token
 *
 * @param data - Refresh token data (without the token itself)
 * @param expirySeconds - Time to live in seconds (default: 30 days)
 * @returns The generated refresh token
 */
export async function generateRefreshToken(
  data: Omit<RefreshTokenData, 'token' | 'createdAt'>,
  expirySeconds: number = REFRESH_TOKEN_TTL_SECONDS
): Promise<string> {
  debug('generating refresh token', {
    userId: data.userId,
    portalId: data.portalId,
    clientId: data.clientId,
    scope: data.scope,
    expirySeconds,
  }).log('oauth.jwt.generateRefreshToken')

  const token = `${REFRESH_TOKEN_PREFIX}${cuid()}`

  const refreshTokenData: RefreshTokenData = {
    ...data,

    token: token,
    createdAt: Date.now(),
  }

  const redisKey = getRefreshTokenRedisKey(token)

  await memcache.set(redisKey, JSON.stringify(refreshTokenData), {
    ex: expirySeconds,
  })

  debug('generated refresh token', {
    tokenPrefix: token.substring(0, 12) + '...',
  }).log('oauth.jwt.generateRefreshToken')

  return token
}

/**
 * Retrieve refresh token data from Redis
 *
 * @param token - The refresh token
 * @returns Refresh token data or null if not found/expired
 */
export async function retrieveRefreshToken(
  token: string
): Promise<RefreshTokenData | null> {
  debug('retrieving refresh token', {
    tokenPrefix: token.substring(0, 12) + '...',
  }).log('oauth.jwt.retrieveRefreshToken')

  const redisKey = getRefreshTokenRedisKey(token)

  const dataJson = await memcache.get(redisKey)

  if (!dataJson) {
    debug('refresh token not found').log('oauth.jwt.retrieveRefreshToken')

    return null
  }

  const data = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson

  debug('retrieved refresh token', {
    userId: data.userId,
    portalId: data.portalId,
    revoked: data.revoked,
  }).log('oauth.jwt.retrieveRefreshToken')

  return data as RefreshTokenData
}

/**
 * Validate a refresh token
 *
 * Checks that the token exists, is not revoked, and optionally validates
 * the client_id matches.
 *
 * @param token - The refresh token to validate
 * @param clientId - Optional client ID to validate against
 * @returns Refresh token data if valid, null otherwise
 */
export async function validateRefreshToken(
  token: string,
  clientId?: string
): Promise<RefreshTokenData | null> {
  debug('validating refresh token', {
    tokenPrefix: token.substring(0, 12) + '...',
    clientId,
  }).log('oauth.jwt.validateRefreshToken')

  const data = await retrieveRefreshToken(token)

  if (!data) {
    debug('refresh token validation failed: not found').log(
      'oauth.jwt.validateRefreshToken'
    )

    return null
  }

  if (data.revoked) {
    debug('refresh token validation failed: revoked').log(
      'oauth.jwt.validateRefreshToken'
    )

    return null
  }

  if (clientId && data.clientId !== clientId) {
    debug('refresh token validation failed: client mismatch', {
      expected: clientId,
      actual: data.clientId,
    }).log('oauth.jwt.validateRefreshToken')

    return null
  }

  debug('refresh token validated successfully').log(
    'oauth.jwt.validateRefreshToken'
  )

  return data
}

/**
 * Revoke a refresh token
 *
 * @param token - The refresh token to revoke
 * @returns True if token was revoked, false if not found
 */
export async function revokeRefreshToken(token: string): Promise<boolean> {
  debug('revoking refresh token', {
    tokenPrefix: token.substring(0, 12) + '...',
  }).log('oauth.jwt.revokeRefreshToken')

  const redisKey = getRefreshTokenRedisKey(token)

  const dataJson = await memcache.get(redisKey)

  if (!dataJson) {
    debug('refresh token not found for revocation').log(
      'oauth.jwt.revokeRefreshToken'
    )

    return false
  }

  const data = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson

  const updatedData: RefreshTokenData = {
    ...data,
    revoked: true,
  }

  // Preserve remaining TTL

  const ttl = await memcache.ttl(redisKey)

  debug('updating refresh token with revocation', { ttl }).log(
    'oauth.jwt.revokeRefreshToken'
  )

  if (ttl > 0) {
    await memcache.set(redisKey, JSON.stringify(updatedData), { ex: ttl })
  } else {
    await memcache.set(redisKey, JSON.stringify(updatedData))
  }

  debug('refresh token revoked successfully').log(
    'oauth.jwt.revokeRefreshToken'
  )

  return true
}

/**
 * Delete a refresh token (for rotation)
 *
 * @param token - The refresh token to delete
 */
export async function deleteRefreshToken(token: string): Promise<void> {
  debug('deleting refresh token', {
    tokenPrefix: token.substring(0, 12) + '...',
  }).log('oauth.jwt.deleteRefreshToken')

  const redisKey = getRefreshTokenRedisKey(token)

  await memcache.del(redisKey)

  debug('deleted refresh token').log('oauth.jwt.deleteRefreshToken')
}

/**
 * Rotate a refresh token
 *
 * Deletes the old token and generates a new one with the same data. This is a
 * security best practice to limit the window of token theft.
 *
 * @param oldToken - The current refresh token
 * @returns New refresh token data, or null if old token invalid
 */
export async function rotateRefreshToken(
  oldToken: string
): Promise<{ refreshToken: string; data: RefreshTokenData } | null> {
  debug('rotating refresh token', {
    oldTokenPrefix: oldToken.substring(0, 12) + '...',
  }).log('oauth.jwt.rotateRefreshToken')

  // @note consume-and-replace has to be atomic: with a separate read,
  // validate and delete, two concurrent exchanges of the same token both
  // validate it and both mint a replacement. `getdel` hands the record to
  // exactly one caller; every other concurrent caller sees nothing.

  const consumed = await memcache.getdel(getRefreshTokenRedisKey(oldToken))

  if (!consumed) {
    debug('refresh token rotation failed: invalid old token').log(
      'oauth.jwt.rotateRefreshToken'
    )

    return null
  }

  const oldData = (
    typeof consumed === 'string' ? JSON.parse(consumed) : consumed
  ) as RefreshTokenData

  if (oldData.revoked) {
    // @note consumed either way: a revoked token has no further use
    debug('refresh token rotation failed: revoked').log(
      'oauth.jwt.rotateRefreshToken'
    )

    return null
  }

  // @note from here the old token is gone. If issuing the replacement fails,
  // the caller gets an error and neither family is live - the client has to
  // re-authorize. That is the deliberate choice: a transient error must not
  // leave two valid refresh tokens behind, and it must not resurrect one
  // that has been consumed.

  const newToken = await generateRefreshToken({
    userId: oldData.userId,
    portalId: oldData.portalId,
    portalUserId: oldData.portalUserId,
    contactId: oldData.contactId,
    scope: oldData.scope,
    clientId: oldData.clientId,
  })

  const newData = await retrieveRefreshToken(newToken)

  debug('refresh token rotated successfully', {
    newTokenPrefix: newToken.substring(0, 12) + '...',
  }).log('oauth.jwt.rotateRefreshToken')

  return { refreshToken: newToken, data: newData! }
}

// ---
// Dynamic Client Registration (RFC 7591)
// ---

/**
 * Time to live for dynamically registered clients (90 days)
 *
 * @note clients that are not used within this period will be removed
 */
const DYNAMIC_CLIENT_TTL_SECONDS = 90 * 24 * 60 * 60

/**
 * Dynamic Client Registration Request
 *
 * Represents the metadata sent by a client during dynamic registration.
 * Based on RFC 7591 Section 2.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7591#section-2
 */
export interface DynamicClientRegistrationRequest {
  redirect_uris?: string[]
  token_endpoint_auth_method?:
    | 'none'
    | 'client_secret_post'
    | 'client_secret_basic'
  grant_types?: string[]
  response_types?: string[]
  client_name?: string
  client_uri?: string
  logo_uri?: string
  scope?: string
  contacts?: string[]
  tos_uri?: string
  policy_uri?: string
  software_id?: string
  software_version?: string
}

/**
 * Dynamic Client Registration Response
 *
 * The response returned after successful client registration.
 * Based on RFC 7591 Section 3.2.1.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7591#section-3.2.1
 */
export interface DynamicClientRegistrationResponse {
  client_id: string
  client_secret?: string
  client_id_issued_at?: number
  client_secret_expires_at?: number
  redirect_uris?: string[]
  token_endpoint_auth_method: string
  grant_types: string[]
  response_types: string[]
  client_name?: string
  client_uri?: string
  logo_uri?: string
  scope?: string
  contacts?: string[]
  tos_uri?: string
  policy_uri?: string
  software_id?: string
  software_version?: string
}

/**
 * Stored Dynamic Client Data
 *
 * Internal representation of a dynamically registered client.
 */
export interface DynamicClientData {
  clientId: string
  portalId: string
  redirectUris: string[]
  tokenEndpointAuthMethod: string
  grantTypes: string[]
  responseTypes: string[]
  clientName?: string
  clientUri?: string
  logoUri?: string
  scope?: string
  contacts?: string[]
  tosUri?: string
  policyUri?: string
  softwareId?: string
  softwareVersion?: string
  createdAt: number
}

/**
 * Gets the Redis key for a dynamic client
 *
 * @param portalId - The portal ID
 * @param clientId - The client ID
 * @returns The Redis key
 */
function getDynamicClientRedisKey(portalId: string, clientId: string): string {
  return `apps:oauth:client:${portalId}:${clientId}`
}

/**
 * Register a dynamic client
 *
 * Implements RFC 7591 dynamic client registration for MCP clients.
 *
 * @param portalId - The portal ID
 * @param request - The client registration request
 * @returns The client registration response
 */
export async function registerDynamicClient(
  portalId: string,
  request: DynamicClientRegistrationRequest
): Promise<DynamicClientRegistrationResponse> {
  debug('registering dynamic client', {
    portalId,
    clientName: request.client_name,
    redirectUris: request.redirect_uris,
    grantTypes: request.grant_types,
  }).log('oauth.jwt.registerDynamicClient')

  // Generate client ID

  const clientId = `cbk_client_${cuid()}`

  // Validate redirect URIs if provided

  if (request.redirect_uris) {
    for (const uri of request.redirect_uris) {
      if (!validateRedirectUri(uri)) {
        debug('invalid redirect uri in registration', { uri }).log(
          'oauth.jwt.registerDynamicClient'
        )

        throw new Error(`Invalid redirect_uri: ${uri}`)
      }
    }
  }

  // @note we only support public clients (PKCE) so no client secret is issued

  const clientData: DynamicClientData = {
    clientId,
    portalId,
    redirectUris: request.redirect_uris || [],
    tokenEndpointAuthMethod: request.token_endpoint_auth_method || 'none',
    grantTypes: request.grant_types || ['authorization_code', 'refresh_token'],
    responseTypes: request.response_types || ['code'],
    clientName: request.client_name,
    clientUri: request.client_uri,
    logoUri: request.logo_uri,
    scope: request.scope,
    contacts: request.contacts,
    tosUri: request.tos_uri,
    policyUri: request.policy_uri,
    softwareId: request.software_id,
    softwareVersion: request.software_version,
    createdAt: Date.now(),
  }

  // Store in Redis

  const redisKey = getDynamicClientRedisKey(portalId, clientId)

  await memcache.set(redisKey, JSON.stringify(clientData), {
    ex: DYNAMIC_CLIENT_TTL_SECONDS,
  })

  debug('dynamic client registered', {
    clientId,
    portalId,
  }).log('oauth.jwt.registerDynamicClient')

  // Build response

  const response: DynamicClientRegistrationResponse = {
    client_id: clientId,
    client_id_issued_at: Math.floor(clientData.createdAt / 1000),
    redirect_uris: clientData.redirectUris,
    token_endpoint_auth_method: clientData.tokenEndpointAuthMethod,
    grant_types: clientData.grantTypes,
    response_types: clientData.responseTypes,
  }

  // Add optional fields if present

  if (clientData.clientName) {
    response.client_name = clientData.clientName
  }

  if (clientData.clientUri) {
    response.client_uri = clientData.clientUri
  }

  if (clientData.logoUri) {
    response.logo_uri = clientData.logoUri
  }

  if (clientData.scope) {
    response.scope = clientData.scope
  }

  if (clientData.contacts) {
    response.contacts = clientData.contacts
  }

  if (clientData.tosUri) {
    response.tos_uri = clientData.tosUri
  }

  if (clientData.policyUri) {
    response.policy_uri = clientData.policyUri
  }

  if (clientData.softwareId) {
    response.software_id = clientData.softwareId
  }

  if (clientData.softwareVersion) {
    response.software_version = clientData.softwareVersion
  }

  return response
}

/**
 * Retrieve a dynamic client by ID
 *
 * @param portalId - The portal ID
 * @param clientId - The client ID
 * @returns The client data or null if not found
 */
export async function getDynamicClient(
  portalId: string,
  clientId: string
): Promise<DynamicClientData | null> {
  debug('getting dynamic client', { portalId, clientId }).log(
    'oauth.jwt.getDynamicClient'
  )

  const redisKey = getDynamicClientRedisKey(portalId, clientId)

  const dataJson = await memcache.get(redisKey)

  if (!dataJson) {
    debug('dynamic client not found', { portalId, clientId }).log(
      'oauth.jwt.getDynamicClient'
    )

    return null
  }

  const data = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson

  debug('retrieved dynamic client', {
    clientId,
    clientName: data.clientName,
  }).log('oauth.jwt.getDynamicClient')

  return data as DynamicClientData
}

/**
 * Refresh a dynamic client's TTL
 *
 * Called when the client is used to extend its lifetime.
 *
 * @param portalId - The portal ID
 * @param clientId - The client ID
 */
export async function refreshDynamicClientTTL(
  portalId: string,
  clientId: string
): Promise<void> {
  debug('refreshing dynamic client ttl', { portalId, clientId }).log(
    'oauth.jwt.refreshDynamicClientTTL'
  )

  const redisKey = getDynamicClientRedisKey(portalId, clientId)

  const dataJson = await memcache.get(redisKey)

  if (dataJson) {
    await memcache.expire(redisKey, DYNAMIC_CLIENT_TTL_SECONDS)

    debug('dynamic client ttl refreshed', { portalId, clientId }).log(
      'oauth.jwt.refreshDynamicClientTTL'
    )
  } else {
    debug('dynamic client not found for ttl refresh', {
      portalId,
      clientId,
    }).log('oauth.jwt.refreshDynamicClientTTL')
  }
}
