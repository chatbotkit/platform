// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/support/{supportIntegrationId}/delete:
 *   post:
 *     operationId: deleteSupportIntegration
 *     summary: Delete Support integration
 *     tags:
 *       - Support Integration
 *     parameters:
 *       - in: path
 *         name: supportIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Support integration
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
 *         description: The Support integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Support integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const supportIntegration =
      await prisma.supportIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'supportIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!supportIntegration) {
      return notFound()
    }

    if (supportIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.supportIntegration.delete({
      where: {
        id: supportIntegration.id,
      },
    })

    return ok({ id: supportIntegration.id })
  })
)

/**
 * @manual Support Integration
 * @index 50
 *
 * ## Deleting a Support Integration
 *
 * When a support integration is no longer needed, you can permanently remove
 * it from your account using the delete endpoint. This operation immediately
 * stops all conversation forwarding to the configured support email address
 * and removes the integration configuration from the system.
 *
 * ```http
 * POST /api/v1/integration/support/{supportIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The delete operation is permanent and cannot be undone. Once deleted, the
 * integration will no longer forward any new conversations to your support
 * system. However, this operation only removes the integration configuration
 * itself - it does not affect the associated bot, any existing conversations,
 * or emails that have already been sent to your support system.
 *
 * ### When to Delete Integrations
 *
 * Consider deleting a support integration when you're decommissioning a
 * chatbot, migrating to a different support platform, or consolidating
 * multiple integrations. Before deletion, ensure you've documented any
 * important configuration details you may need to reference later, as the
 * integration settings cannot be recovered once deleted.
 *
 * ### Impact on Active Conversations
 *
 * Deleting a support integration does not affect conversations that are
 * currently in progress. Any conversations that were already initiated will
 * continue to function normally, but their summaries will not be forwarded
 * to your support system when they complete. If you need to maintain support
 * routing for active conversations, consider disabling the integration
 * temporarily instead by modifying its trigger settings rather than deleting it.
 *
 * ### Alternative to Deletion
 *
 * If you want to temporarily stop conversation forwarding without permanently
 * removing the integration, update the integration's configuration to modify
 * the trigger settings or change the associated bot. This preserves your
 * integration configuration for future use while preventing unwanted email
 * notifications to your support team.
 */
