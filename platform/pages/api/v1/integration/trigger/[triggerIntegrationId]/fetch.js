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
 * /integration/trigger/{triggerIntegrationId}/fetch:
 *   get:
 *     operationId: fetchTriggerIntegration
 *     summary: Fetch a triggerIntegration
 *     tags:
 *       - Trigger Integration
 *     parameters:
 *       - in: path
 *         name: triggerIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Trigger integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Trigger integration was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - $ref: '#/components/schemas/BotRef'
 *                 - type: object
 *                   properties:
 *                     secret:
 *                       description: The Trigger integration secret (returned in clear to the owner - it is the value the calling system must present)
 *                       type: string
 *                     authenticate:
 *                       description: When enabled the integration requires authentication
 *                       type: boolean
 *                     schedule:
 *                       description: The schedule for the trigger integration (interval, cron expression, ISO date, or null)
 *                       type: string
 *                       nullable: true
 *                     timezone:
 *                       description: The IANA timezone identifier used to evaluate the trigger schedule.
 *                       type: string
 *                       nullable: true
 *                     sessionDuration:
 *                       description: The session duration (in milliseconds)
 *                       type: number
 *                     lastTriggerAt:
 *                       description: The timestamp (ms) of the last trigger execution
 *                       type: number
 *                       nullable: true
 *                     nextTriggerAt:
 *                       description: The timestamp (ms) of the next scheduled trigger execution
 *                       type: number
 *                       nullable: true
 *                   required:
 *                     - secret
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const triggerIntegration =
      await prisma.triggerIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'triggerIntegrationId'),
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

            secret: true,

            authenticate: true,

            schedule: true,
            timezone: true,

            sessionDuration: true,

            lastTriggerAt: true,
            nextTriggerAt: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!triggerIntegration) {
      return notFound()
    }

    if (triggerIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (triggerIntegration).userId)

    return ok(makeJsonSafe(triggerIntegration))
  })
)

/**
 * @manual Trigger Integration
 *
 * ## Fetching a Trigger Integration
 *
 * Retrieving a specific trigger integration provides detailed configuration
 * information, including the secret key required for authentication, endpoint
 * URL, and all associated settings. This is essential when you need to reference
 * trigger credentials or verify configuration details.
 *
 * To fetch a trigger integration, send a GET request with the trigger ID:
 *
 * ```http
 * GET /api/v1/integration/trigger/{triggerIntegrationId}/fetch
 * ```
 *
 * Replace `{triggerIntegrationId}` with your trigger's unique identifier.
 *
 * The response includes the complete trigger configuration:
 *
 * ```json
 * {
 *   "id": "trigger_abc123",
 *   "name": "Order Processing Trigger",
 *   "description": "Handles order processing events",
 *   "botId": "bot_xyz789",
 *   "secret": "1a2b3c4d5e6f...",
 *   "authenticate": true,
 *   "schedule": null,
 *   "timezone": "America/New_York",
 *   "sessionDuration": 3600000,
 *   "blueprintId": null,
 *   "lastTriggerAt": 1705315800000,
 *   "nextTriggerAt": null,
 *   "meta": {},
 *   "createdAt": "2024-01-15T10:30:00Z",
 *   "updatedAt": "2024-01-15T10:30:00Z"
 * }
 * ```
 *
 * **Key Response Fields:**
 *
 * - **`secret`**: The authentication secret for this trigger (store securely)
 * - **`botId`**: The bot that processes events sent to this trigger
 * - **`authenticate`**: Indicates whether authentication is required
 * - **`schedule`**: Cron expression for scheduled execution (if configured)
 * - **`timezone`**: IANA timezone used when evaluating the trigger schedule, or `null`
 * - **`sessionDuration`**: Conversation session persistence time in milliseconds
 * - **`lastTriggerAt`**: Timestamp (in milliseconds) of the most recent execution,
 *   or `null` if the trigger has never run
 * - **`nextTriggerAt`**: Timestamp (in milliseconds) of the next scheduled
 *   execution when a `schedule` is configured, or `null` otherwise
 *
 * **Constructing the Event Endpoint:**
 *
 * Use the trigger ID to construct the event endpoint URL:
 *
 * ```
 * https://api.chatbotkit.com/v1/integration/trigger/{triggerIntegrationId}/event
 * ```
 *
 * This is the URL your applications will use to send events to the trigger.
 */
