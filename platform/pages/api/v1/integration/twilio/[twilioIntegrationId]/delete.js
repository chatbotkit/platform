// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/twilio/{twilioIntegrationId}/delete:
 *   post:
 *     operationId: deleteTwilioIntegration
 *     summary: Delete Twilio integration
 *     tags:
 *       - Twilio Integration
 *     parameters:
 *       - in: path
 *         name: twilioIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Twilio integration
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
 *         description: The Twilio integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Twilio integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const twilioIntegration =
      await prisma.twilioIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'twilioIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!twilioIntegration) {
      return notFound()
    }

    if (twilioIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.twilioIntegration.delete({
      where: {
        id: twilioIntegration.id,
      },
    })

    return ok({ id: twilioIntegration.id })
  })
)

/**
 * @manual Twilio Integration
 *
 * ## Deleting Twilio Integrations
 *
 * Permanently delete a Twilio integration when you no longer need SMS messaging
 * functionality for a specific phone number or when decommissioning a service.
 * Deleting an integration removes the configuration that routes SMS messages to
 * your ChatBotKit bot, immediately stopping message processing for that integration.
 *
 * Delete a Twilio integration by sending a POST request to the delete endpoint:
 *
 * ```http
 * POST /api/v1/integration/twilio/{twilioIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The API confirms the deletion by returning the ID of the removed integration:
 *
 * ```json
 * {
 *   "id": "twilio_abc123"
 * }
 * ```
 *
 * ### What Happens When You Delete
 *
 * **Immediate Effect**: The integration stops processing incoming SMS messages
 * immediately after deletion. Any messages sent to the associated Twilio phone
 * number will no longer be routed to your ChatBotKit bot.
 *
 * **Webhook Configuration**: Your Twilio phone number's webhook configuration
 * remains unchanged. You should update or remove the webhook URL in your Twilio
 * console to avoid errors when messages are sent to the number.
 *
 * **Conversation History**: Existing conversation history and contact records
 * created through this integration are preserved in your account. Deletion only
 * removes the integration configuration, not the conversation data it generated.
 *
 * **Bot and Resources**: The bot and other resources (datasets, skillsets) used
 * by this integration are not affected. Only the Twilio integration configuration
 * is removed.
 *
 * ### Before You Delete
 *
 * Consider these points before deleting a Twilio integration:
 *
 * **Active Users**: If users are currently engaging with your bot through SMS,
 * deleting the integration will immediately terminate their ability to receive
 * responses. Consider scheduling deletions during low-activity periods.
 *
 * **Twilio Configuration**: You'll need to update or remove webhook configuration
 * in your Twilio account separately. Deleting the ChatBotKit integration doesn't
 * automatically update your Twilio settings.
 *
 * **Alternative Approaches**: If you want to temporarily disable the integration,
 * consider removing the webhook configuration in Twilio instead of deleting the
 * integration entirely. This preserves your ChatBotKit configuration for potential
 * future reactivation.
 *
 * ### Common Use Cases for Deletion
 *
 * **Service Decommissioning**: When permanently shutting down an SMS-based service
 * or retiring a phone number.
 *
 * **Phone Number Changes**: When migrating to a new phone number and need to
 * remove the old integration before creating a new one.
 *
 * **Testing and Development**: Cleaning up test integrations created during
 * development and quality assurance processes.
 *
 * **Resource Management**: Removing unused integrations to maintain a clean,
 * organized account with only active services.
 */
