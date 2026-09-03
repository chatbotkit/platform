/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Pipedream) */
import prisma from '@/prisma/client'

import fetch from '@/lib/fetch'
import { tryVerify } from '@/lib/jwt'
import { withFormUrlencodedPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { getSecretOAuthConfig } from '@/lib/secret.oauth'

import type { AccessTokenPayload, RefreshTokenPayload } from './token'
import { PIPEDREAM_ACCESS_TOKEN, PIPEDREAM_REFRESH_TOKEN } from './token'

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
 * Custom OAuth token revocation endpoint for Pipedream that invalidates
 * Connect tokens and follows RFC 7009 token revocation specification.
 *
 * This endpoint handles revocation for both access tokens and refresh tokens:
 *
 * 1. Access Token Revocation:
 *    - Verifies and decodes the JWT access token
 *    - Extracts accountId from token payload
 *    - Obtains OAuth credentials from database using secretId
 *    - Obtains new OAuth token via client_credentials
 *    - Deletes the Connect account from Pipedream
 *
 * 2. Refresh Token Revocation:
 *    - Same process as access token revocation
 *    - Uses accountId stored in refresh token payload
 *
 * The endpoint returns 200 OK for both successful revocations and
 * invalid/expired tokens, as per RFC 7009 recommendation for security.
 *
 * API References:
 * - OAuth Token: https://pipedream.com/docs/connect/api-reference/create-oauth-token
 * - Delete Account: https://pipedream.com/docs/connect/api-reference/delete-account
 * - RFC 7009: https://tools.ietf.org/html/rfc7009
 */
export default withFormUrlencodedPost(async function (
  req: Request
): Promise<Response> {
  const body = await req.json()

  const { token } = body

  if (!token || typeof token !== 'string') {
    return oauthError(
      400,
      'invalid_request',
      'Missing or invalid token parameter'
    )
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
    // @note rfc 7009 recommends returning 200 ok even for invalid tokens to
    // prevent token scanning attacks

    return ok()
  }

  // @note token_type_hint is optional and only used for optimization - we
  // determine actual token type from payload

  const secret = await prisma.secret.findUnique({
    where: {
      id: payload.secretId,
    },
  })

  if (!secret) {
    // @note secret may have been deleted - return success per rfc 7009

    return ok()
  }

  const { clientId: pipedreamClientId, clientSecret: pipedreamClientSecret } =
    await getSecretOAuthConfig(secret)

  if (!pipedreamClientId || !pipedreamClientSecret) {
    // @note missing credentials - cannot revoke but return success per rfc 7009

    return ok()
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
    // @note failed to get oauth token - cannot revoke but return success per
    // rfc 7009 to prevent information leakage

    return ok()
  }

  // step 2: delete the connect account from pipedream

  try {
    const url = new URL(
      `https://api.pipedream.com/v1/connect/${payload.projectId}/accounts/${payload.accountId}`
    )

    const deleteResponse = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${oauthAccessToken}`,
        'x-pd-environment': payload.environment,
      },
    })

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text()

      // @note account may already be deleted or not exist - log but return
      // success per rfc 7009

      if (deleteResponse.status !== 404) {
        throw new Error(
          `Failed to delete account ${payload.accountId}: ${deleteResponse.status} ${errorText}`
        )
      }
    }
  } catch {
    // @note deletion failed but return success per rfc 7009 - the token is
    // already invalid from client perspective

    return ok()
  }

  return ok()
})
