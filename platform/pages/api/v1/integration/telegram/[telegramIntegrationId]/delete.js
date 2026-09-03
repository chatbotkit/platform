// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/telegram/{telegramIntegrationId}/delete:
 *   post:
 *     operationId: deleteTelegramIntegration
 *     summary: Delete Telegram integration
 *     tags:
 *       - Telegram Integration
 *     parameters:
 *       - in: path
 *         name: telegramIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Telegram integration
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
 *         description: The Telegram integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Telegram integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const telegramIntegration =
      await prisma.telegramIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'telegramIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!telegramIntegration) {
      return notFound()
    }

    if (telegramIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.telegramIntegration.delete({
      where: {
        id: telegramIntegration.id,
      },
    })

    return ok({ id: telegramIntegration.id })
  })
)

/**
 * @manual Telegram Integration
 *
 * ## Deleting a Telegram Integration
 *
 * Permanently remove a Telegram integration from your ChatBotKit account. This
 * action disconnects your ChatBotKit bot from Telegram and stops all message
 * processing for the associated bot. Deletion is immediate and cannot be undone.
 *
 * To delete a Telegram integration, send a POST request:
 *
 * ```http
 * POST /api/v1/integration/telegram/{telegramIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The request body must be provided but can be empty. Replace `{telegramIntegrationId}`
 * with the ID of the integration you want to delete.
 *
 * ### What Happens When You Delete
 *
 * When you delete a Telegram integration:
 *
 * 1. **Webhook Deactivation**: The webhook connection with Telegram is immediately
 *    terminated, and your bot will stop receiving messages.
 *
 * 2. **Integration Removal**: The integration configuration is permanently removed
 *    from your ChatBotKit account.
 *
 * 3. **Bot Retention**: Your Telegram bot on Telegram's platform remains active.
 *    To fully deactivate it, you need to delete it through BotFather.
 *
 * 4. **ChatBotKit Bot Retention**: The connected ChatBotKit bot is not affected
 *    and remains available for use with other integrations.
 *
 * 5. **Conversation History**: Existing conversation data in ChatBotKit is
 *    preserved and can be accessed through the conversations API.
 *
 * ### Before Deleting
 *
 * Consider these steps before permanently deleting an integration:
 *
 * - **Export Data**: If you need conversation history or analytics, export them
 *   before deletion as you won't be able to access integration-specific data
 *   after removal.
 *
 * - **Update Telegram Bot**: If you're done with the bot entirely, delete it
 *   through BotFather on Telegram to prevent confusion for users who might
 *   still try to interact with it.
 *
 * - **Notify Users**: If your bot has active users, consider sending a final
 *   message informing them about the discontinuation of service.
 *
 * - **Alternative Solutions**: If you're experiencing issues, consider updating
 *   the configuration or temporarily disabling the integration instead of
 *   permanent deletion.
 *
 * **Warning:** Deletion is permanent and immediate. There is no way to recover
 * a deleted integration. You would need to create a new integration and
 * reconfigure the webhook to restore Telegram connectivity.
 */
