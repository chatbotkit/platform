// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import oAuthConnectionIdSchema from '@/schemas/oAuthConnectionId'
import skillsetIdSchema from '@/schemas/skillsetId'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  skillsetId: skillsetIdSchema('use'),

  oAuthConnectionId: oAuthConnectionIdSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/mcpserver/{mcpserverIntegrationId}/update:
 *   post:
 *     operationId: updateMcpServerIntegration
 *     summary: Update a McpServer integration
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
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BlueprintProps'
 *               - type: object
 *                 properties:
 *                   skillsetId:
 *                     description: The ID of the skillset
 *                     type: string
 *                   oAuthConnectionId:
 *                     description: The ID of the OAuth connection for IdP-based authentication
 *                     type: string
 *     responses:
 *       200:
 *         description: The McpServer integration was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the McpServer Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        alias,

        name,
        description,

        blueprintId: blueprint,

        skillsetId: skillset,

        oAuthConnectionId: oAuthConnection,

        meta,
      } = body

      const mcpserverIntegration =
        await prisma.mcpserverIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'mcpserverIntegrationId')
        )

      if (!mcpserverIntegration) {
        return notFound()
      }

      if (mcpserverIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.mcpserverIntegration.update({
        where: {
          id: mcpserverIntegration.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          skillsetId: skillset?.id || skillset,

          oAuthConnectionId: oAuthConnection?.id || oAuthConnection,

          // meta and others

          meta: getMeta(meta, mcpserverIntegration.meta),
        },
      })

      return ok({ id: mcpserverIntegration.id })
    })
  )
)

/**
 * @manual MCP Server Integration
 *
 * ## Updating MCP Server Integrations
 *
 * Modify an existing MCP Server integration to change which skillsets are exposed,
 * update organizational information, or associate the integration with different
 * blueprints. Updates take effect immediately and apply to all subsequent MCP
 * client requests using this server endpoint.
 *
 * Update an MCP Server integration by sending a POST request with new configuration:
 *
 * ```http
 * POST /api/v1/integration/mcpserver/{mcpserverIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated AI Tools Server",
 *   "description": "Updated MCP server with revised skillset",
 *   "skillsetId": "skillset_001",
 *   "blueprintId": "blueprint_new456"
 * }
 * ```
 *
 * The API confirms the update:
 *
 * ```json
 * {
 *   "id": "mcpserver_abc123"
 * }
 * ```
 *
 * ### Updatable Parameters
 *
 * **name and description**: Update the integration's identification and documentation.
 * These changes help you maintain clear records of what each MCP server endpoint
 * provides and are immediately visible in the ChatBotKit interface and API responses.
 *
 * **skillsetId**: Change which ChatBotKit skillset is exposed through this MCP
 * server. The new skillset takes effect immediately, replacing all previously
 * exposed abilities with those from the new skillset.
 *
 * **oAuthConnectionId**: Configure or change the OAuth connection used for IdP-based
 * user authentication. Set to a valid OAuth connection ID to enable user-specific
 * authentication, or omit to leave authentication unchanged. This links the MCP
 * server to an existing OAuth connection in your account, enabling end-users to
 * authenticate through your Identity Provider before accessing the server.
 *
 * **blueprintId**: Associate the integration with a different blueprint, or remove
 * the blueprint association by setting it to null. This affects how the integration
 * is organized within your account's resource management structure.
 *
 * **meta**: Add or modify custom metadata fields for categorization, filtering,
 * and management purposes according to your organizational needs.
 *
 * ### Skillset Management
 *
 * When updating `skillsetId`, you're replacing which abilities external MCP
 * clients can access through this server endpoint. The new skillset takes effect
 * immediately for all subsequent requests. Clients that previously relied on
 * abilities from the old skillset will need to rediscover available tools after
 * the change.
 *
 * ### OAuth Configuration Updates
 *
 * You can enable, change, or remove OAuth/IdP authentication at any time by
 * updating the `oAuthConnectionId` field. When you add or change the OAuth
 * connection, MCP clients that have already established connections will need
 * to re-authenticate on their next request:
 *
 * ```http
 * POST /api/v1/integration/mcpserver/{mcpserverIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "oAuthConnectionId": "oauthconnection_new789"
 * }
 * ```
 *
 * After updating the OAuth connection, existing JWT tokens issued under the
 * previous configuration become invalid. All clients must complete the OAuth
 * flow again to obtain new tokens. The static access token is unaffected by
 * this change.
 *
 * ### Update Behavior and Timing
 *
 * **Immediate Effect**: Configuration changes apply immediately to all subsequent
 * MCP client requests. Clients that query the server after the update will see
 * the new skillset configuration.
 *
 * **Active Connections**: MCP clients with active connections continue using
 * cached server information until they refresh. Encourage clients to refresh
 * their tool/ability cache after major updates.
 *
 * **Access Token Unchanged**: Updates don't affect the integration's static access
 * token. External clients continue using the same static credentials without
 * needing reconfiguration, unless the OAuth connection is also changed.
 *
 * **Backward Compatibility**: If you change the skillset to one that removes
 * abilities external clients were using, those clients will receive errors when
 * trying to invoke the removed abilities. Coordinate skillset changes with client
 * teams to avoid service disruptions.
 *
 * ### Common Update Scenarios
 *
 * **Capability Expansion**: Switch to a different skillset containing more
 * abilities to expand available functionality for external clients.
 *
 * **Access Control**: Change to a more restricted skillset or add OAuth
 * authentication to tighten access to your MCP server.
 *
 * **Feature Updates**: Update the skillset when you've improved or modified
 * the abilities it contains, ensuring clients access the latest functionality.
 *
 * **OAuth Setup**: Add an `oAuthConnectionId` to enable IdP-based user
 * authentication on an existing integration that previously used only static
 * token authentication.
 *
 * **Organizational Restructuring**: Change blueprint association when reorganizing
 * how resources are grouped and managed in your account.
 *
 * **Documentation Maintenance**: Update name and description to reflect current
 * usage, especially as the integration's purpose evolves over time.
 *
 * ### Best Practices
 *
 * **Communicate Changes**: When changing skillsets, notify teams using this MCP
 * server endpoint about what's changing and when.
 *
 * **Version Metadata**: Use metadata fields to track which version of skillsets
 * are currently exposed, aiding in troubleshooting and change management.
 *
 * **Test Before Production**: If making significant skillset changes, consider
 * creating a test integration first to verify the new configuration works as
 * expected before updating production endpoints.
 *
 * **Monitor After Updates**: Watch for errors or unexpected behavior from external
 * clients after updating skillset or OAuth configuration.
 *
 * **Document Changes**: Maintain records of what changed, when, and why for audit
 * trails and troubleshooting purposes.
 */
