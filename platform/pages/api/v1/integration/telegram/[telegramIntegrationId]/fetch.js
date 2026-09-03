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
 * /integration/telegram/{telegramIntegrationId}/fetch:
 *   get:
 *     operationId: fetchTelegramIntegration
 *     summary: Fetch a telegramIntegration
 *     tags:
 *       - Telegram Integration
 *     parameters:
 *       - in: path
 *         name: telegramIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Telegram integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Telegram integration was retrieved successfully
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
 *                     # botToken:
 *                     #   description: The Telegram integration bot token
 *                     #   type: string
 *                     contactCollection:
 *                       description: Weather to collect contacts
 *                       type: boolean
 *                     sessionDuration:
 *                       description: The session duration (in milliseconds)
 *                       type: number
 *                     attachments:
 *                       description: Weather the bot supports attachments
 *                       type: boolean
 *                     allowFrom:
 *                       description: Newline-or-comma-separated list of allowed senders
 *                       type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const telegramIntegration =
      await prisma.telegramIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'telegramIntegrationId'),
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

            // resource specific: options

            // botToken: true, // disabled for security reasons

            contactCollection: true,

            sessionDuration: true,

            attachments: true,

            allowFrom: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!telegramIntegration) {
      return notFound()
    }

    if (telegramIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (telegramIntegration).userId)

    return ok(makeJsonSafe(telegramIntegration))
  })
)

/**
 * @manual Telegram Integration
 *
 * ## Fetching a Telegram Integration
 *
 * Retrieve the complete configuration details for a specific Telegram integration.
 * This is useful when you need to review settings, verify configuration, or
 * display integration details in your application's user interface.
 *
 * To fetch a specific Telegram integration, send a GET request with the integration ID:
 *
 * ```http
 * GET /api/v1/integration/telegram/{telegramIntegrationId}/fetch
 * ```
 *
 * Replace `{telegramIntegrationId}` with your actual integration ID obtained
 * during creation or from the list endpoint.
 *
 * ### Response Details
 *
 * The response includes comprehensive information about the integration:
 *
 * - **Basic Information**: ID, name, description, creation and update timestamps
 * - **Resource Links**: Connected bot ID and blueprint ID (if applicable)
 * - **Configuration**: Contact collection settings, session duration, attachments support
 * - **Metadata**: Custom metadata fields for application-specific data
 *
 * **Security Note:** The bot token is never included in fetch responses for
 * security reasons. The token is only required during creation and updates.
 *
 * ### Common Use Cases
 *
 * - **Configuration Review**: Verify integration settings before making updates
 * - **Status Monitoring**: Check when the integration was last modified
 * - **UI Display**: Show integration details in management dashboards
 * - **Troubleshooting**: Review configuration when investigating issues
 *
 * Example response structure:
 *
 * ```json
 * {
 *   "id": "telegram_xxxxx",
 *   "name": "Customer Support Bot",
 *   "description": "Handles customer inquiries",
 *   "botId": "bot_xxxxx",
 *   "contactCollection": true,
 *   "sessionDuration": 3600000,
 *   "attachments": false,
 *   "createdAt": "2025-01-10T12:00:00Z",
 *   "updatedAt": "2025-01-10T12:00:00Z"
 * }
 * ```
 *
 * The endpoint requires proper authentication and will only return integrations
 * that belong to your account. Attempting to fetch another user's integration
 * will result in a not found or unauthorized error.
 */
