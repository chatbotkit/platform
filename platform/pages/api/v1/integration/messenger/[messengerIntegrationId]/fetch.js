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
 * /integration/messenger/{messengerIntegrationId}/fetch:
 *   get:
 *     operationId: fetchMessengerIntegration
 *     summary: Fetch a messengerIntegration
 *     tags:
 *       - Messenger Integration
 *     parameters:
 *       - in: path
 *         name: messengerIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Messenger integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Messenger integration was retrieved successfully
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
 *                     verifyToken:
 *                       description: The Messenger integration verify token
 *                       type: string
 *                     accessToken:
 *                       description: The Messenger integration access token (returned as '********' if configured, null otherwise)
 *                       type: string
 *                       nullable: true
 *                     appSecret:
 *                       description: The Meta app secret (returned as '********' if configured, null otherwise)
 *                       type: string
 *                       nullable: true
 *                     contactCollection:
 *                       description: Whether to collect contacts
 *                       type: boolean
 *                     sessionDuration:
 *                       description: The session duration (in milliseconds)
 *                       type: number
 *                       nullable: true
 *                     attachments:
 *                       description: Whether the bot supports attachments
 *                       type: boolean
 *                   required:
 *                     - verifyToken
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const messengerIntegration =
      await prisma.messengerIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'messengerIntegrationId'),
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

            verifyToken: true,

            accessToken: true,

            appSecret: true,

            contactCollection: true,

            sessionDuration: true,

            attachments: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!messengerIntegration) {
      return notFound()
    }

    if (messengerIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (messengerIntegration).userId)

    if (messengerIntegration.accessToken) {
      /** @type {any} */ messengerIntegration.accessToken = '********'
    }

    if (messengerIntegration.appSecret) {
      /** @type {any} */ (messengerIntegration).appSecret = '********'
    }

    return ok(makeJsonSafe(messengerIntegration))
  })
)

/**
 * @manual Messenger Integration
 *
 * ## Fetching Messenger Integration Details
 *
 * Retrieving the full details of a specific Messenger integration provides
 * access to all configuration settings, connection parameters, and metadata
 * associated with that integration. This is essential for reviewing current
 * settings, troubleshooting connection issues, and gathering information
 * needed for webhook configuration in Facebook's Developer Portal.
 *
 * When you fetch an integration, you receive comprehensive information including
 * the integration's name, description, associated bot and blueprint IDs, the
 * webhook verify token required for Facebook webhook setup, session duration
 * settings, and feature flags such as attachment support and contact collection.
 * This detailed view enables you to verify your configuration matches your
 * requirements before deploying to production.
 *
 * The verify token included in the response is crucial for completing the webhook
 * setup process in Facebook's Developer Portal. You'll need to copy this exact
 * token and paste it into the webhook verification field to establish the secure
 * connection between Facebook Messenger and ChatBotKit. The token ensures that
 * only authorized webhooks can send events to your integration.
 *
 * ```http
 * GET /api/v1/integration/messenger/{messengerIntegrationId}/fetch
 * ```
 *
 * ### Security Considerations
 *
 * For security reasons, the `accessToken` field is returned as a sentinel value
 * instead of the actual credential:
 *
 * - Returns `"********"` if an access token is configured
 * - Returns `null` if no access token has been set
 *
 * This allows you to verify that credentials are configured without exposing
 * the actual token values. When updating an integration, you can send back
 * the sentinel value `"********"` and the existing token will be preserved
 * unchanged. Only send a new actual token value if you want to update it.
 *
 * **Use Case:** Fetch integration details when you need to verify the webhook
 * callback URL for Facebook, confirm which bot is connected to the integration,
 * review session timeout settings, or check whether attachment processing is
 * enabled. This endpoint is also useful for programmatically auditing your
 * integration configurations across multiple deployments.
 */
