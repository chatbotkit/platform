// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withChildUserSession } from '@/lib/user.handler'

/**
 * @swagger
 *
 * /user/{userId}/token/{tokenId}/delete:
 *   post:
 *     operationId: deleteUserToken
 *     summary: Delete a user token
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
 *         name: tokenId
 *         required: true
 *         schema:
 *           description: The ID of the user token to delete
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
 *         description: The user token was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted user token
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withChildUserSession(async function (req, session) {
    const token = await prisma.token.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'tokenId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!token) {
      return notFound()
    }

    if (token.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.token.delete({
      where: {
        id: token.id,
      },
    })

    return ok({ id: token.id })
  })
)

/**
 * @manual User Tokens
 *
 * ## Deleting User Tokens
 *
 * To revoke an API token belonging to a user, send a
 * POST request to the user token delete endpoint. This operation
 * permanently removes the token from the system, immediately invalidating it
 * and preventing any further API requests using that token. This is the
 * primary mechanism for revoking access when tokens are compromised, no longer
 * needed, or as part of regular token rotation practices.
 *
 * Token deletion is immediate and irreversible. Once a token is deleted, any
 * applications or integrations using that token will receive authentication
 * errors on their next API request. Ensure you have updated all systems that
 * depend on the token before deletion, or have a process in place to quickly
 * provide replacement tokens.
 *
 * ```http
 * POST /api/v1/user/{userId}/token/{tokenId}/delete
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {}
 * ```
 *
 * **Security Best Practice:** Delete tokens immediately when they are no
 * longer needed, when you suspect they may have been compromised, or as part
 * of regular security hygiene. Implement automated token rotation by creating
 * new tokens and deleting old ones on a scheduled basis (e.g., every 90 days).
 *
 * **Emergency Revocation:** If you suspect a token has been leaked or
 * compromised, delete it immediately through this endpoint. The revocation is
 * instantaneous, and the token will be rejected for all subsequent API
 * requests, effectively cutting off unauthorized access.
 *
 * **Operational Note:** When deleting tokens that are actively being used by
 * applications or integrations, coordinate the deletion with deployment of
 * updated credentials to minimize service disruption. Consider implementing
 * a brief overlap period where both old and new tokens are valid to enable
 * zero-downtime token rotation.
 *
 * **Important:** Only the parent User can delete tokens belonging
 * to its child Users. The child User cannot delete its own tokens
 * through the standard token deletion endpoint. They must use this user
 * token endpoint or request deletion through the parent User.
 */
