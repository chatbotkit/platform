// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/slack/{slackIntegrationId}/delete:
 *   post:
 *     operationId: deleteSlackIntegration
 *     summary: Delete Slack integration
 *     tags:
 *       - Slack Integration
 *     parameters:
 *       - in: path
 *         name: slackIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Slack integration
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
 *         description: The Slack integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Slack integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const slackIntegration =
      await prisma.slackIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'slackIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!slackIntegration) {
      return notFound()
    }

    if (slackIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.slackIntegration.delete({
      where: {
        id: slackIntegration.id,
      },
    })

    return ok({ id: slackIntegration.id })
  })
)

/**
 * @manual Slack Integration
 *
 * ## Deleting a Slack Integration
 *
 * Permanently remove a Slack integration from your ChatBotKit account. This operation deletes the integration configuration but does not automatically uninstall the Slack app from your workspace or remove the bot from channels.
 *
 * Deletion is immediate and irreversible. Once deleted, the integration's webhook endpoints become inactive and will no longer process events from Slack. Any ongoing conversations will be terminated, and the bot will stop responding to messages.
 *
 * ```http
 * POST /api/v1/integration/slack/{slackIntegrationId}/delete
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {}
 * ```
 *
 * Replace `{slackIntegrationId}` with the unique identifier of the integration you want to delete.
 *
 * ### What Gets Deleted
 *
 * When you delete a Slack integration:
 *
 * **Removed:**
 * - Integration configuration and settings
 * - Webhook endpoint registrations
 * - Associated conversation sessions
 * - Stored authentication credentials
 * - Feature configuration (visible messages, attachments, references, ratings)
 *
 * **Preserved:**
 * - Historical conversation logs (if logging was enabled)
 * - Associated bot configuration (bot remains available for other integrations)
 * - Blueprint resources (if the integration was part of a blueprint)
 * - The Slack app installation in your workspace
 *
 * ### Post-Deletion Steps
 *
 * After deleting a ChatBotKit integration, you should also remove the bot from your Slack workspace to complete the cleanup:
 *
 * 1. **Uninstall the Slack App**:
 *    - Go to your Slack workspace settings
 *    - Navigate to "Manage Apps" or "App Management"
 *    - Find your ChatBotKit bot app
 *    - Click "Remove App" or "Uninstall"
 *
 * 2. **Remove Bot from Channels**:
 *    - If the bot is still in channels, use `/kick @botname` to remove it
 *    - This prevents confusion if users try to interact with the now-inactive bot
 *
 * 3. **Update Documentation**:
 *    - Notify team members that the bot is no longer available
 *    - Update any internal documentation referencing the bot
 *
 * ### Response
 *
 * ```json
 * {
 *   "id": "slack_xyz789"
 * }
 * ```
 *
 * The response confirms the integration ID that was deleted. After deletion, attempting to fetch or update this integration will return a 404 Not Found error.
 *
 * ### Important Considerations
 *
 * **Irreversible Operation**: There is no undo or recovery mechanism. Once deleted, you must create a new integration and reconfigure all settings if you want to restore the bot functionality.
 *
 * **Active Conversations**: Any conversations in progress when the integration is deleted will be immediately terminated. Users will receive no notification, and the bot will simply stop responding.
 *
 * **Webhook Failures**: After deletion, Slack will continue attempting to send events to the now-inactive webhook URLs. These requests will fail with 404 errors until you uninstall the Slack app or update its webhook URLs.
 *
 * **Orphaned Resources**: The associated bot and blueprint (if any) are not deleted and remain available. If you want to remove these resources completely, delete them separately using their respective delete endpoints.
 *
 * ### Best Practices
 *
 * **Before Deleting:**
 * 1. Verify this is the correct integration by checking its name and ID with the fetch endpoint
 * 2. Notify users who rely on the bot that it will be removed
 * 3. Consider exporting conversation logs if needed for future reference
 * 4. Document the bot's configuration if you might want to recreate it later
 *
 * **After Deleting:**
 * 1. Uninstall the corresponding Slack app from your workspace
 * 2. Remove the bot from all channels where it was active
 * 3. Update any automation or scripts that reference the integration
 * 4. Verify that webhook URLs are no longer receiving traffic
 *
 * **Alternative to Deletion**: If you want to temporarily disable the bot without deleting the configuration, consider updating it with invalid credentials or removing the bot from all channels. This preserves your configuration for future reactivation.
 *
 * For information about recreating a similar integration, see the creating integration section above.
 */
