// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/extract/{extractIntegrationId}/delete:
 *   post:
 *     operationId: deleteExtractIntegration
 *     summary: Delete Extract integration
 *     tags:
 *       - Extract Integration
 *     parameters:
 *       - in: path
 *         name: extractIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Extract integration
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
 *         description: The Extract integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Extract integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const extractIntegration =
      await prisma.extractIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'extractIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!extractIntegration) {
      return notFound()
    }

    if (extractIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.extractIntegration.delete({
      where: {
        id: extractIntegration.id,
      },
    })

    return ok({ id: extractIntegration.id })
  })
)

/**
 * @manual Extract Integration
 *
 * ## Deleting an Extract Integration
 *
 * Permanently delete an extract integration when it's no longer needed. This
 * operation removes the integration configuration but does not affect data that
 * has already been extracted and stored in conversation metadata.
 *
 * ```http
 * POST /api/v1/integration/extract/{extractIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * ### What Gets Deleted
 *
 * When you delete an extract integration:
 *
 * - The integration configuration is permanently removed
 * - The extraction schema definition is deleted
 * - Webhook configuration is removed
 * - Associated metrics tracking is stopped
 *
 * ### What Remains
 *
 * Deleting the integration does not affect:
 *
 * - Previously extracted data in conversation metadata
 * - Historical metrics that were collected
 * - Conversations that were processed by the integration
 *
 * The extracted data remains accessible through the conversation metadata and can
 * still be queried and used by your applications even after the integration is deleted.
 *
 * **Warning:** This operation is irreversible. Once deleted, you will need to
 * recreate the integration with its schema configuration if you want to resume
 * data extraction for new conversations.
 */
