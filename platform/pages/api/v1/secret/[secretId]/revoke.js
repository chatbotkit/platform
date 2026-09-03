// @ts-check
import prisma from '@/prisma/client'
import { SecretKind, SecretType } from '@/prisma/types'

import { withPost } from '@/lib/method'
import { revokeOAuthToken } from '@/lib/oauth.revoke'
import { requiredUrlParam } from '@/lib/query.get'
import { conflict, notAuthorized, notFound, ok } from '@/lib/response'
import { DirectSecretManager } from '@/lib/secret.manager'
import { getSecretValueAndType } from '@/lib/secret.value'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /secret/{secretId}/revoke:
 *   post:
 *     operationId: revokeSecret
 *     summary: Revoke secret
 *     tags:
 *       - Secret
 *     parameters:
 *       - in: path
 *         name: secretId
 *         required: true
 *         schema:
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
 *         description: The secret was revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the revoked secret
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

    if (secret.kind !== SecretKind.shared) {
      return conflict()
    }

    // @todo move into a library

    const valueAndType = await getSecretValueAndType(secret, {})

    if (!valueAndType) {
      return notFound()
    }

    if (valueAndType.value && valueAndType.baseType === SecretType.oauth) {
      // @todo find a more elegant solution that does not require stripping the
      // Bearer prefix

      const value = valueAndType.value.replace(/^Bearer\s+/i, '')

      await revokeOAuthToken(secret, value)
    }

    const sm = new DirectSecretManager({})

    await sm.delValue(secret)

    return ok({ id: secret.id })
  })
)

/**
 * @manual Secrets
 * @index 40
 *
 * ## Revoking OAuth Secrets
 *
 * Revoke the stored credentials for an OAuth secret, effectively disconnecting the
 * integration with the external service. This endpoint is specifically designed for
 * OAuth-based secrets and performs two key operations: it revokes the OAuth token
 * with the external service and removes the stored credential from the platform.
 *
 * Revoking a secret is different from deleting it. When you revoke an OAuth secret,
 * the secret configuration remains intact, but the stored tokens are removed and
 * invalidated with the external service. This allows you to re-authenticate the
 * secret later without losing its configuration or references.
 *
 * To revoke an OAuth secret:
 *
 * ```http
 * POST /api/v1/secret/{secretId}/revoke
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Replace `{secretId}` with the unique identifier or name of the OAuth secret you
 * want to revoke. The request body should be an empty JSON object.
 *
 * **What Happens During Revocation:**
 * 1. The platform attempts to revoke the OAuth token with the external service
 * 2. The stored credential value is removed from the platform's secret store
 * 3. The secret configuration (name, description, type) is preserved
 * 4. Any agents or integrations using this secret will receive authentication errors
 * 5. The secret can be re-authenticated using the authenticate endpoint
 *
 * **Use Cases:**
 * - Immediately revoke access when credentials are compromised
 * - Disconnect integrations when no longer needed without losing configuration
 * - Rotate OAuth tokens by revoking and re-authenticating
 * - Comply with security policies requiring periodic credential rotation
 * - Remove access for users who no longer need it
 *
 * **Important Notes:**
 * - This endpoint only works with `shared` OAuth secrets
 * - Revocation attempts to invalidate tokens with the external service, but success
 *   depends on the service's revocation API
 * - The secret must be re-authenticated before it can be used again
 * - Revocation is immediate and will cause authentication failures for active agents
 *
 * **Error Cases:**
 * - Returns conflict if the secret is not a `shared` secret
 * - Returns not found if the secret doesn't exist or has already been revoked
 * - Returns not authorized if the user doesn't have permission to revoke the secret
 */
