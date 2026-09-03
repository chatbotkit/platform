// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/email/{emailIntegrationId}/delete:
 *   post:
 *     operationId: deleteEmailIntegration
 *     summary: Delete Email integration
 *     tags:
 *       - Email Integration
 *     parameters:
 *       - in: path
 *         name: emailIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Email integration
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
 *         description: The Email integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Email integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const emailIntegration =
      await prisma.emailIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'emailIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!emailIntegration) {
      return notFound()
    }

    if (emailIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.emailIntegration.delete({
      where: {
        id: emailIntegration.id,
      },
    })

    return ok({ id: emailIntegration.id })
  })
)

/**
 * @manual Email Integration
 *
 * ## Deleting an Email Integration
 *
 * To permanently remove an Email Integration, use the delete endpoint. This
 * operation is irreversible and will immediately stop the integration from
 * processing new emails. The generated inbox address will become inactive and
 * any emails sent to it after deletion will no longer be processed.
 *
 * ```http
 * POST /api/v1/integration/email/{emailIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * ### What Gets Deleted
 *
 * When you delete an Email Integration, the following occurs:
 *
 * **Inbox Deactivation**: The unique email address generated for this integration
 * immediately stops accepting new messages. Any emails sent to this address after
 * deletion will bounce or be rejected.
 *
 * **Configuration Removal**: All integration settings, including contact collection
 * preferences, session duration configuration, and attachment handling settings,
 * are permanently removed from the system.
 *
 * **Resource Links**: The connections between this integration and its associated
 * bot and blueprint are severed. However, the bot and blueprint themselves remain
 * intact and can be used with other integrations or applications.
 *
 * ### What Persists After Deletion
 *
 * Important data is preserved even after integration deletion:
 *
 * **Conversation History**: All conversations that occurred through this
 * integration remain available in your conversation logs. You can still access,
 * search, and analyze these historical interactions even though the integration
 * itself is deleted.
 *
 * **Collected Contacts**: If contact collection was enabled, the contacts
 * gathered through this integration remain in your contact database. These
 * contacts are not deleted and can continue to be used for analytics or other
 * purposes.
 *
 * **Associated Resources**: The bot, blueprint, datasets, and any other resources
 * linked to this integration are not affected by the deletion. Only the integration
 * configuration itself is removed.
 *
 * ### Before You Delete
 *
 * Consider these factors before deleting an Email Integration:
 *
 * **Notification Updates**: If you've shared the inbox email address with users,
 * customers, or in documentation, update those references to prevent confusion
 * when emails to the old address start bouncing.
 *
 * **Active Conversations**: Any ongoing email conversations will be interrupted.
 * Users who reply to recent emails may not receive responses after the integration
 * is deleted.
 *
 * **Alternative Approaches**: If you need to temporarily disable the integration,
 * consider updating its configuration instead of deletion. You can modify the
 * linked bot to provide "out of office" style responses rather than completely
 * removing the integration.
 *
 * ### Recovery
 *
 * Deleted integrations cannot be recovered. You would need to create a new
 * Email Integration, which will receive a new, different inbox address. The
 * original inbox address cannot be reused once an integration is deleted.
 */
