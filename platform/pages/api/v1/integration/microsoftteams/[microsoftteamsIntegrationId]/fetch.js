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
 * /integration/microsoftteams/{microsoftteamsIntegrationId}/fetch:
 *   get:
 *     operationId: fetchMicrosoftteamsIntegration
 *     summary: Fetch a Microsoft Teams integration
 *     tags:
 *       - Microsoft Teams Integration
 *     parameters:
 *       - in: path
 *         name: microsoftteamsIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Microsoft Teams integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Microsoft Teams integration was retrieved successfully
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
 *                     botFrameworkAppId:
 *                       description: The Microsoft Bot Framework Application ID
 *                       type: string
 *                     contactCollection:
 *                       description: Weather to collect contacts
 *                       type: boolean
 *                     sessionDuration:
 *                       description: The chat session duration
 *                       type: number
 *                     allowFrom:
 *                       description: The allowed senders for this integration
 *                       type: string
 *                     # attachments:
 *                     #   description: Weather the bot supports attachments
 *                     #   type: boolean
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const microsoftteamsIntegration =
      await prisma.microsoftteamsIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'microsoftteamsIntegrationId'),
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

            botFrameworkAppId: true,
            // botFrameworkAppSecret: true, // disabled for security reasons
            // tenantId: true, // disabled for security reasons

            contactCollection: true,

            sessionDuration: true,

            allowFrom: true,

            // attachments: true, // disabled because not supported

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!microsoftteamsIntegration) {
      return notFound()
    }

    if (microsoftteamsIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (microsoftteamsIntegration).userId)

    return ok(makeJsonSafe(microsoftteamsIntegration))
  })
)

/**
 * @manual Microsoft Teams Integration
 * @index 40
 *
 * ## Fetching a Microsoft Teams Integration
 *
 * Retrieve the complete configuration details for a specific Microsoft Teams
 * integration by its unique ID. Use this endpoint to inspect current settings,
 * verify bot associations, or confirm configuration before making updates.
 *
 * ```http
 * GET /api/v1/integration/microsoftteams/{microsoftteamsIntegrationId}/fetch
 * ```
 *
 * Replace `{microsoftteamsIntegrationId}` with the ID returned when the integration was
 * created, or obtained from the list endpoint.
 *
 * ### Response Fields
 *
 * The response includes all configuration fields for the integration:
 *
 * - **id**: Unique identifier for the integration
 * - **name**: Human-readable label for the integration
 * - **description**: Optional description of the integration's purpose
 * - **blueprintId**: Associated blueprint ID (if linked)
 * - **botId**: The bot that handles incoming Teams messages
 * - **botFrameworkAppId**: The Microsoft Bot Framework Application ID registered
 *   in the Azure portal. This value is safe to expose and is used when
 *   configuring the bot channel registration.
 * - **contactCollection**: Whether visitor contact data is collected during conversations
 * - **sessionDuration**: Conversation session timeout in milliseconds (null for unlimited)
 * - **allowFrom**: Restriction pattern for which sender types receive responses
 * - **meta**: Custom metadata key-value pairs attached to the integration
 * - **createdAt**: ISO timestamp of integration creation
 * - **updatedAt**: ISO timestamp of last modification
 *
 * **Security Note:** The `botFrameworkAppSecret` and `tenantId` fields are
 * intentionally excluded from fetch responses to prevent credential exposure.
 * These are write-only fields - you can set them via create or update, but
 * they are never returned in API responses.
 *
 * ### Example Response
 *
 * ```json
 * {
 *   "id": "teams_abc123",
 *   "name": "Internal Helpdesk Bot",
 *   "description": "Handles IT support requests in Microsoft Teams",
 *   "blueprintId": null,
 *   "botId": "bot_xyz789",
 *   "botFrameworkAppId": "12345678-aaaa-bbbb-cccc-dddddddddddd",
 *   "contactCollection": false,
 *   "sessionDuration": null,
 *   "allowFrom": null,
 *   "meta": { "team": "it-support" },
 *   "createdAt": "2025-02-01T09:00:00Z",
 *   "updatedAt": "2025-02-10T11:30:00Z"
 * }
 * ```
 *
 * If the integration does not exist or belongs to another account, the endpoint
 * returns a 404 Not Found or 403 Forbidden error respectively.
 */
