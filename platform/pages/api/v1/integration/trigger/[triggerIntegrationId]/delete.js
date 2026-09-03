// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/trigger/{triggerIntegrationId}/delete:
 *   post:
 *     operationId: deleteTriggerIntegration
 *     summary: Delete Trigger integration
 *     tags:
 *       - Trigger Integration
 *     parameters:
 *       - in: path
 *         name: triggerIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Trigger integration
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
 *         description: The Trigger integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Trigger integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const triggerIntegration =
      await prisma.triggerIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'triggerIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!triggerIntegration) {
      return notFound()
    }

    if (triggerIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.triggerIntegration.delete({
      where: {
        id: triggerIntegration.id,
      },
    })

    return ok({ id: triggerIntegration.id })
  })
)

/**
 * @manual Trigger Integration
 *
 * ## Deleting a Trigger Integration
 *
 * Deleting a trigger integration permanently removes the trigger and its
 * configuration, including the associated endpoint URL and authentication
 * credentials. This operation is irreversible and will prevent any further
 * events from being processed through this trigger.
 *
 * To delete a trigger integration, send a POST request:
 *
 * ```http
 * POST /api/v1/integration/trigger/{triggerIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Replace `{triggerIntegrationId}` with the unique identifier of the trigger
 * you want to delete.
 *
 * **Important Considerations:**
 *
 * Before deleting a trigger integration, ensure that:
 *
 * - No external systems are actively sending events to this trigger
 * - You have documented or backed up any important configuration details
 * - Associated conversation history is preserved if needed (conversations remain in the system)
 * - You understand that the trigger's secret key will be invalidated
 *
 * **What Gets Deleted:**
 *
 * - The trigger integration configuration
 * - The unique trigger endpoint URL
 * - The authentication secret
 * - Associated scheduled execution (if configured)
 *
 * **What Remains:**
 *
 * - Historical conversation data from trigger events
 * - The associated bot (unaffected by trigger deletion)
 * - Any blueprint associations (not deleted)
 *
 * **Response:**
 *
 * ```json
 * {
 *   "id": "trigger_abc123"
 * }
 * ```
 *
 * After deletion, any attempts to send events to the trigger's endpoint URL
 * will fail with an error. Update your external systems to stop sending events
 * before or immediately after deletion to avoid failed requests.
 */
