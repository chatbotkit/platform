// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { deleteSpace } from '@/lib/space.delete'

/**
 * @swagger
 *
 * /space/{spaceId}/delete:
 *   post:
 *     operationId: deleteSpace
 *     summary: Delete a space
 *     tags:
 *       - Space
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           description: The ID of the space to delete
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
 *         description: The space was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted space
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const space = await prisma.space.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'spaceId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!space) {
      return notFound()
    }

    if (space.userId !== session.user.id) {
      return notAuthorized()
    }

    await deleteSpace(space)

    return ok({ id: space.id })
  })
)

/**
 * @manual Spaces
 * @index 40
 *
 * ## Deleting a Space
 *
 * Permanently removing a space is a critical operation that should be performed
 * with caution, as it irreversibly removes the space and may affect associated
 * resources. The delete operation ensures proper cleanup of all space-related
 * data while maintaining referential integrity across the system.
 *
 * When you delete a space, the system performs a comprehensive cleanup process
 * that removes the space record and handles any cascade effects on related
 * resources. This cleanup ensures that no orphaned data remains in the system
 * and that all references to the deleted space are properly handled.
 *
 * To permanently delete a space:
 *
 * ```http
 * POST /api/v1/space/{spaceId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * For example, deleting a space with ID `space_abc123`:
 *
 * ```http
 * POST /api/v1/space/space_abc123/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The API returns the ID of the deleted space as confirmation:
 *
 * ```json
 * {
 *   "id": "space_abc123"
 * }
 * ```
 *
 * **Important Considerations:**
 *
 * - **Irreversible Operation:** Space deletion is permanent and cannot be
 *   undone. Ensure you have backed up any critical data before proceeding.
 *
 * - **Related Resources:** Consider the impact on conversations, contacts, or
 *   other resources that may be associated with the space. The deletion process
 *   handles these relationships according to configured cascade rules.
 *
 * **Best Practice:** Before deleting a space, consider archiving or exporting
 * its data if you need to maintain historical records for compliance or
 * reference purposes. Once deleted, the space and its configuration cannot
 * be recovered.
 */
