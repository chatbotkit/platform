import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import { encode as encodeB64 } from '@/lib/b64'
import debug from '@/lib/debug'
import fetch from '@/lib/egress.fetch'
import { getExternalFrontendHostURL, getExternalHostURL } from '@/lib/host'
import { isParsable as isParsableJson, parse as parseJson } from '@/lib/json'
import { trySign } from '@/lib/jwt'
import { isParsable as isParsableQuery, parse as parseQuery } from '@/lib/query'
import { z } from '@/lib/zod.schema'

/**
 * Zod schema for validating OAuth token responses per RFC 6749. Ensures
 * access_token is a non-empty string and optional fields have correct types.
 *
 * Uses coerce for numeric fields to handle query-string responses where numbers
 * are strings.
 */
const TokenResponseSchema = z.object({
  access_token: z
    .string({ required_error: 'access_token is required' })
    .min(1, 'access_token cannot be empty'),
  // @note coerce handles query-string responses where expires_in is a string like "3600"
  expires_in: z.coerce.number().optional(),
  refresh_token: z.string().optional(),
  // @note coerce handles query-string responses where this is a string
  refresh_token_expires_in: z.coerce.number().optional(),
  additional_properties: z.record(z.unknown()).optional(),
})

/**
 * Returns the OAuth callback URL for this platform deployment.
 *
 * @returns The OAuth callback URL
 */
export async function getCallbackURL(): Promise<string> {
  return getExternalHostURL(`/secrets/oauth/callback`)
}

/**
 * Options for building an OAuth authorization URL.
 */
interface AuthorizationOptions {
  /**
   * Client ID issued by the authorization server.
   */
  clientId: string
  /**
   * Authorization endpoint URL.
   */
  authorizationUrl: string | URL
  /**
   * Requested scopes (space-separated).
   */
  scope?: string
  /**
   * PKCE code challenge for public clients. When provided, code_challenge and
   * code_challenge_method will be included.
   */
  codeChallenge?: string
  /**
   * PKCE code challenge method. Defaults to 'S256'.
   */
  codeChallengeMethod?: 'S256'
}

/**
 * Builds an OAuth authorization URL with the required parameters (client ID,
 * redirect URI, response type, scope, and signed state token). Handles
 * provider-specific quirks for Slack and Zoom.
 *
 * @param options - Authorization endpoint configuration
 * @param state - State object to be signed and included in the authorization request
 * @returns The constructed authorization URL
 */
export async function getAuthorizationURL(
  options: AuthorizationOptions,
  state: Record<string, unknown>
): Promise<URL> {
  const redirectUri = await getCallbackURL()

  // @note the redirect URI is bound into the signed state so authorization
  // endpoints we host (the Pipedream Connect flow) can require the request's
  // redirect_uri to match the one this URL was minted with, instead of
  // trusting the mutable query value

  const stateToken = await trySign(
    { ...state, redirectUri },
    QUARTER_HOUR_IN_SECONDS
  )

  if (!stateToken) {
    throw new Error('State token failed')
  }

  const url = new URL(options.authorizationUrl, getExternalFrontendHostURL())

  // Add standard parameters

  url.searchParams.append('client_id', options.clientId)
  url.searchParams.append('redirect_uri', redirectUri)
  url.searchParams.append('response_type', 'code')
  url.searchParams.append('scope', options.scope || '')
  url.searchParams.append('state', stateToken)

  // Add PKCE parameters if provided

  if (options.codeChallenge) {
    url.searchParams.append('code_challenge', options.codeChallenge)
    url.searchParams.append(
      'code_challenge_method',
      options.codeChallengeMethod || 'S256'
    )
  }

  // caveats
  // @todo needs to be generalized
  {
    switch (true) {
      // slack

      case url.hostname === 'slack.com': {
        // @todo it needs to be generalized for all user scopes

        if (options.scope?.includes('search:read')) {
          url.searchParams.append('user_scope', options.scope)

          url.searchParams.delete('scope')
        }

        break
      }

      // zoom

      case url.hostname === 'zoom.us': {
        url.searchParams.delete('scope')

        break
      }
    }
  }

  return url
}

/**
 * Options for token endpoint requests.
 */
interface TokenOptions {
  /**
   * Client ID issued by the authorization server.
   */
  clientId: string
  /**
   * Client secret. Optional for public clients using PKCE.
   */
  clientSecret?: string
  /**
   * Token endpoint URL.
   */
  tokenUrl: string
  /**
   * PKCE code verifier. Required when the authorization request used PKCE.
   */
  codeVerifier?: string
}

/**
 * Credentials obtained via the authorization code grant flow.
 */
interface AuthorizationCodeGrantCredentials {
  accessToken: string
  accessTokenExpiresAt?: Date
  refreshToken?: string
  refreshTokenExpiresAt?: Date
  additionalProperties?: Record<string, unknown>
}

/**
 * Exchanges an OAuth authorization code for access and refresh tokens using the
 * authorization code grant flow. Handles provider-specific authentication
 * requirements for Reddit, Notion, and Slack.
 *
 * @param code - The authorization code received from the authorization server
 * @param options - Token endpoint configuration
 * @returns Credentials including access and refresh tokens
 * @throws Error if the token request fails or the response is not parsable
 */
export async function getAuthorizationCodeGrantCredentials(
  code: string,
  options: TokenOptions
): Promise<AuthorizationCodeGrantCredentials> {
  const tokenUrl = new URL(options.tokenUrl, getExternalFrontendHostURL())

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  const data: Record<string, string> = {
    code: code,
    client_id: options.clientId,
    redirect_uri: await getCallbackURL(),
    grant_type: 'authorization_code',
  }

  // Add client_secret if provided (confidential clients)

  if (options.clientSecret) {
    data.client_secret = options.clientSecret
  }

  // Add code_verifier if provided (PKCE flow)

  if (options.codeVerifier) {
    data.code_verifier = options.codeVerifier
  }

  // caveats
  // @todo needs to be generalized
  {
    switch (true) {
      // reddit

      case tokenUrl.href === 'https://www.reddit.com/api/v1/access_token': {
        headers['Authorization'] = `Basic ${encodeB64(
          `${options.clientId}:${options.clientSecret || ''}`
        )}`

        break
      }

      // notion

      case tokenUrl.href === 'https://api.notion.com/v1/oauth/token': {
        headers['Authorization'] = `Basic ${encodeB64(
          `${options.clientId}:${options.clientSecret || ''}`
        )}`

        break
      }
    }
  }

  const response = await fetch(tokenUrl.href, {
    method: 'POST',
    headers: headers,
    body: new URLSearchParams(data),
  })

  if (!response.ok) {
    if (process.env.NODE_ENV === 'development') {
      debug(`failed to get authorization code grant credentials`, {
        status: response.status,
        statusText: response.statusText,
        body: await response.text(),
      }).log() // @note always log
    }

    throw new Error('Token request failed')
  }

  const text = await response.text()

  let info: Record<string, unknown>

  {
    switch (true) {
      case isParsableJson(text): {
        info = parseJson(text) as Record<string, unknown>

        break
      }

      case isParsableQuery(text): {
        info = parseQuery(text) as Record<string, unknown>

        break
      }

      default: {
        throw new Error('Response is not parsable')
      }
    }
  }

  // caveats
  // @todo needs to be generalized
  {
    switch (true) {
      // slack

      case tokenUrl.href === 'https://slack.com/api/oauth.v2.access': {
        info = (info.authed_user as Record<string, unknown>) || info

        break
      }
    }
  }

  // @note passthrough allows extra fields like token_type, scope, etc.

  const parsed = TokenResponseSchema.passthrough().safeParse(info)

  if (!parsed.success) {
    throw new Error(`Invalid token response: ${parsed.error.message}`)
  }

  const {
    access_token,
    expires_in,
    refresh_token,
    refresh_token_expires_in,
    additional_properties,
  } = parsed.data

  return {
    accessToken: access_token,
    accessTokenExpiresAt:
      typeof expires_in === 'number'
        ? new Date(Date.now() + expires_in * 1000)
        : undefined,

    refreshToken: refresh_token,
    refreshTokenExpiresAt:
      typeof refresh_token_expires_in === 'number'
        ? new Date(Date.now() + refresh_token_expires_in * 1000)
        : undefined,

    additionalProperties: additional_properties,
  }
}

/**
 * Options for client credentials grant token requests.
 */
interface ClientCredentialsGrantCredentials {
  accessToken: string
  accessTokenExpiresAt?: Date
  additionalProperties?: Record<string, string>
}

/**
 * Obtains access tokens using the OAuth client credentials grant flow,
 * typically used for server-to-server authentication without user involvement.
 *
 * @param options - Token endpoint configuration
 * @returns Credentials including an access token
 * @throws Error if the token request fails or the response is not parsable
 */
export async function getClientCredentialsGrantCredentials(
  options: TokenOptions
): Promise<ClientCredentialsGrantCredentials> {
  const tokenUrl = new URL(options.tokenUrl, getExternalFrontendHostURL())

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  const data: Record<string, string> = {
    client_id: options.clientId,
    grant_type: 'client_credentials',
  }

  if (options.clientSecret) {
    data.client_secret = options.clientSecret
  }

  // caveats
  // @todo needs to be generalized
  {
    // pass
  }

  const response = await fetch(tokenUrl.href, {
    method: 'POST',
    headers: headers,
    body: new URLSearchParams(data),
  })

  if (!response.ok) {
    if (process.env.NODE_ENV === 'development') {
      debug(`failed to get client credentials grant credentials`, {
        status: response.status,
        statusText: response.statusText,
        body: await response.text(),
      }).log() // @note always log
    }

    throw new Error('Token request failed')
  }

  const text = await response.text()

  let info: Record<string, unknown>

  {
    switch (true) {
      case isParsableJson(text): {
        info = parseJson(text) as Record<string, unknown>

        break
      }

      case isParsableQuery(text): {
        info = parseQuery(text) as Record<string, unknown>

        break
      }

      default: {
        throw new Error('Response is not parsable')
      }
    }
  }

  // caveats
  // @todo needs to be generalized
  {
    // pass
  }

  // @note passthrough allows extra fields like token_type, scope, etc.

  const parsed = TokenResponseSchema.passthrough().safeParse(info)

  if (!parsed.success) {
    throw new Error(`Invalid token response: ${parsed.error.message}`)
  }

  const { access_token, expires_in, additional_properties } = parsed.data

  return {
    accessToken: access_token,
    accessTokenExpiresAt:
      typeof expires_in === 'number'
        ? new Date(Date.now() + expires_in * 1000)
        : undefined,

    additionalProperties: additional_properties as
      | Record<string, string>
      | undefined,
  }
}

/**
 * Options for refreshing an access token.
 */
interface RefreshTokenOptions {
  /**
   * Client ID issued by the authorization server.
   */
  clientId: string
  /**
   * Client secret. Optional for public clients using PKCE.
   */
  clientSecret?: string
  /**
   * Token endpoint URL.
   */
  tokenUrl: string
}

/**
 * Credentials returned from a token refresh request.
 */
interface RefreshTokenCredentials {
  /**
   * New access token.
   */
  accessToken: string
  /**
   * Access token expiration date.
   */
  accessTokenExpiresAt?: Date
  /**
   * New refresh token, if issued by the authorization server.
   */
  refreshToken?: string
  /**
   * Refresh token expiration date.
   */
  refreshTokenExpiresAt?: Date
  /**
   * Additional properties returned by the token endpoint.
   */
  additionalProperties?: Record<string, unknown>
}

/**
 * Refreshes an access token using a refresh token.
 *
 * @param refreshToken - The refresh token to use
 * @param options - Token endpoint configuration
 * @returns New credentials including a new access token and potentially a new refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  options: RefreshTokenOptions
): Promise<RefreshTokenCredentials> {
  debug(`refreshing access token`, {
    tokenUrl: options.tokenUrl,
    hasClientSecret: !!options.clientSecret,
  }).log('oauth.authorization.refreshAccessToken')

  const tokenUrl = new URL(options.tokenUrl, getExternalFrontendHostURL())

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  const data: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: options.clientId,
  }

  // Add client_secret if provided (confidential clients)

  if (options.clientSecret) {
    data.client_secret = options.clientSecret
  }

  const response = await fetch(tokenUrl.href, {
    method: 'POST',
    headers: headers,
    body: new URLSearchParams(data),
  })

  if (!response.ok) {
    if (process.env.NODE_ENV === 'development') {
      debug(`failed to refresh access token`, {
        status: response.status,
        statusText: response.statusText,
        body: await response.text(),
      }).log('oauth.authorization.refreshAccessToken')
    }

    throw new Error('Token refresh failed')
  }

  const text = await response.text()

  let info: Record<string, unknown>

  {
    switch (true) {
      case isParsableJson(text): {
        info = parseJson(text) as Record<string, unknown>

        break
      }

      case isParsableQuery(text): {
        info = parseQuery(text) as Record<string, unknown>

        break
      }

      default: {
        throw new Error('Response is not parsable')
      }
    }
  }

  // @note passthrough allows extra fields like token_type, scope, etc.

  const parsed = TokenResponseSchema.passthrough().safeParse(info)

  if (!parsed.success) {
    throw new Error(`Invalid token response: ${parsed.error.message}`)
  }

  const {
    access_token,
    expires_in,
    refresh_token,
    refresh_token_expires_in,
    additional_properties,
  } = parsed.data

  debug(`token refresh successful`, {
    hasNewRefreshToken: !!refresh_token,
  }).log('oauth.authorization.refreshAccessToken')

  return {
    accessToken: access_token,
    accessTokenExpiresAt:
      typeof expires_in === 'number'
        ? new Date(Date.now() + expires_in * 1000)
        : undefined,

    // Some servers return a new refresh token (token rotation)

    refreshToken: refresh_token,
    refreshTokenExpiresAt:
      typeof refresh_token_expires_in === 'number'
        ? new Date(Date.now() + refresh_token_expires_in * 1000)
        : undefined,

    additionalProperties: additional_properties,
  }
}
