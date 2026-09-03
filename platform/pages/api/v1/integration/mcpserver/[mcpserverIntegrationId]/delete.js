// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/mcpserver/{mcpserverIntegrationId}/delete:
 *   post:
 *     operationId: deleteMcpServerIntegration
 *     summary: Delete McpServer integration
 *     tags:
 *       - McpServer Integration
 *     parameters:
 *       - in: path
 *         name: mcpserverIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the McpServer integration
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The McpServer integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted McpServer integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const mcpserverIntegration =
      await prisma.mcpserverIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'mcpserverIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!mcpserverIntegration) {
      return notFound()
    }

    if (mcpserverIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.mcpserverIntegration.delete({
      where: {
        id: mcpserverIntegration.id,
      },
    })

    return ok({ id: mcpserverIntegration.id })
  })
)

/**
 * @manual MCP Server Integration
 *
 * ## Deleting MCP Server Integrations
 *
 * Permanently remove an MCP Server integration when you no longer need to expose
 * your ChatBotKit skillsets via the Model Context Protocol. Deleting an integration
 * immediately stops external MCP clients from accessing the skillsets that were
 * shared through this server endpoint.
 *
 * Delete an MCP Server integration by sending a POST request:
 *
 * ```http
 * POST /api/v1/integration/mcpserver/{mcpserverIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The API confirms deletion by returning the integration ID:
 *
 * ```json
 * {
 *   "id": "mcpserver_abc123"
 * }
 * ```
 *
 * ### Immediate Effects of Deletion
 *
 * **Access Termination**: External MCP clients can no longer access the skillsets
 * exposed through this integration. Any applications or services using this MCP
 * server endpoint will immediately lose access.
 *
 * **Token Invalidation**: Access tokens associated with this integration are
 * invalidated immediately. Clients attempting to use these tokens will receive
 * authentication errors.
 *
 * **Resource Preservation**: The skillsets, abilities, and other ChatBotKit resources
 * that were exposed through this integration remain unchanged in your account.
 * Only the MCP server endpoint configuration is removed.
 *
 * **Blueprint Association**: If this integration was part of a blueprint, removing
 * it doesn't affect other resources in the blueprint. The blueprint continues to
 * function with its remaining resources.
 *
 * ### Before You Delete
 *
 * Consider these important factors before deleting an MCP Server integration:
 *
 * **Active Clients**: Identify any external applications or services currently
 * using this MCP server endpoint. Deletion will immediately break their access
 * to your skillsets.
 *
 * **Alternative Access**: Ensure clients have alternative ways to access the
 * functionality they need, or plan for service migration before deletion.
 *
 * **Documentation Updates**: Update any documentation or configuration guides
 * that reference this MCP server endpoint URL or access token.
 *
 * **Coordination**: If multiple teams or organizations use this integration,
 * coordinate the deletion to avoid unexpected service disruptions.
 *
 * ### Common Deletion Scenarios
 *
 * **Service Decommissioning**: When retiring a service or feature that relied
 * on MCP protocol access to ChatBotKit skillsets.
 *
 * **Security Rotation**: Removing old integrations as part of security credential
 * rotation or access control policy changes.
 *
 * **Migration**: Deleting test or staging integrations after migrating to production
 * configurations.
 *
 * **Cleanup**: Removing unused or experimental integrations to maintain an organized
 * account.
 *
 * ### Alternative to Deletion
 *
 * If you need to temporarily disable access without permanently deleting the
 * integration, consider these alternatives:
 *
 * **Token Rotation**: Generate new access tokens and distribute them only to
 * authorized clients, effectively revoking access for clients with old tokens.
 *
 * **Skillset Modification**: Remove skillsets from the integration or modify
 * their availability to control what external clients can access.
 *
 * These approaches preserve your integration configuration while controlling access,
 * making it easier to restore service if needed without recreating the entire
 * integration.
 */
