// @ts-check
import prisma from '@/prisma/client'
import { SecretType } from '@/prisma/types'

import { withPost } from '@/lib/method'
import { revokeOAuthToken } from '@/lib/oauth.revoke'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { getSecretValueAndType } from '@/lib/secret.value'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /secret/{secretId}/delete:
 *   post:
 *     operationId: deleteSecret
 *     summary: Delete a secret
 *     tags:
 *       - Secret
 *     parameters:
 *       - in: path
 *         name: secretId
 *         required: true
 *         schema:
 *           description: The ID of the secret to delete
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
 *         description: The secret was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted secret
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const secret = await prisma.secret.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'secretId')
    )

    if (!secret) {
      return notFound()
    }

    if (secret.userId !== session.user.id) {
      return notAuthorized()
    }

    // Attempt to revoke OAuth tokens before deletion (best-effort)

    try {
      const valueAndType = await getSecretValueAndType(secret, {})

      if (valueAndType?.value && valueAndType.baseType === SecretType.oauth) {
        // @todo find a more elegant solution that does not require stripping the
        // Bearer prefix

        const value = valueAndType.value.replace(/^Bearer\s+/i, '')

        await revokeOAuthToken(secret, value)
      }
    } catch {
      // @note revocation may fail for personal secrets when no conversation
      // context is available; proceed with deletion regardless
    }

    await prisma.secret.delete({
      where: {
        id: secret.id,
      },
    })

    return ok({ id: secret.id })
  })
)

/**
 * @manual Secrets
 * @index 25
 *
 * ## Deleting Secrets
 *
 * Permanently remove a secret from your workspace. This operation is irreversible
 * and will delete the secret along with all stored credential data. Before deleting
 * a secret, ensure that it is not being referenced by any active agents, integrations,
 * or skillsets, as this could cause authentication failures.
 *
 * Deleting a secret is useful when credentials are no longer needed, when rotating
 * to a new authentication method, or when cleaning up old configurations. Only the
 * secret owner can delete a secret.
 *
 * To delete a secret:
 *
 * ```http
 * POST /api/v1/secret/{secretId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Replace `{secretId}` with the unique identifier or name of the secret you want to
 * delete. The request body should be an empty JSON object.
 *
 * **Important Warnings:**
 * - This operation is permanent and cannot be undone
 * - Deleting a secret will cause authentication failures for any agents or integrations
 *   that reference it
 * - Consider updating references to use a different secret before deletion
 * - For OAuth secrets, the stored tokens are deleted but the OAuth authorization
 *   may still be active on the external service
 *
 * **Best Practices:**
 * - Audit all usages of a secret before deletion using the platform's search features
 * - For sensitive credentials, consider revoking OAuth tokens before deleting the secret
 * - Document the reason for deletion in your change logs
 * - Test affected agents and integrations after secret deletion to ensure they handle
 *   the missing credentials gracefully
 */
