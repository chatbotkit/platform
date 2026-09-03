// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { deleteUser } from '@/lib/user.delete'

/**
 * @swagger
 *
 * /user/{userId}/delete:
 *   post:
 *     operationId: deleteUser
 *     summary: Delete a user
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           description: The ID of the user to delete
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
 *         description: The user was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted user
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const user = await prisma.user.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'userId'),
      {
        select: {
          parentId: true,

          id: true,
        },
      }
    )

    if (!user) {
      return notFound()
    }

    if (user.parentId !== session.user.id) {
      return notAuthorized()
    }

    await deleteUser(user.id)

    return ok({ id: user.id })
  })
)

/**
 * @manual Users
 *
 * ## Deleting Users
 *
 * To permanently remove a user and all associated
 * resources, send a POST request to the user delete endpoint. This
 * operation is irreversible and will completely delete the user's
 * account along with all their bots, datasets, conversations, integrations,
 * files, and other resources.
 *
 * Deleting a user should be done with extreme caution as it represents
 * a complete account termination. All data belonging to the user will
 * be permanently removed from the system, and there is no recovery mechanism.
 * This operation is typically used when a customer cancels their subscription
 * or when you need to clean up test or inactive accounts.
 *
 * ```http
 * POST /api/v1/user/{userId}/delete
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {}
 * ```
 *
 * Before deleting a user, consider whether you need to export or
 * archive any of their data. Once deletion is complete, all conversation
 * histories, trained models, uploaded files, and custom configurations are
 * permanently removed and cannot be recovered.
 *
 * **Critical Warning:** This operation cascades through all related resources.
 * When a user is deleted, the system automatically removes all their
 * bots, datasets, conversations, messages, integrations, API tokens, files,
 * and any other resources they own. Ensure you have explicit confirmation
 * from the customer before proceeding with account deletion.
 *
 * **Compliance:** If you're subject to data retention regulations (such as
 * GDPR, CCPA, or industry-specific requirements), ensure you have appropriate
 * data export and archival processes in place before deleting user
 * accounts. Some regulations require maintaining certain records even after
 * account closure.
 *
 * **Best Practice:** Implement a soft-delete or account suspension feature in
 * your application layer before permanently deleting users. This
 * provides a grace period where accounts can be restored if deletion was
 * requested in error or if customers change their minds.
 */
