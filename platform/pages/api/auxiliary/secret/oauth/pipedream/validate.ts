/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Pipedream) */
import prisma from '@/prisma/client'

import fetch from '@/lib/fetch'
import { tryVerify } from '@/lib/jwt'
import { withGet } from '@/lib/method'
import { ok } from '@/lib/response'
import { getSecretOAuthConfig } from '@/lib/secret.oauth'

import type { AccessTokenPayload, RefreshTokenPayload } from './token'
import { PIPEDREAM_ACCESS_TOKEN, PIPEDREAM_REFRESH_TOKEN } from './token'

export interface ValidateSuccessResponse {
  active: boolean
}

export interface ValidateErrorResponse {
  active: boolean
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function inactive(): Response {
  return new Response(JSON.stringify({ active: false }), {
    status: 401,
    headers: JSON_HEADERS,
  })
}

/**
 * OAuth token introspection endpoint for Pipedream that validates tokens
 * and checks account health status following RFC 7662 specification.
 *
 * This endpoint validates both access tokens and refresh tokens by:
 *
 * 1. JWT Validation:
 *    - Extracts token from Authorization Bearer header
 *    - Verifies and decodes the JWT token
 *    - Checks token type (access_token or refresh_token)
 *    - Validates token structure and signature
 *
 * 2. Account Health Check:
 *    - Retrieves OAuth credentials from database
 *    - Obtains OAuth token via client_credentials
 *    - Fetches account details from Pipedream Connect API
 *    - Checks account.healthy status
 *    - Checks account.dead status
 *
 * Response format follows RFC 7662:
 * - active: true/false - indicates if token is valid and account is healthy
 * - account: { healthy, dead, error } - Pipedream account status details
 * - exp: token expiration timestamp
 * - client_id: the client identifier
 *
 * Returns active: false for:
 * - Missing or invalid Authorization header
 * - Invalid or malformed tokens
 * - Expired tokens
 * - Deleted secrets
 * - Unhealthy accounts (healthy: false)
 * - Dead accounts (dead: true)
 * - Missing OAuth credentials
 * - API errors
 *
 * IMPORTANT: This endpoint is used by lib/oauth.token.js validateAccessToken()
 * which determines token validity based on HTTP status codes. A 2xx response
 * indicates a valid token, while non-2xx (e.g., 401) indicates an invalid token.
 * Always return 401 status when the token is invalid, not 200 with active: false.
 *
 * API References:
 * - Retrieve Account: https://pipedream.com/docs/connect/api-reference/retrieve-account
 * - RFC 7662: https://tools.ietf.org/html/rfc7662
 * - @see lib/oauth.token.js - validateAccessToken() determines validity via HTTP status codes
 */
export default withGet(async function (req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || typeof authHeader !== 'string') {
    return inactive()
  }

  const parts = authHeader.split(' ')

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return inactive()
  }

  const token = parts[1]

  if (!token) {
    return inactive()
  }

  let payload: AccessTokenPayload | RefreshTokenPayload

  try {
    const verified = await tryVerify(token)

    if (!verified || typeof verified !== 'object') {
      throw new Error('Invalid token')
    }

    payload = verified as typeof payload

    if (
      payload.type !== PIPEDREAM_ACCESS_TOKEN &&
      payload.type !== PIPEDREAM_REFRESH_TOKEN
    ) {
      throw new Error('Invalid token type')
    }
  } catch {
    return inactive()
  }

  const secret = await prisma.secret.findUnique({
    where: {
      id: payload.secretId,
    },
  })

  if (!secret) {
    return inactive()
  }

  const { clientId: pipedreamClientId, clientSecret: pipedreamClientSecret } =
    await getSecretOAuthConfig(secret)

  if (!pipedreamClientId || !pipedreamClientSecret) {
    return inactive()
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
        scope: '*',
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
  } catch {
    return inactive()
  }

  // step 2: retrieve account details from pipedream

  try {
    const url = new URL(
      `https://api.pipedream.com/v1/connect/${payload.projectId}/accounts/${payload.accountId}`
    )

    const accountResponse = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${oauthAccessToken}`,
        'x-pd-environment': payload.environment,
      },
    })

    if (!accountResponse.ok) {
      if (accountResponse.status === 404) {
        // @note account not found - token is no longer valid

        return inactive()
      }

      const errorText = await accountResponse.text()

      throw new Error(
        `Failed to retrieve account ${payload.accountId}: ${accountResponse.status} ${errorText}`
      )
    }

    const accountData = await accountResponse.json()

    // @note check if account is healthy and not dead per pipedream api spec

    const isHealthy = accountData.healthy === true
    const isDead = accountData.dead === true

    if (!isHealthy || isDead) {
      return inactive()
    }

    // @note token is valid and account is healthy

    return ok({ active: true })
  } catch {
    return inactive()
  }
})
