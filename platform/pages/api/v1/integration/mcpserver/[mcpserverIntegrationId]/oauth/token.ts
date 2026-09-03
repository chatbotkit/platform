import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import {
  OAUTH_TOKEN_PER_CLIENT,
  OAUTH_TOKEN_PER_IP,
  TOO_MANY_ATTEMPTS_MESSAGE,
  checkAuthRate,
  getClientAddress,
} from '@/lib/auth.rate'
import { encodeUint8Array } from '@/lib/b64'
import {
  TRUSTED_NAMESPACE,
  createContactFingerprint,
  ensureTrustedContact,
} from '@/lib/contact.create'
import debug from '@/lib/debug'
import {
  deleteMcpIdpOAuthAuthorizationRequest,
  retrieveMcpIdpOAuthAuthorizationRequest,
} from '@/lib/mcp.oauth.idp'
import { withFormUrlencodedPost } from '@/lib/method'
import {
  REFRESH_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  rotateRefreshToken,
  signOAuthToken,
  storeTokenMetadata,
  validateRefreshToken,
} from '@/lib/oauth.jwt'
import { requiredUrlParam } from '@/lib/query.get'
import {
  badRequest,
  internalServerError,
  notFound,
  ok,
  tooManyRequests,
} from '@/lib/response'

/**
 * OAuth 2.0 Token endpoint for MCP server integrations.
 * Implements RFC 6749 Section 3.2.
 *
 * Handles two grant types:
 * - `authorization_code`: Claude exchanges the CBK-issued code (from the IdP
 *   callback) for a JWT access token. PKCE (S256) is verified here.
 * - `refresh_token`: Claude rotates an existing refresh token.
 *
 * The resulting JWT uses `mcpserverIntegrationId` in the `portalId` claim so
 * `mcp.ts` can verify it with `verifyOAuthToken`.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-3.2
 * @see https://datatracker.ietf.org/doc/html/rfc7636
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
 */
export default withFormUrlencodedPost(async function (req) {
  const mcpserverIntegrationId = requiredUrlParam(req, 'mcpserverIntegrationId')

  const mcpserverIntegration = await prisma.mcpserverIntegration.findUnique({
    where: { id: mcpserverIntegrationId },
    select: { id: true, userId: true, oAuthConnectionId: true },
  })

  if (!mcpserverIntegration?.oAuthConnectionId) {
    return notFound({
      error: 'invalid_request',
      error_description: 'OAuth not available for this MCP server integration',
    })
  }

  // Parse form-encoded body

  const rawBody = await req.text()

  const params = new URLSearchParams(rawBody)

  const grantType = params.get('grant_type')

  debug('token request received', {
    mcpserverIntegrationId,
    grantType,
    clientId: params.get('client_id'),
    hasCode: !!params.get('code'),
    hasRefreshToken: !!params.get('refresh_token'),
  }).log('api.v1.integration.mcpserver.oauth.token')

  {
    const allowed = await checkAuthRate('oauth-token', [
      { identity: getClientAddress(req), limit: OAUTH_TOKEN_PER_IP },
      { identity: params.get('client_id'), limit: OAUTH_TOKEN_PER_CLIENT },
    ])

    if (!allowed) {
      return tooManyRequests({
        error: 'slow_down',
        error_description: TOO_MANY_ATTEMPTS_MESSAGE,
      })
    }
  }

  if (!grantType) {
    return badRequest({
      error: 'invalid_request',
      error_description: 'Missing grant_type parameter',
    })
  }

  if (grantType === 'authorization_code') {
    return handleAuthorizationCodeGrant(
      params,
      mcpserverIntegrationId,
      mcpserverIntegration.userId,
      mcpserverIntegration.oAuthConnectionId
    )
  }

  if (grantType === 'refresh_token') {
    return handleRefreshTokenGrant(params, mcpserverIntegrationId)
  }

  return badRequest({
    error: 'unsupported_grant_type',
    error_description:
      'Only authorization_code and refresh_token grant types are supported',
  })
})

const TOKEN_CACHE_HEADERS = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
}

/**
 * Handles the authorization_code grant type.
 *
 * Exchanges a CBK-issued authorization code for an access token. PKCE is
 * verified against the challenge stored during the authorize step.
 */
async function handleAuthorizationCodeGrant(
  params: URLSearchParams,
  mcpserverIntegrationId: string,
  workspaceUserId: string,
  oAuthConnectionId: string
): Promise<Response> {
  const code = params.get('code')
  const redirectUri = params.get('redirect_uri')
  const clientId = params.get('client_id')
  const codeVerifier = params.get('code_verifier')

  if (!code || !redirectUri || !clientId) {
    return badRequest({
      error: 'invalid_request',
      error_description: 'Missing required parameters',
    })
  }

  if (!codeVerifier) {
    return badRequest({
      error: 'invalid_request',
      error_description: 'code_verifier is required',
    })
  }

  const authRequest = await retrieveMcpIdpOAuthAuthorizationRequest(code)

  if (!authRequest) {
    debug('token auth code not found', {
      code: code.substring(0, 12) + '...',
    }).log('api.v1.integration.mcpserver.oauth.token')

    return badRequest({
      error: 'invalid_grant',
      error_description: 'Authorization code not found or expired',
    })
  }

  // Validate that the code belongs to this integration

  if (authRequest.context.mcpserverIntegrationId !== mcpserverIntegrationId) {
    return badRequest({
      error: 'invalid_grant',
      error_description:
        'Authorization code was not issued for this integration',
    })
  }

  if (authRequest.redirectUri !== redirectUri) {
    return badRequest({
      error: 'invalid_grant',
      error_description: 'redirect_uri does not match',
    })
  }

  if (authRequest.clientId !== clientId) {
    return badRequest({
      error: 'invalid_grant',
      error_description: 'client_id does not match',
    })
  }

  // Verify PKCE code_verifier against stored code_challenge

  const data = new TextEncoder().encode(codeVerifier)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashBytes = new Uint8Array(hashBuffer)
  const computedChallenge = encodeUint8Array(hashBytes, true)

  debug('token pkce verification', {
    match: computedChallenge === authRequest.codeChallenge,
    storedChallenge: authRequest.codeChallenge,
    computedChallenge,
  }).log('api.v1.integration.mcpserver.oauth.token')

  if (computedChallenge !== authRequest.codeChallenge) {
    return badRequest({
      error: 'invalid_grant',
      error_description: 'PKCE verification failed',
    })
  }

  // Delete after validation so malformed requests do not burn the code.
  // Concurrent exchanges still collapse to one success because only the first
  // delete can remove the stored request.

  const deleted = await deleteMcpIdpOAuthAuthorizationRequest(code)

  if (!deleted) {
    return badRequest({
      error: 'invalid_grant',
      error_description: 'Authorization code not found or expired',
    })
  }

  // Resolve contactId from the IdP email if available.
  //
  // @note a trusted contact is found-or-created in the integration owner's
  // workspace, keyed by a deterministic fingerprint of the IdP email. This
  // allows mcp.ts to associate the MCP session with a CBK contact record.

  let contactId = ''

  if (authRequest.idpEmail) {
    try {
      const fingerprint = createContactFingerprint(TRUSTED_NAMESPACE, [
        oAuthConnectionId,
        authRequest.idpEmail,
      ])

      const contact = await ensureTrustedContact(
        { id: workspaceUserId },
        { email: authRequest.idpEmail },
        fingerprint
      )

      contactId = contact.id
    } catch (err) {
      // @note non-fatal - we proceed without a contactId rather than failing
      // the token exchange (e.g. contact is untrusted / already exists as such)
      debug('token contact lookup failed', {
        idpEmail: authRequest.idpEmail,
        err: String(err),
      }).log('api.v1.integration.mcpserver.oauth.token')
    }
  }

  // Sign access token
  //
  // @note portalId = mcpserverIntegrationId so mcp.ts can verify with
  // verifyOAuthToken.

  debug('token issuing access token', {
    idpSub: authRequest.idpSub,
    scope: authRequest.scope,
    mcpserverIntegrationId,
    contactId: contactId || undefined,
  }).log('api.v1.integration.mcpserver.oauth.token')

  const accessToken = await signOAuthToken({
    sub: authRequest.idpSub,
    portalId: mcpserverIntegrationId,
    portalUserId: authRequest.idpSub,
    contactId: contactId,
    scope: authRequest.scope,
  })

  await storeTokenMetadata(accessToken, {
    portalId: mcpserverIntegrationId,
    userId: authRequest.idpSub,
    scope: authRequest.scope,
    createdAt: Date.now(),
  })

  // Generate refresh token

  const refreshToken = await generateRefreshToken({
    userId: authRequest.idpSub,
    portalId: mcpserverIntegrationId,
    portalUserId: authRequest.idpSub,
    contactId: contactId,
    scope: authRequest.scope,
    clientId: clientId,
  })

  return ok(
    {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ONE_HOUR_IN_SECONDS,
      refresh_token: refreshToken,
      refresh_token_expires_in: REFRESH_TOKEN_TTL_SECONDS,
      scope: authRequest.scope,
    },
    TOKEN_CACHE_HEADERS
  )
}

/**
 * Handles the refresh_token grant type.
 *
 * Validates the refresh token, rotates it, and issues a new access token.
 */
async function handleRefreshTokenGrant(
  params: URLSearchParams,
  mcpserverIntegrationId: string
): Promise<Response> {
  const refreshToken = params.get('refresh_token')
  const clientId = params.get('client_id')

  if (!refreshToken) {
    return badRequest({
      error: 'invalid_request',
      error_description: 'Missing refresh_token parameter',
    })
  }

  if (!clientId) {
    return badRequest({
      error: 'invalid_request',
      error_description: 'Missing client_id parameter',
    })
  }

  const tokenData = await validateRefreshToken(refreshToken, clientId)

  if (!tokenData) {
    return badRequest({
      error: 'invalid_grant',
      error_description: 'Refresh token is invalid or expired',
    })
  }

  // Verify the refresh token belongs to this integration

  if (tokenData.portalId !== mcpserverIntegrationId) {
    return badRequest({
      error: 'invalid_grant',
      error_description: 'Refresh token was not issued for this integration',
    })
  }

  const accessToken = await signOAuthToken({
    sub: tokenData.userId,
    portalId: tokenData.portalId,
    portalUserId: tokenData.portalUserId,
    contactId: tokenData.contactId,
    scope: tokenData.scope,
  })

  await storeTokenMetadata(accessToken, {
    portalId: tokenData.portalId,
    userId: tokenData.userId,
    scope: tokenData.scope,
    createdAt: Date.now(),
  })

  const rotatedToken = await rotateRefreshToken(refreshToken)

  if (!rotatedToken) {
    return internalServerError({
      error: 'server_error',
      error_description: 'Failed to rotate refresh token',
    })
  }

  return ok(
    {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ONE_HOUR_IN_SECONDS,
      refresh_token: rotatedToken.refreshToken,
      refresh_token_expires_in: REFRESH_TOKEN_TTL_SECONDS,
      scope: tokenData.scope,
    },
    TOKEN_CACHE_HEADERS
  )
}

export const config = {
  api: {
    bodyParser: false,
  },
}
