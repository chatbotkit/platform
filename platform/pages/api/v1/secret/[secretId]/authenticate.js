// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { conflict, notAuthorized, notFound, ok } from '@/lib/response'
import { canUseSecret } from '@/lib/secret.access'
import { DirectSecretManager, getSecretManager } from '@/lib/secret.manager'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /secret/{secretId}/authenticate:
 *   post:
 *     operationId: authenticateSecret
 *     summary: Authenticate secret
 *     tags:
 *       - Secret
 *     parameters:
 *       - in: path
 *         name: secretId
 *         required: true
 *         schema:
 *           type: string
 *           description: The ID of the secret to authenticate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The secret is about to be authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the secret to authenticate
 *                   type: string
 *                 url:
 *                   description: The URL to authenticate the secret
 *                   type: string
 *               required:
 *                 - id
 *                 - url
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

    if (!(await canUseSecret(session.user, secret))) {
      return notAuthorized()
    }

    let secretManager

    {
      secretManager = getSecretManager(secret, {})

      if (!secretManager) {
        return conflict(
          'Cannot authenticate secret for this secret configuration'
        )
      }
    }

    let url

    {
      switch (true) {
        case secretManager instanceof DirectSecretManager: {
          url = await secretManager.getAuthUrl(secret, {
            raw: true, // @note using raw because we don't want to create temp urls unnecessarily
          })

          break
        }

        default: {
          return conflict('Cannot obtain secret for this secret type')
        }
      }
    }

    return ok({ id: secret.id, url })
  })
)

/**
 * @manual Secrets
 * @index 30
 *
 * ## Authenticating OAuth Secrets
 *
 * Initiate the OAuth authentication flow for a secret that requires user authorization.
 * This endpoint is specifically designed for `personal` secrets or OAuth-based secrets
 * that need to obtain access tokens through user consent. The endpoint returns an
 * authentication URL that users must visit to grant permissions.
 *
 * OAuth authentication is required for integrations with services like Google, Slack,
 * GitHub, and other platforms that use OAuth 2.0 for authorization. This process
 * ensures that secrets are bound to specific user accounts and include only the
 * permissions that users explicitly grant.
 *
 * To initiate OAuth authentication:
 *
 * ```http
 * POST /api/v1/secret/{secretId}/authenticate
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The response includes an authentication URL that the user must visit in their
 * browser:
 *
 * ```json
 * {
 *   "id": "secret_abc123",
 *   "url": "https://oauth.example.com/authorize?client_id=..."
 * }
 * ```
 *
 * **Authentication Flow:**
 * 1. Call this endpoint to get the authentication URL
 * 2. Redirect the user to the returned URL in their browser
 * 3. User grants permissions on the external service
 * 4. External service redirects back to the platform with authorization code
 * 5. Platform exchanges the code for access tokens and stores them securely
 * 6. Secret is now authenticated and ready to use
 *
 * **Important Considerations:**
 * - This endpoint only works with secrets configured for OAuth authentication
 * - The authentication URL is typically valid for a limited time (usually 10-15 minutes)
 * - Users must complete the OAuth flow in the same browser session
 * - After successful authentication, use the verify endpoint to confirm the secret
 *   is properly configured
 *
 * **Error Cases:**
 * - Returns a conflict error if the secret type doesn't support OAuth authentication
 * - Returns not found if the secret doesn't exist
 * - Returns not authorized if the user doesn't have permission to authenticate the secret
 */
