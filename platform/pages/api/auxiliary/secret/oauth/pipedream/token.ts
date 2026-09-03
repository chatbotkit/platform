/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Pipedream) */
import { THREE_MONTHS_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import fetch from '@/lib/fetch'
import { sign, tryVerify } from '@/lib/jwt'
import { withFormUrlencodedPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { getSecretOAuthConfig } from '@/lib/secret.oauth'

import type { CodePayload } from './authorize'

export const PIPEDREAM_ACCESS_TOKEN = 'pipedream_access_token'
export const PIPEDREAM_REFRESH_TOKEN = 'pipedream_refresh_token'

export interface AccessTokenPayload {
  type: typeof PIPEDREAM_ACCESS_TOKEN

  secretId: string
  userId: string

  projectId: string
  environment: string
  externalUserId: string
  accountId: string
  clientId: string
}

export interface RefreshTokenPayload {
  type: typeof PIPEDREAM_REFRESH_TOKEN

  secretId: string
  userId: string

  projectId: string
  environment: string
  externalUserId: string
  accountId: string
  clientId: string
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function oauthError(
  status: number,
  error: string,
  errorDescription: string
): Response {
  return new Response(
    JSON.stringify({ error, error_description: errorDescription }),
    { status, headers: JSON_HEADERS }
  )
}

/**
 * Custom OAuth token endpoint for Pipedream that returns pre-authenticated
 * Connect tokens and supports refresh token flow.
 *
 * This endpoint handles two grant types:
 *
 * 1. authorization_code:
 *    - Verifies and decodes the authorization code from authorize flow
 *    - Returns the pre-authenticated Connect token
 *    - Issues a JWT refresh token (90-day expiration)
 *
 * 2. refresh_token:
 *    - Verifies the JWT refresh token
 *    - Retrieves OAuth credentials from database using secretId
 *    - Obtains new OAuth token via client_credentials
 *    - Creates new Connect token for the user
 *    - Issues new refresh token (rotation for security)
 *
 * API References:
 * - OAuth Token: https://pipedream.com/docs/connect/api-reference/create-oauth-token
 * - Connect Token: https://pipedream.com/docs/connect/api-reference/create-connect-token
 */
export default withFormUrlencodedPost(async function (
  req: Request
): Promise<Response> {
  const body = await req.json()

  const { grant_type } = body

  debug(`received token request`, { grant_type })

  switch (grant_type) {
    case 'authorization_code': {
      return handleAuthorizationCodeGrant(body)
    }

    case 'refresh_token': {
      return handleRefreshTokenGrant(body)
    }

    default: {
      return oauthError(
        400,
        'unsupported_grant_type',
        'Only authorization_code and refresh_token grant types are supported'
      )
    }
  }
})

/**
 * Handle authorization_code grant type
 */
async function handleAuthorizationCodeGrant(
  body: Record<string, unknown>
): Promise<Response> {
  const { code, client_id } = body

  debug(`handling authorization_code grant`, { code, client_id })

  if (!code || typeof code !== 'string') {
    return oauthError(
      400,
      'invalid_request',
      'Missing or invalid code parameter'
    )
  }

  if (!client_id || typeof client_id !== 'string') {
    return oauthError(
      400,
      'invalid_request',
      'Missing or invalid client_id parameter'
    )
  }

  let payload: CodePayload

  try {
    const verified = await tryVerify(code)

    if (!verified) {
      throw new Error('Invalid code')
    }

    payload = verified as typeof payload
  } catch {
    return oauthError(
      400,
      'invalid_grant',
      'Invalid or expired authorization code'
    )
  }

  if (payload.clientId !== client_id) {
    return oauthError(400, 'invalid_grant', 'Client ID mismatch')
  }

  const accessTokenPayload: AccessTokenPayload = {
    type: PIPEDREAM_ACCESS_TOKEN,

    secretId: payload.secretId,
    userId: payload.userId,

    projectId: payload.projectId,
    environment: payload.environment,
    externalUserId: payload.externalUserId,
    accountId: payload.accountId,
    clientId: client_id,
  }

  const accessToken = await sign(accessTokenPayload, THREE_MONTHS_IN_SECONDS)

  const refreshTokenPayload: RefreshTokenPayload = {
    type: PIPEDREAM_REFRESH_TOKEN,

    userId: payload.userId,
    secretId: payload.secretId,

    projectId: payload.projectId,
    environment: payload.environment,
    externalUserId: payload.externalUserId,
    accountId: payload.accountId,
    clientId: client_id,
  }

  const refreshToken = await sign(refreshTokenPayload, THREE_MONTHS_IN_SECONDS)

  if (!refreshToken) {
    return oauthError(500, 'server_error', 'Failed to generate refresh token')
  }

  return ok({
    token_type: 'Bearer',

    access_token: accessToken,
    expires_in: THREE_MONTHS_IN_SECONDS,

    refresh_token: refreshToken,
    refresh_token_expires_in: THREE_MONTHS_IN_SECONDS,
  })
}

/**
 * Handle refresh_token grant type
 */
async function handleRefreshTokenGrant(
  body: Record<string, unknown>
): Promise<Response> {
  const { refresh_token, client_id } = body

  debug(`handling refresh_token grant`, { refresh_token, client_id })

  if (!refresh_token || typeof refresh_token !== 'string') {
    return oauthError(
      400,
      'invalid_request',
      'Missing or invalid refresh_token parameter'
    )
  }

  if (!client_id || typeof client_id !== 'string') {
    return oauthError(
      400,
      'invalid_request',
      'Missing or invalid client_id parameter'
    )
  }

  let payload: RefreshTokenPayload

  try {
    const verified = await tryVerify(refresh_token)

    if (!verified || typeof verified !== 'object') {
      throw new Error('Invalid refresh token')
    }

    payload = verified as typeof payload

    if (payload.type !== PIPEDREAM_REFRESH_TOKEN) {
      throw new Error('Invalid token type')
    }
  } catch {
    return oauthError(400, 'invalid_grant', 'Invalid or expired refresh token')
  }

  if (payload.clientId !== client_id) {
    return oauthError(400, 'invalid_grant', 'Client ID mismatch')
  }

  const secret = await prisma.secret.findUnique({
    where: {
      id: payload.secretId,
    },
  })

  if (!secret) {
    return oauthError(
      400,
      'invalid_grant',
      'Secret not found or has been deleted'
    )
  }

  const { clientId: pipedreamClientId, clientSecret: pipedreamClientSecret } =
    await getSecretOAuthConfig(secret)

  if (!pipedreamClientId || !pipedreamClientSecret) {
    return oauthError(
      400,
      'invalid_grant',
      'Missing OAuth credentials in secret configuration'
    )
  }

  // step 1: obtain oauth access token using client_credentials

  let oauthAccessToken: string

  try {
    const response = await fetch('https://api.pipedream.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: pipedreamClientId,
        client_secret: pipedreamClientSecret,
        scope: 'connect:tokens:create',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()

      throw new Error(
        `Pipedream OAuth token request failed: ${response.status} ${errorText}`
      )
    }

    const data = await response.json()

    oauthAccessToken = data.access_token

    if (!oauthAccessToken) {
      throw new Error('No access token in Pipedream OAuth response')
    }
  } catch (error) {
    return oauthError(
      500,
      'server_error',
      `Failed to obtain OAuth token from Pipedream: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }

  // step 2: create new access and refresh tokens

  const accessTokenPayload: AccessTokenPayload = {
    type: PIPEDREAM_ACCESS_TOKEN,

    secretId: payload.secretId,
    userId: payload.userId,

    projectId: payload.projectId,
    environment: payload.environment,
    externalUserId: payload.externalUserId,
    accountId: payload.accountId,
    clientId: client_id,
  }

  const accessToken = await sign(accessTokenPayload, THREE_MONTHS_IN_SECONDS)

  const refreshTokenPayload: RefreshTokenPayload = {
    type: PIPEDREAM_REFRESH_TOKEN,

    secretId: payload.secretId,
    userId: payload.userId,

    projectId: payload.projectId,
    environment: payload.environment,
    externalUserId: payload.externalUserId,
    accountId: payload.accountId,
    clientId: client_id,
  }

  const newRefreshToken = await sign(
    refreshTokenPayload,
    THREE_MONTHS_IN_SECONDS
  )

  if (!newRefreshToken) {
    return oauthError(
      500,
      'server_error',
      'Failed to generate new refresh token'
    )
  }

  return ok({
    token_type: 'Bearer',

    access_token: accessToken,
    expires_in: THREE_MONTHS_IN_SECONDS,

    refresh_token: newRefreshToken,
    refresh_token_expires_in: THREE_MONTHS_IN_SECONDS,
  })
}
