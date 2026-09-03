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
 * /integration/twilio/{twilioIntegrationId}/fetch:
 *   get:
 *     operationId: fetchTwilioIntegration
 *     summary: Fetch a twilioIntegration
 *     tags:
 *       - Twilio Integration
 *     parameters:
 *       - in: path
 *         name: twilioIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Twilio integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Twilio integration was retrieved successfully
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
 *                     accountSid:
 *                       description: The Twilio account SID
 *                       type: string
 *                     # authToken:
 *                     #   description: The Twilio auth token
 *                     #   type: string
 *                     voice:
 *                       description: The voice configuration structured string
 *                       type: string
 *                     contactCollection:
 *                       description: Weather to collect contacts
 *                       type: boolean
 *                     sessionDuration:
 *                       description: The session duration (in milliseconds)
 *                       type: number
 *                     allowFrom:
 *                       description: Newline-or-comma-separated list of allowed senders
 *                       type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const twilioIntegration =
      await prisma.twilioIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'twilioIntegrationId'),
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

            botId: true,

            // resource specific

            accountSid: true,

            // authToken: true, // disabled for security reasons

            voice: true,

            contactCollection: true,

            sessionDuration: true,

            allowFrom: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!twilioIntegration) {
      return notFound()
    }

    if (twilioIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (twilioIntegration).userId)

    return ok(makeJsonSafe(twilioIntegration))
  })
)

/**
 * @manual Twilio Integration
 *
 * ## Fetching Twilio Integration Details
 *
 * Retrieve detailed configuration and settings for a specific Twilio integration,
 * including its associated bot, session management settings, and current webhook
 * configuration. Fetching integration details is essential for understanding your
 * current setup and preparing for configuration updates.
 *
 * Fetch a Twilio integration by sending a GET request with the integration ID:
 *
 * ```http
 * GET /api/v1/integration/twilio/{twilioIntegrationId}/fetch
 * ```
 *
 * The API returns complete integration details:
 *
 * ```json
 * {
 *   "id": "twilio_abc123",
 *   "name": "Customer Support SMS",
 *   "description": "SMS-based customer support accessible via text message",
 *   "botId": "bot_xyz789",
 *   "blueprintId": "blueprint_def456",
 *   "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
 *   "voice": "twilio/language=en-US/voice=Polly.Joanna",
 *   "contactCollection": true,
 *   "sessionDuration": 1800000,
 *   "allowFrom": "*",
 *   "meta": {
 *     "environment": "production",
 *     "region": "us-east"
 *   },
 *   "createdAt": "2025-01-15T10:30:00Z",
 *   "updatedAt": "2025-01-20T14:45:00Z"
 * }
 * ```
 *
 * ### Understanding the Response
 *
 * **Configuration Details**: The response includes all configurable settings such
 * as the bot handling conversations, session duration for conversation context,
 * and contact collection preferences.
 *
 * **Twilio Credentials**: The response includes `accountSid` so you can verify
 * which Twilio account is configured. The `authToken` is not returned for
 * security reasons; update it by sending a new value to the update endpoint.
 *
 * **Voice Configuration**: The response includes optional `voice` structured
 * string when the integration overrides Twilio's default speech settings for
 * call responses.
 *
 * **Sender Filtering**: The response includes `allowFrom`, a newline- or
 * comma-separated list of phone numbers allowed to send messages or place calls
 * to this integration. `*` allows everyone, while an empty value blocks all
 * inbound senders.
 *
 * **Resource Relationships**: View which bot and blueprint are associated with
 * this integration, helping you understand the integration's role in your broader
 * ChatBotKit setup.
 *
 * **Metadata and Organization**: Access custom metadata fields you've assigned
 * for categorization and management purposes.
 *
 * **Timestamps**: See when the integration was created and last modified, useful
 * for audit trails and understanding configuration history.
 *
 * ### Common Use Cases
 *
 * **Configuration Review**: Before making updates, fetch current settings to
 * understand what will change and plan modifications carefully.
 *
 * **Debugging and Troubleshooting**: When investigating SMS messaging issues,
 * fetch integration details to verify configuration matches expected settings.
 *
 * **Automation and Tooling**: Programmatically retrieve integration configurations
 * for monitoring, backup, or synchronization with external systems.
 *
 * **Audit and Compliance**: Document current integration settings for compliance
 * requirements or internal audit processes.
 */
