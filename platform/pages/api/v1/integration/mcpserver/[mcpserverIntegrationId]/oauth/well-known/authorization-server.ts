import prisma from '@/prisma/client'

import { getExternalAPIHostURL, getExternalFrontendHost } from '@/lib/host'
import { ALLOWED_SCOPES } from '@/lib/mcp.oauth.constants'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notFound, ok } from '@/lib/response'

/**
 * OAuth 2.0 Authorization Server Metadata endpoint for MCP server integrations.
 * Implements RFC 8414 - OAuth 2.0 Authorization Server Metadata.
 *
 * This endpoint is reachable via the well-known rewrite:
 * `/.well-known/oauth-authorization-server/{v1|api/v1}/integration/mcpserver/{id}/mcp`
 *
 * It is a public endpoint - no authentication is required. The response
 * describes the OAuth AS endpoints scoped to this specific MCP server
 * integration.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8414
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
 */
export default withGet(async function (req) {
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

  const frontendHost = getExternalFrontendHost()

  const mcpResourceUrl = getExternalAPIHostURL(
    `/v1/integration/mcpserver/${mcpserverIntegrationId}/mcp`,
    frontendHost
  )

  const oauthBase = getExternalAPIHostURL(
    `/v1/integration/mcpserver/${mcpserverIntegrationId}/oauth`,
    frontendHost
  )

  // @note intentionally minimal metadata following OAuth 2.1 best practices;
  // only authorization_code + PKCE is supported (no implicit flow, no client
  // secrets)

  return ok({
    issuer: mcpResourceUrl,
    authorization_endpoint: `${oauthBase}/authorize`,
    token_endpoint: `${oauthBase}/token`,
    revocation_endpoint: `${oauthBase}/revoke`,
    registration_endpoint: `${oauthBase}/register`,

    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],

    scopes_supported: [...ALLOWED_SCOPES],

    service_documentation: 'https://docs.cbk.ai/mcp-server-integration',
  })
})
