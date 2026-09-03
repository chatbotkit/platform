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
 * /integration/googlechat/{googlechatIntegrationId}/fetch:
 *   get:
 *     operationId: fetchGooglechatIntegration
 *     summary: Fetch a Google Chat integration
 *     tags:
 *       - Google Chat Integration
 *     parameters:
 *       - in: path
 *         name: googlechatIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Google Chat integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Google Chat integration was retrieved successfully
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
 *                     serviceAccountKey:
 *                       description: The service account key (returned as '********' if configured, null otherwise)
 *                       type: string
 *                     projectNumber:
 *                       description: The Google Cloud project number for JWT verification
 *                       type: string
 *                     contactCollection:
 *                       description: Whether to collect contacts
 *                       type: boolean
 *                     sessionDuration:
 *                       description: The session duration for the integration
 *                       type: number
 *                     attachments:
 *                       description: Whether file attachment processing is enabled
 *                       type: boolean
 *                     autoRespond:
 *                       description: The auto-respond configuration
 *                       type: string
 *                     allowFrom:
 *                       description: The allowed senders for this integration
 *                       type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const googlechatIntegration =
      await prisma.googlechatIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'googlechatIntegrationId'),
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

            serviceAccountKey: true,

            projectNumber: true,

            contactCollection: true,

            sessionDuration: true,

            attachments: true,

            autoRespond: true,

            allowFrom: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!googlechatIntegration) {
      return notFound()
    }

    if (googlechatIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    if (googlechatIntegration.serviceAccountKey) {
      /** @type {any} */ googlechatIntegration.serviceAccountKey = '********'
    }

    return ok(makeJsonSafe(googlechatIntegration))
  })
)

/**
 * @manual Google Chat Integration
 * @index 40
 *
 * ## Fetching a Google Chat Integration
 *
 * Retrieve the complete configuration details for a specific Google Chat
 * integration by its unique ID. Use this endpoint to inspect current settings,
 * verify feature enablement, or check resource associations before making
 * updates.
 *
 * ```http
 * GET /api/v1/integration/googlechat/{googlechatIntegrationId}/fetch
 * ```
 *
 * Replace `{googlechatIntegrationId}` with the ID returned when the integration
 * was created, or obtained from the list endpoint.
 *
 * ### Response Fields
 *
 * The response includes all configuration fields for the integration:
 *
 * - **id**: Unique identifier for the integration
 * - **name**: Human-readable label for the integration
 * - **description**: Optional description of the integration's purpose
 * - **blueprintId**: Associated blueprint ID (if linked)
 * - **botId**: The bot that handles incoming Google Chat messages
 * - **serviceAccountKey**: Returns `"********"` if configured, `null` if not set
 * - **projectNumber**: Google Cloud project number used for JWT token verification
 * - **contactCollection**: Whether contact records are collected for direct message conversations
 * - **sessionDuration**: Conversation session timeout in milliseconds (null for unlimited)
 * - **attachments**: Whether uploaded Google Chat files are processed as conversation attachments
 * - **autoRespond**: Auto-respond mode setting for the integration
 * - **allowFrom**: Restriction pattern for which sender types receive responses
 * - **meta**: Custom metadata key-value pairs attached to the integration
 * - **createdAt**: ISO timestamp of integration creation
 * - **updatedAt**: ISO timestamp of last modification
 *
 * ### Security Considerations
 *
 * The `serviceAccountKey` field is masked and returned as `"********"` when a
 * key has been configured. This prevents accidental exposure of sensitive Google
 * Cloud credentials in API responses. To check whether credentials are set,
 * verify that the field is non-null rather than inspecting the value.
 *
 * When updating the integration, send the sentinel value `"********"` to
 * preserve the existing key, or send a new JSON key string to replace it.
 *
 * ### Example Response
 *
 * ```json
 * {
 *   "id": "googlechat_abc123",
 *   "name": "Support Space Bot",
 *   "description": "Handles support requests in Google Chat spaces",
 *   "blueprintId": null,
 *   "botId": "bot_xyz789",
 *   "serviceAccountKey": "********",
 *   "projectNumber": "123456789012",
 *   "contactCollection": true,
 *   "sessionDuration": 1800000,
 *   "attachments": true,
 *   "autoRespond": null,
 *   "allowFrom": null,
 *   "meta": { "environment": "production" },
 *   "createdAt": "2025-01-15T10:30:00Z",
 *   "updatedAt": "2025-01-20T14:45:00Z"
 * }
 * ```
 *
 * If the integration does not exist or belongs to another account, the endpoint
 * returns a 404 Not Found or 403 Forbidden error respectively.
 */
