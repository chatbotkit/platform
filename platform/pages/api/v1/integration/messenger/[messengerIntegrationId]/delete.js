// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/messenger/{messengerIntegrationId}/delete:
 *   post:
 *     operationId: deleteMessengerIntegration
 *     summary: Delete Messenger integration
 *     tags:
 *       - Messenger Integration
 *     parameters:
 *       - in: path
 *         name: messengerIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Messenger integration
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
 *         description: The Messenger integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Messenger integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const messengerIntegration =
      await prisma.messengerIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'messengerIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!messengerIntegration) {
      return notFound()
    }

    if (messengerIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.messengerIntegration.delete({
      where: {
        id: messengerIntegration.id,
      },
    })

    return ok({ id: messengerIntegration.id })
  })
)

/**
 * @manual Messenger Integration
 *
 * ## Deleting Messenger Integrations
 *
 * Deleting a Messenger integration permanently removes the connection between
 * ChatBotKit and your Facebook Messenger page, stopping all message processing
 * and webhook event handling. This operation is irreversible and should be
 * performed carefully, as it immediately terminates all active conversations
 * and prevents the bot from responding to new messages.
 *
 * Before deleting an integration, consider the impact on active users who may
 * be in the middle of conversations. All session data and conversation context
 * is preserved in ChatBotKit's conversation history for analytics and review
 * purposes, but the bot will no longer respond to messages sent through the
 * Facebook Messenger channel. Users attempting to interact with your page
 * after deletion will receive no automated responses until you create a new
 * integration or enable manual responses through Facebook's Page Inbox.
 *
 * After deletion, you should also remove the webhook configuration from
 * Facebook's Developer Portal to prevent unnecessary webhook delivery attempts
 * and error logging. Navigate to your app's Messenger settings, locate the
 * webhooks section, and either remove the webhook subscription or update it
 * to point to a different endpoint if you're migrating to a new integration.
 *
 * ```http
 * POST /api/v1/integration/messenger/{messengerIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The deletion process is immediate and cannot be undone. If you need to
 * temporarily disable the integration without losing configuration, consider
 * removing the webhook subscription in Facebook's Developer Portal instead,
 * which stops message delivery while preserving your ChatBotKit integration
 * settings for future reactivation.
 *
 * **Data Retention:** Deleting the integration does not delete historical
 * conversation data, contact information collected through the integration,
 * or analytics data. These records remain accessible in ChatBotKit for
 * reporting and compliance purposes. If you need to delete user data, use
 * the conversation and contact deletion endpoints separately.
 *
 * **Best Practice:** Before deletion, export any important analytics data,
 * review active conversation logs, and notify users if the bot will no longer
 * be available. Consider maintaining a backup integration for testing or
 * development purposes to avoid disrupting production services.
 */
