// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withChildUserSession } from '@/lib/user.handler'

/**
 * @swagger
 *
 * /user/{userId}/context/{contextId}/delete:
 *   post:
 *     operationId: deleteUserContext
 *     summary: Delete a user context
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           description: The ID of the user
 *           type: string
 *       - in: path
 *         name: contextId
 *         required: true
 *         schema:
 *           description: The ID of the context to delete
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
 *         description: The context was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted context
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withChildUserSession(async function (req, session) {
    const context = await prisma.context.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'contextId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!context) {
      return notFound()
    }

    if (context.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.context.delete({
      where: {
        id: context.id,
      },
    })

    return ok({ id: context.id })
  })
)

/**
 * @manual User Contexts
 * @index 40
 *
 * ## Deleting a User Context
 *
 * Permanently remove a user context. This operation cannot be undone.
 * The associated platform resources (bot, dataset, etc.) are not affected - only
 * the context record itself is removed.
 *
 * Deleting a context is appropriate when a customer is being offboarded, when
 * a resource configuration is being replaced by a new context, or when a
 * context was created in error.
 *
 * ```http
 * POST /api/v1/user/{userId}/context/{contextId}/delete
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {}
 * ```
 *
 * The response confirms the deletion by returning the `id` of the removed
 * context. Any attempt to fetch, update, or delete the same context ID after
 * deletion will return a `404 Not Found` error.
 *
 * **Warning:** Deleting a context does not cascade to the linked resources.
 * If your application logic depends on a context to route requests to the
 * correct bot or dataset, ensure you update that logic before removing the
 * context to avoid broken integrations.
 */
