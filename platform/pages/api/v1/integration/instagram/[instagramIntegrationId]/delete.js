// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/instagram/{instagramIntegrationId}/delete:
 *   post:
 *     operationId: deleteInstagramIntegration
 *     summary: Delete Instagram integration
 *     tags:
 *       - Instagram Integration
 *     parameters:
 *       - in: path
 *         name: instagramIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Instagram integration
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
 *         description: The Instagram integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Instagram integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const instagramIntegration =
      await prisma.instagramIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'instagramIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!instagramIntegration) {
      return notFound()
    }

    if (instagramIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.instagramIntegration.delete({
      where: {
        id: instagramIntegration.id,
      },
    })

    return ok({ id: instagramIntegration.id })
  })
)

/**
 * @manual Instagram Integration
 *
 * ## Deleting an Integration
 *
 * Permanently remove an Instagram integration from your account, disconnecting
 * the associated Instagram account from your chatbot system. This operation
 * is irreversible and should be performed with caution.
 *
 * Deletion removes all integration configuration from the ChatBotKit platform
 * but does not automatically remove webhook configurations from the Meta
 * Developer Portal. To fully disconnect, you should also remove or disable
 * the webhook configuration on Meta's platform:
 *
 * ```http
 * POST /api/v1/integration/instagram/{instagramIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * ### What Gets Deleted
 *
 * **Integration Configuration**: All stored settings including verify token
 * and feature flags are permanently removed from the system.
 *
 * **Resource Associations**: Links to bots and blueprints are severed, but
 * the associated resources themselves remain intact and can be used with
 * other integrations.
 *
 * **Event Logs**: Historical event logs related to this integration are
 * preserved for auditing and debugging purposes, but no new events will
 * be logged.
 *
 * ### What Does NOT Get Deleted
 *
 * **Conversation History**: Past conversations that occurred through this
 * integration are preserved. They remain accessible and can be reviewed
 * for analysis or compliance purposes.
 *
 * **Contact Records**: Collected contact information from users who interacted
 * through this integration remains in the contact database.
 *
 * **File Attachments**: Media files and attachments sent during conversations
 * are retained in the file storage system.
 *
 * **Meta Configuration**: Webhook settings, Instagram app configuration,
 * and access tokens in the Meta Developer Portal remain active. You must
 * manually remove these if you want to fully disconnect.
 *
 * ### Important Warnings
 *
 * **Immediate Effect**: Deletion takes effect immediately. Any incoming
 * Instagram messages will no longer be processed, and users will receive
 * no response from your chatbot.
 *
 * **No Undo**: This operation cannot be undone. If you delete an integration
 * by mistake, you must create a new integration and reconfigure all settings,
 * including updating webhook configurations in the Meta Developer Portal.
 *
 * **Active Conversations**: Users with active conversations will experience
 * interruption. The chatbot will stop responding mid-conversation without
 * any notification to the user.
 *
 * **Webhook Cleanup**: After deletion, Meta may continue attempting to
 * deliver webhook events to your callback URL. You should disable or remove
 * the webhook configuration in the Meta Developer Portal to prevent
 * unnecessary webhook traffic.
 *
 * ### When to Delete
 *
 * **Service Discontinuation**: When permanently discontinuing Instagram
 * support for a particular bot or service.
 *
 * **Account Migration**: Before creating a new integration for a different
 * Instagram account (though updating the existing integration is usually
 * preferable).
 *
 * **Security Incident**: If credentials have been compromised and you need
 * to completely disconnect before creating a new secure integration.
 *
 * **Resource Cleanup**: Removing test or development integrations that are
 * no longer needed.
 *
 * ### Recommended Deletion Workflow
 *
 * 1. **Notify Users**: If possible, inform users through Instagram that the
 * service will be discontinued
 *
 * 2. **Export Data**: Export conversation logs and analytics data if needed
 * for archival purposes
 *
 * 3. **Remove Meta Webhooks**: Disable or delete webhook configuration in
 * the Meta Developer Portal
 *
 * 4. **Delete Integration**: Execute the delete operation through the API
 *
 * 5. **Verify Cleanup**: Confirm no webhook traffic is being received and
 * no errors are being logged
 */
