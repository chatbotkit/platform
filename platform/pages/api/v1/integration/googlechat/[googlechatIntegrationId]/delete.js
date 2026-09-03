// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/googlechat/{googlechatIntegrationId}/delete:
 *   post:
 *     operationId: deleteGooglechatIntegration
 *     summary: Delete Google Chat integration
 *     tags:
 *       - Google Chat Integration
 *     parameters:
 *       - in: path
 *         name: googlechatIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Google Chat integration
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
 *         description: The Google Chat integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Google Chat integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const googlechatIntegration =
      await prisma.googlechatIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'googlechatIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!googlechatIntegration) {
      return notFound()
    }

    if (googlechatIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.googlechatIntegration.delete({
      where: {
        id: googlechatIntegration.id,
      },
    })

    return ok({ id: googlechatIntegration.id })
  })
)

/**
 * @manual Google Chat Integration
 * @index 50
 *
 * ## Deleting a Google Chat Integration
 *
 * Permanently remove a Google Chat integration from your ChatBotKit account.
 * This action is irreversible and immediately stops the bot from responding
 * to events from Google Chat spaces and direct messages. The associated bot
 * and any other linked resources are not affected - only the integration
 * record itself is removed.
 *
 * ```http
 * POST /api/v1/integration/googlechat/{googlechatIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Replace `{googlechatIntegrationId}` with the ID of the integration you want
 * to remove. You can retrieve the ID from the list endpoint or from the
 * response when the integration was originally created.
 *
 * ### What Happens After Deletion
 *
 * Once deleted, any incoming webhook events from Google Chat targeting this
 * integration will no longer be processed. If your Google Chat app is still
 * configured to send events to this endpoint, those requests will return an
 * error. You should update or remove the Google Chat app configuration in
 * Google Cloud Console to stop sending requests to the deleted integration.
 *
 * The response confirms deletion by returning the ID of the removed integration:
 *
 * ```json
 * { "id": "googlechat_abc123" }
 * ```
 *
 * If the integration does not exist or belongs to another account, the endpoint
 * returns a 404 Not Found or 403 Forbidden error respectively.
 */
