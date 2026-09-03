// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/microsoftteams/{microsoftteamsIntegrationId}/delete:
 *   post:
 *     operationId: deleteMicrosoftteamsIntegration
 *     summary: Delete a Microsoft Teams integration
 *     tags:
 *       - Microsoft Teams Integration
 *     parameters:
 *       - in: path
 *         name: microsoftteamsIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Microsoft Teams integration
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
 *         description: The Microsoft Teams integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Microsoft Teams integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const microsoftteamsIntegration =
      await prisma.microsoftteamsIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'microsoftteamsIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!microsoftteamsIntegration) {
      return notFound()
    }

    if (microsoftteamsIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.microsoftteamsIntegration.delete({
      where: {
        id: microsoftteamsIntegration.id,
      },
    })

    return ok({ id: microsoftteamsIntegration.id })
  })
)

/**
 * @manual Microsoft Teams Integration
 * @index 50
 *
 * ## Deleting a Microsoft Teams Integration
 *
 * Permanently removes a Microsoft Teams integration and all of its associated
 * configuration from your account. Once deleted, the integration's webhook
 * endpoint will no longer accept messages from Microsoft Teams, and the
 * connected ChatBotKit bot will stop receiving user interactions from Teams
 * channels, group chats, and direct messages.
 *
 * Deletion is an irreversible operation. Before deleting an integration,
 * consider whether you need to archive conversation history or export any
 * data associated with the integration. After deletion, you will need to
 * create a new integration and reconfigure your Azure Bot Service messaging
 * endpoint if you want to restore Teams connectivity.
 *
 * To delete a Microsoft Teams integration, send a POST request with the integration ID:
 *
 * ```http
 * POST /api/v1/integration/microsoftteams/{microsoftteamsIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The response confirms the deletion by returning the ID of the removed
 * integration:
 *
 * ```json
 * {
 *   "id": "microsoftteams-integration-abc123"
 * }
 * ```
 *
 * **What Happens During Deletion:**
 *
 * - The integration configuration is permanently removed from your account
 * - The integration's webhook endpoint stops accepting Bot Framework activities
 * - Any active conversation sessions associated with the integration will end
 * - The connected bot remains intact and can be reused with a new integration
 * - Previously logged conversations and event history are preserved
 *
 * **Before Deleting:**
 *
 * - Remove or update the messaging endpoint in your Azure Bot Service to avoid
 *   delivery failures to a non-existent endpoint
 * - Notify any Teams users who are actively using the bot
 * - Consider whether bot sessions should be terminated gracefully first
 *
 * **Important:** Only the owner of the integration can delete it. Attempts to
 * delete an integration belonging to another user will result in an
 * authorization error.
 */
