import prisma from '@/prisma/client'

import {
  OAUTH_REGISTER_PER_IP,
  TOO_MANY_ATTEMPTS_MESSAGE,
  checkAuthRate,
  getClientAddress,
} from '@/lib/auth.rate'
import { getExternalAPIHostURL, getExternalFrontendHost } from '@/lib/host'
import { withPost } from '@/lib/method'
import type { DynamicClientRegistrationRequest } from '@/lib/oauth.jwt'
import { registerDynamicClient } from '@/lib/oauth.jwt'
import { requiredUrlParam } from '@/lib/query.get'
import {
  badRequest,
  created,
  notFound,
  tooManyRequests,
} from '@/lib/response'

/**
 * OAuth 2.0 Dynamic Client Registration endpoint for MCP server integrations.
 * Implements RFC 7591 - OAuth 2.0 Dynamic Client Registration Protocol.
 *
 * MCP clients (e.g., Claude) call this endpoint to register themselves before
 * initiating the authorization flow. No user authentication is required - the
 * endpoint is public but gated on the integration having OAuth configured.
 *
 * Clients are namespaced per MCP server integration, not per OAuthConnection,
 * so re-registering after changing the connection is expected.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7591
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
 */
export default withPost(async function (req) {
  const mcpserverIntegrationId = requiredUrlParam(req, 'mcpserverIntegrationId')

  const mcpserverIntegration = await prisma.mcpserverIntegration.findUnique({
    where: { id: mcpserverIntegrationId },
    select: { id: true, oAuthConnectionId: true },
  })

  if (!mcpserverIntegration?.oAuthConnectionId) {
    return notFound({
      error: 'invalid_request',
      error_description: 'OAuth not available for this MCP server integration',
    })
  }

  // @note registration is unauthenticated and every call persists a client,
  // so it is throttled per source address before any parsing happens

  const allowed = await checkAuthRate('oauth-register', [
    {
      identity: `${mcpserverIntegrationId}:${getClientAddress(req)}`,
      limit: OAUTH_REGISTER_PER_IP,
    },
  ])

  if (!allowed) {
    return tooManyRequests({
      error: 'slow_down',
      error_description: TOO_MANY_ATTEMPTS_MESSAGE,
    })
  }

  // Parse JSON body

  let body: DynamicClientRegistrationRequest

  try {
    body = (await req.json()) as DynamicClientRegistrationRequest
  } catch {
    return badRequest({
      error: 'invalid_request',
      error_description: 'Invalid JSON body',
    })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return badRequest({
      error: 'invalid_request',
      error_description: 'Invalid JSON body',
    })
  }

  // Validate grant_types if provided

  if (body.grant_types) {
    const allowedGrantTypes = ['authorization_code', 'refresh_token']
    const invalidGrants = body.grant_types.filter(
      (gt) => !allowedGrantTypes.includes(gt)
    )

    if (invalidGrants.length > 0) {
      return badRequest({
        error: 'invalid_client_metadata',
        error_description: `Unsupported grant_types: ${invalidGrants.join(', ')}. Only authorization_code and refresh_token are supported`,
      })
    }
  }

  // Validate response_types if provided

  if (body.response_types) {
    const allowedResponseTypes = ['code']
    const invalidTypes = body.response_types.filter(
      (rt) => !allowedResponseTypes.includes(rt)
    )

    if (invalidTypes.length > 0) {
      return badRequest({
        error: 'invalid_client_metadata',
        error_description: `Unsupported response_types: ${invalidTypes.join(', ')}. Only code is supported`,
      })
    }
  }

  // Validate token_endpoint_auth_method if provided

  if (
    body.token_endpoint_auth_method &&
    body.token_endpoint_auth_method !== 'none'
  ) {
    return badRequest({
      error: 'invalid_client_metadata',
      error_description:
        'Only token_endpoint_auth_method: none is supported (public clients with PKCE)',
    })
  }

  // @note the mcpserverIntegrationId is used as the namespace for client
  // registration, equivalent to portalId in the portal OAuth flow

  try {
    const response = await registerDynamicClient(mcpserverIntegrationId, body)

    const oauthBase = getExternalAPIHostURL(
      `/v1/integration/mcpserver/${mcpserverIntegrationId}/oauth`,
      getExternalFrontendHost()
    )

    return created({
      ...response,
      // @note RFC 7591 recommends including these in the response so clients
      // can verify their registration was accepted correctly
      token_endpoint_auth_method: 'none',
      grant_types: response.grant_types || ['authorization_code'],
      response_types: response.response_types || ['code'],
      // @note inform the client of the endpoints it should use
      authorization_endpoint: `${oauthBase}/authorize`,
      token_endpoint: `${oauthBase}/token`,
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid')) {
      return badRequest({
        error: 'invalid_redirect_uri',
        error_description: error.message,
      })
    }

    throw error
  }
})

export const config = {
  api: {
    bodyParser: false,
  },
}
