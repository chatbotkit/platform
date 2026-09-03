// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/discord/{discordIntegrationId}/delete:
 *   post:
 *     operationId: deleteDiscordIntegration
 *     summary: Delete Discord integration
 *     tags:
 *       - Discord Integration
 *     parameters:
 *       - in: path
 *         name: discordIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Discord integration
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
 *         description: The Discord integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Discord integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const discordIntegration =
      await prisma.discordIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'discordIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!discordIntegration) {
      return notFound()
    }

    if (discordIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.discordIntegration.delete({
      where: {
        id: discordIntegration.id,
      },
    })

    return ok({ id: discordIntegration.id })
  })
)

/**
 * @manual Discord Integration
 * @index 50
 *
 * ## Deleting a Discord Integration
 *
 * Deleting a Discord integration permanently removes the connection between
 * ChatBotKit and your Discord bot, stopping all webhook processing and slash
 * command functionality. This operation is irreversible and immediately terminates
 * the integration, preventing any further interactions through the Discord bot.
 * Use this endpoint when decommissioning a bot, cleaning up test integrations,
 * or migrating to a new configuration.
 *
 * When an integration is deleted, all associated data including conversation
 * sessions, event logs, and configuration settings are removed from ChatBotKit.
 * However, the Discord application itself remains configured in the Discord
 * Developer Portal. You should manually remove the Interactions Endpoint URL
 * from your Discord application settings to complete the cleanup process.
 *
 * ```http
 * POST /api/v1/integration/discord/{discordIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The delete operation requires no request body parameters. Simply provide the
 * integration identifier in the URL path, and the system will verify ownership
 * before proceeding with deletion. The operation returns the deleted integration's
 * ID to confirm successful removal.
 *
 * ## Impact of Deletion
 *
 * Deleting an integration has immediate effects on your Discord bot's functionality.
 * The webhook endpoint stops processing interaction events from Discord, meaning
 * users who attempt to use the slash command will receive error messages or no
 * response. Active conversations are terminated, and any in-progress message
 * processing is abandoned. The slash command may remain visible in Discord for
 * a short period due to caching, but it will not function.
 *
 * Conversation history associated with the integration is preserved in the
 * conversation database but becomes orphaned, meaning it's no longer accessible
 * through the integration context. If you need to maintain conversation history,
 * export or backup relevant conversations before deleting the integration. Related
 * bot configurations and blueprints are not affected and can be reused with new
 * integrations.
 *
 * ## Post-Deletion Cleanup
 *
 * After deleting a ChatBotKit integration, you should clean up your Discord
 * application configuration to prevent confusion and webhook errors. Navigate to
 * the Discord Developer Portal and remove or clear the Interactions Endpoint URL
 * from your application's General Information section. This prevents Discord from
 * attempting to send webhook events to endpoints that no longer exist.
 *
 * If you plan to decommission the Discord application entirely, you can delete it
 * from the Developer Portal. However, if you intend to reuse the application with
 * a new ChatBotKit integration, you can leave it configured and simply create a
 * new integration with the same credentials.
 *
 * **Warning:** Deletion is permanent and cannot be undone. Ensure you have backed
 * up any necessary configuration details or conversation logs before proceeding.
 * If you're unsure about deletion, consider updating the integration to disable
 * it temporarily rather than removing it permanently.
 */
