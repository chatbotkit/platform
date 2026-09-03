import prisma from '@/prisma/client'

import { getExternalAPIHostURL, getExternalFrontendHost } from '@/lib/host'
import { ALLOWED_SCOPES } from '@/lib/mcp.oauth.constants'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notFound, ok } from '@/lib/response'

/**
 * OAuth 2.0 Protected Resource Metadata endpoint for MCP server integrations.
 * Implements RFC 9728 - OAuth 2.0 Protected Resource Metadata.
 *
 * This endpoint is reachable via the well-known rewrite:
 * `/.well-known/oauth-protected-resource/{v1|api/v1}/integration/mcpserver/{id}/mcp`
 *
 * It is a public endpoint - no authentication is required. The response
 * describes the resource identifier and the authorization servers that
 * protect it. MCP clients use this to discover where to obtain tokens.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9728
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

  return ok({
    resource: mcpResourceUrl,

    // @note the issuer of the AS is the same as the resource URL; clients use
    // this to derive the well-known AS metadata URL per RFC 8414
    authorization_servers: [mcpResourceUrl],

    bearer_methods_supported: ['header'],
    scopes_supported: [...ALLOWED_SCOPES],
  })
})
