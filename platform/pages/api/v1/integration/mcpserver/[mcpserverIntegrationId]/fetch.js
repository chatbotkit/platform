// @ts-check
import prisma from '@/prisma/client'

import { USER_AUDIENCE } from '@/lib/audience.consts'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /integration/mcpserver/{mcpserverIntegrationId}/fetch:
 *   get:
 *     operationId: fetchMcpServerIntegration
 *     summary: Fetch a mcpserverIntegration
 *     tags:
 *       - McpServer Integration
 *     parameters:
 *       - in: path
 *         name: mcpserverIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the McpServer integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The McpServer integration was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     skillsetId:
 *                       description: The ID of the skillset
 *                       type: string
 *                     oAuthConnectionId:
 *                       description: The ID of the OAuth connection for IdP-based authentication
 *                       type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const isUserAudience = session.payload.aud === USER_AUDIENCE

    const mcpserverIntegration =
      await prisma.mcpserverIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'mcpserverIntegrationId'),
        {
          select: {
            // identifiers

            id: true,

            alias: true,

            // basic information

            name: true,
            description: true,

            // resource linking

            userId: true,

            blueprintId: true,

            skillsetId: true,

            oAuthConnectionId: true,

            // resource specific

            accessToken: isUserAudience, // only exposed to user audience sessions

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!mcpserverIntegration) {
      return notFound()
    }

    if (mcpserverIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (mcpserverIntegration).userId)

    return ok(makeJsonSafe(mcpserverIntegration))
  })
)

/**
 * @manual MCP Server Integration
 *
 * ## Fetching MCP Server Integration Details
 *
 * Retrieve comprehensive configuration details for an MCP Server integration,
 * including exposed skillsets, access tokens, and server endpoint information.
 * This operation provides all the information needed to understand how your
 * ChatBotKit abilities are being shared via the Model Context Protocol.
 *
 * Fetch an MCP Server integration by sending a GET request:
 *
 * ```http
 * GET /api/v1/integration/mcpserver/{mcpserverIntegrationId}/fetch
 * ```
 *
 * The API returns complete integration details:
 *
 * ```json
 * {
 *   "id": "mcpserver_abc123",
 *   "name": "AI Assistant Tools Server",
 *   "description": "MCP server exposing AI assistant abilities",
 *   "blueprintId": "blueprint_xyz789",
 *   "skillsetId": "skillset_001",
 *   "meta": {
 *     "environment": "production",
 *     "version": "1.0"
 *   },
 *   "createdAt": "2025-01-10T08:00:00Z",
 *   "updatedAt": "2025-01-15T10:30:00Z"
 * }
 * ```
 *
 * ### Understanding the Response
 *
 * **Integration Identity**: The response includes the integration ID, name, and
 * description you provided during creation, helping you identify and document
 * the purpose of this MCP server endpoint.
 *
 * **Skillset Configuration**: The `skillsetId` field shows which ChatBotKit
 * skillset is exposed through this MCP server. External MCP clients can invoke
 * abilities from this skillset using the Model Context Protocol.
 *
 * **Blueprint Association**: If the integration is part of a blueprint, the
 * `blueprintId` shows which blueprint it belongs to, helping you understand how
 * this integration fits into your broader resource organization.
 *
 * **Metadata and Timestamps**: Custom metadata fields and creation/update timestamps
 * provide additional context about the integration's configuration and history.
 *
 * ### Common Use Cases for Fetching
 *
 * **Configuration Verification**: Before making updates, fetch the current
 * configuration to understand what will change and plan modifications carefully.
 *
 * **Access Token Retrieval**: When setting up new external clients, fetch the
 * integration to retrieve the access token they'll need for authentication.
 *
 * **Audit and Documentation**: Retrieve integration details for documentation,
 * compliance requirements, or internal audit processes showing what abilities
 * are exposed externally.
 *
 * **Troubleshooting**: When debugging MCP client issues, fetch integration details
 * to verify that skillsets and access tokens are configured correctly.
 *
 * **Automated Management**: Programmatically retrieve integration configurations
 * for monitoring, backup, or synchronization with external management systems.
 *
 * ### Security Considerations
 *
 * The fetch operation returns the access token used by external clients to
 * authenticate with your MCP server. This token provides access to all skillsets
 * exposed through the integration:
 *
 * **Token Protection**: Store the retrieved access token securely and never
 * commit it to version control systems or share it publicly.
 *
 * **Access Control**: Only fetch integration details from systems and accounts
 * that have legitimate need to access the configuration information.
 *
 * **Token Rotation**: If the access token is compromised, create a new integration
 * with fresh credentials and delete the compromised one to ensure security.
 */
