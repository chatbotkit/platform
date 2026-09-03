// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /integration/slack/{slackIntegrationId}/fetch:
 *   get:
 *     operationId: fetchSlackIntegration
 *     summary: Fetch a slackIntegration
 *     tags:
 *       - Slack Integration
 *     parameters:
 *       - in: path
 *         name: slackIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Slack integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Slack integration was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BotRef'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     signingSecret:
 *                       description: The signing secret (returned as '********' if configured, null otherwise)
 *                       type: string
 *                     botToken:
 *                       description: The bot token (returned as '********' if configured, null otherwise)
 *                       type: string
 *                     userToken:
 *                       description: The user token (returned as '********' if configured, null otherwise)
 *                       type: string
 *                     contactCollection:
 *                       description: Weather to collect contacts
 *                       type: boolean
 *                     sessionDuration:
 *                       description: The session duration for the Slack integration
 *                       type: number
 *                     # attachments:
 *                     #   description: Weather the bot supports attachments
 *                     #   type: boolean
 *                     references:
 *                       description: Whether to enable references feature
 *                       type: boolean
 *                     ratings:
 *                       description: Whether to enable ratings buttons feature
 *                       type: boolean
 *                     visibleMessages:
 *                       description: The number of visible messages outside of the new thread
 *                       type: number
 *                     autoRespond:
 *                       description: Configure automatic response behavior. Use '@all' to respond to all messages, '@agent <instructions>' for agent-powered decisions, or custom instructions for lightweight LLM filtering. Null/empty defaults to current behavior (DMs, mentions, threads only).
 *                       type: string
 *                     allowFrom:
 *                       description: Restrict which Slack users or channels can interact with this integration. Accepts Slack user IDs (U…/W…), channel IDs (C…/G…/D…), @username, or #channel-name, one per line. Use * to allow all senders. Leave empty to deny all.
 *                       type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const slackIntegration =
      await prisma.slackIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'slackIntegrationId'),
        {
          select: {
            // identifiers

            id: true,

            // ref

            alias: true,

            // basic information

            name: true,
            description: true,

            // resource linking

            userId: true,

            blueprintId: true,

            botId: true,

            // resource specific: options

            signingSecret: true,

            botToken: true,

            userToken: true,

            contactCollection: true,

            sessionDuration: true,

            // attachments: true, // disabled because not supported

            references: true,

            ratings: true,

            visibleMessages: true,

            autoRespond: true,

            allowFrom: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!slackIntegration) {
      return notFound()
    }

    if (slackIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (slackIntegration).userId)

    if (slackIntegration.signingSecret) {
      /** @type {any} */ slackIntegration.signingSecret = '********'
    }

    if (slackIntegration.botToken) {
      /** @type {any} */ slackIntegration.botToken = '********'
    }

    if (slackIntegration.userToken) {
      /** @type {any} */ slackIntegration.userToken = '********'
    }

    return ok(makeJsonSafe(slackIntegration))
  })
)

/**
 * @manual Slack Integration
 *
 * ## Fetching Integration Details
 *
 * Retrieve detailed configuration and status information for a specific Slack integration. This endpoint provides complete visibility into an integration's settings, feature enablement, and associated resources.
 *
 * The fetch operation is useful for reviewing current configuration, debugging integration issues, or synchronizing integration settings with external systems. Like the list endpoint, sensitive authentication credentials are never returned for security reasons.
 *
 * ```http
 * GET /api/v1/integration/slack/{slackIntegrationId}/fetch
 * Authorization: Bearer YOUR_API_TOKEN
 * ```
 *
 * Replace `{slackIntegrationId}` with the unique identifier of your Slack integration.
 *
 * ### Response Fields
 *
 * The response includes all configuration details for the integration:
 *
 * **Identification:**
 * - **id**: Unique identifier for the integration
 * - **name**: Human-readable name
 * - **description**: Descriptive text about the integration's purpose
 *
 * **Resource Associations:**
 * - **blueprintId**: ID of associated blueprint (if configured)
 * - **botId**: ID of the bot powering this integration
 *
 * **Feature Configuration:**
 * - **visibleMessages**: Number of recent messages included as context (0-10)
 * - **attachments**: Whether file upload support is enabled
 * - **references**: Whether citation reference buttons are displayed
 * - **ratings**: Whether user feedback ratings are enabled
 * - **contactCollection**: Whether contact information is collected
 * - **sessionDuration**: Maximum session duration in milliseconds (null for unlimited)
 * - **allowFrom**: Newline-separated list of Slack user or channel patterns permitted to
 *   interact with this integration. An empty value denies all senders; use `*` to allow
 *   everyone.
 *
 * **Metadata:**
 * - **meta**: Custom metadata object for storing additional properties
 * - **createdAt**: ISO timestamp of integration creation
 * - **updatedAt**: ISO timestamp of last modification
 *
 * ### Security Considerations
 *
 * For security reasons, sensitive credential fields are returned as sentinel values instead of actual secrets:
 *
 * - `signingSecret`: Returns `"********"` if configured, `null` if not set
 * - `botToken`: Returns `"********"` if configured, `null` if not set
 * - `userToken`: Returns `"********"` if configured, `null` if not set
 *
 * This allows you to verify that credentials are configured without exposing the actual values. When updating an integration, you can send back the sentinel value `"********"` and the existing credential will be preserved unchanged. Only send a new actual token value if you want to update it.
 *
 * ### Example Response
 *
 * ```json
 * {
 *   "id": "slack_xyz789",
 *   "name": "Customer Support Bot",
 *   "description": "Handles customer inquiries in #support channel",
 *   "blueprintId": "blueprint_abc123",
 *   "botId": "bot_def456",
 *   "signingSecret": "********",
 *   "botToken": "********",
 *   "userToken": null,
 *   "visibleMessages": 10,
 *   "attachments": true,
 *   "references": true,
 *   "ratings": true,
 *   "contactCollection": false,
 *   "sessionDuration": 3600000,
 *   "meta": {
 *     "workspace": "acme-corp",
 *     "team": "support"
 *   },
 *   "createdAt": "2025-01-15T10:30:00Z",
 *   "updatedAt": "2025-01-20T14:45:00Z"
 * }
 * ```
 *
 * ### Common Use Cases
 *
 * **Configuration Review**: Verify current settings before making updates to ensure you understand the existing configuration.
 *
 * **Debugging**: Check feature enablement and resource associations when troubleshooting integration behavior.
 *
 * **Monitoring**: Periodically fetch integration details to track configuration changes and audit modifications.
 *
 * **Synchronization**: Use fetch to synchronize integration settings with external configuration management systems or dashboards.
 *
 * If the integration ID doesn't exist or you don't have permission to access it, the endpoint returns a 404 Not Found or 403 Forbidden response respectively.
 */
