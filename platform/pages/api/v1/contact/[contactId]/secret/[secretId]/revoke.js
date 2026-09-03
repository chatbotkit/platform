// @ts-check
import prisma from '@/prisma/client'
import { SecretType } from '@/prisma/types'

import { withPost } from '@/lib/method'
import { revokeOAuthToken } from '@/lib/oauth.revoke'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { canUseSecret } from '@/lib/secret.access'
import { ContactSecretManager } from '@/lib/secret.manager'
import { getSecretValueAndType } from '@/lib/secret.value'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /contact/{contactId}/secret/{secretId}/revoke:
 *   post:
 *     operationId: revokeContactSecret
 *     summary: Revoke contact secret
 *     tags:
 *       - Contact Secret
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *           description: The ID of the contact the secret belongs to
 *       - in: path
 *         name: secretId
 *         required: true
 *         schema:
 *           type: string
 *           description: The ID of the secret to be revoked
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The contact secret was revoked successfully
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
    const contact = await prisma.contact.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'contactId')
    )

    if (!contact) {
      return notFound()
    }

    if (contact.userId !== session.user.id) {
      return notAuthorized()
    }

    const secret = await prisma.secret.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'secretId')
    )

    if (!secret) {
      return notFound()
    }

    if (!(await canUseSecret(session.user, secret))) {
      return notAuthorized()
    }

    // @todo move into a library

    const valueAndType = await getSecretValueAndType(secret, {
      contact: contact,
    })

    if (!valueAndType) {
      return notFound()
    }

    if (valueAndType.value && valueAndType.baseType === SecretType.oauth) {
      const value = valueAndType.value.replace(/^Bearer\s+/i, '')

      await revokeOAuthToken(secret, value)
    }

    const sm = new ContactSecretManager({ contact })

    await sm.delValue(secret, false)

    return ok({ id: secret.id })
  })
)

/**
 * @manual Contact Secrets
 *
 * ## Revoking Contact Secrets
 *
 * When you need to disconnect a contact's integration or remove their access
 * to an external service, the revoke endpoint permanently invalidates the
 * secret and terminates the authentication relationship.
 *
 * ```http
 * POST /api/v1/contact/{contactId}/secret/{secretId}/revoke
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Revoking a secret performs several important actions:
 *
 * - **Invalidates the secret**: The secret can no longer be used for authentication
 * - **Revokes OAuth tokens**: For OAuth-based secrets, the access token is revoked with the provider
 * - **Cleans up associations**: Removes the secret's connection to the contact
 * - **Maintains audit trail**: The revocation action is logged for security tracking
 *
 * ## When to Revoke Secrets
 *
 * You should revoke contact secrets in several scenarios:
 *
 * - **Security concerns**: If a secret may have been compromised or exposed
 * - **User request**: When a contact wants to disconnect an integration
 * - **Service changes**: When switching to a different authentication method
 * - **Account cleanup**: When removing unused or obsolete integrations
 * - **Access control**: When a contact should no longer have access to a service
 *
 * ## OAuth Token Revocation
 *
 * For secrets that use OAuth 2.0 authentication, the revocation process
 * includes notifying the OAuth provider to invalidate the access token.
 * This ensures that:
 *
 * - The token becomes immediately invalid at the provider level
 * - No further API requests can be made using the revoked token
 * - The contact must go through the full OAuth flow again to reconnect
 *
 * The revocation request is sent to the OAuth provider's token revocation
 * endpoint as defined in the OAuth 2.0 specification (RFC 7009), ensuring
 * proper cleanup on both the ChatBotKit side and the external service side.
 *
 * ## Revocation Response
 *
 * Upon successful revocation, the endpoint returns the ID of the revoked
 * secret:
 *
 * ```json
 * {
 *   "id": "secret_abc123"
 * }
 * ```
 *
 * After revocation, the secret cannot be used for any authentication
 * operations, and the contact will need to authenticate again to restore
 * integration functionality.
 *
 * **Important:** Revocation is permanent and cannot be undone. The contact
 * must complete the authentication flow again to create a new secret if they
 * want to reconnect the integration. Any AI agents or automations using the
 * revoked secret will no longer be able to access the external service on
 * behalf of the contact.
 */
