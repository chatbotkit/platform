// @ts-check
import prisma from '@/prisma/client'

import { UserAuthError } from '@/lib/error'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { conflict, notAuthorized, notFound, ok } from '@/lib/response'
import { canUseSecret } from '@/lib/secret.access'
import { ContactSecretManager, getSecretManager } from '@/lib/secret.manager'
import { getSecretValue } from '@/lib/secret.value'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /contact/{contactId}/secret/{secretId}/verify:
 *   post:
 *     operationId: verifyContactSecret
 *     summary: Verify contact secret
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
 *           description: The ID of the secret to be verified
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The contact secret was verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the verified secret
 *                   type: string
 *                 status:
 *                   description: The status of the secret
 *                   type: string
 *                   enum:
 *                     - unauthenticated
 *                     - authenticated
 *                 action:
 *                   oneOf:
 *                     - description: The action to take next
 *                       type: object
 *                       properties:
 *                         type:
 *                           description: The type of action to take
 *                           type: string
 *                           enum: ['authenticate']
 *                         url:
 *                           description: The URL to authenticate the secret
 *                           type: string
 *                       required:
 *                         - type
 *                         - url
 *               required:
 *                 - id
 *                 - status
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

    let value

    {
      try {
        value = await getSecretValue(secret, {
          contact,
        })
      } catch (e) {
        if (!(e instanceof UserAuthError)) {
          return conflict(e.message)
        }

        value = null
      }
    }

    let status = 'unauthenticated'

    {
      if (value) {
        status = 'authenticated'
      }
    }

    let action

    {
      if (status === 'unauthenticated') {
        let secretManager

        {
          secretManager = getSecretManager(secret, {
            contact,
          })

          if (!secretManager) {
            return conflict(
              'Cannot verify secret for this secret configuration'
            )
          }
        }

        /** @type {URL} */
        let url

        {
          switch (true) {
            case secretManager instanceof ContactSecretManager: {
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

        action = {
          type: 'authenticate',
          url: url.href,
        }
      }
    }

    return ok({ id: secret.id, status, action })
  })
)

/**
 * @manual Contact Secrets
 *
 * ## Verifying Contact Secret Status
 *
 * Before using a contact secret for integration purposes, you can verify its
 * current authentication status and determine whether the contact needs to
 * complete or refresh their authentication with the external service.
 *
 * ```http
 * POST /api/v1/contact/{contactId}/secret/{secretId}/verify
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The verification endpoint checks the secret's current state and returns
 * detailed information about its authentication status, helping you build
 * robust integrations that gracefully handle authentication requirements.
 *
 * ## Understanding Verification Responses
 *
 * The verification response indicates whether the secret is currently valid
 * and ready to use for authentication, or whether additional action is
 * required from the contact:
 *
 * **Authenticated Status:**
 *
 * ```json
 * {
 *   "id": "secret_abc123",
 *   "status": "authenticated"
 * }
 * ```
 *
 * When a secret is authenticated, it contains valid credentials and can be
 * immediately used for API requests to the external service. No further
 * action is needed from the contact.
 *
 * **Unauthenticated Status:**
 *
 * ```json
 * {
 *   "id": "secret_abc123",
 *   "status": "unauthenticated",
 *   "action": {
 *     "type": "authenticate",
 *     "url": "https://auth.example.com/oauth/authorize?..."
 *   }
 * }
 * ```
 *
 * When unauthenticated, the response includes an action object with a URL
 * where the contact should be redirected to complete the authentication flow.
 * This typically leads to an OAuth authorization page or API key setup form.
 *
 * ## Integration Flow Patterns
 *
 * The verify endpoint enables several useful integration patterns:
 *
 * **Pre-Integration Check:**
 * Before attempting to use a secret for an integration, verify its status
 * to ensure authentication is current. This prevents integration failures
 * due to expired or invalid credentials.
 *
 * **Lazy Authentication:**
 * When a user first tries to use an integration, verify the secret and
 * redirect them to authenticate only if needed. This creates a smooth
 * user experience where authentication happens on-demand.
 *
 * **Health Monitoring:**
 * Periodically verify secrets to detect when credentials expire or are
 * revoked, allowing you to proactively notify users before integration
 * failures occur.
 *
 * ## Handling Token Expiration
 *
 * For OAuth-based secrets, tokens can expire over time. The verify endpoint
 * attempts to detect expired tokens and will return an unauthenticated status
 * when refresh is needed. Some OAuth secrets may support automatic token
 * refresh, while others require the user to re-authorize.
 *
 * The verification process includes:
 *
 * - **Credential retrieval**: Attempts to retrieve the secret's credentials
 * - **Validation**: Checks if credentials are present and appear valid
 * - **Error handling**: Gracefully handles authentication errors
 * - **URL generation**: Creates an authentication URL when re-auth is needed
 *
 * ## Building User Interfaces
 *
 * The verify endpoint is particularly useful for building user interfaces
 * that show integration status. You can:
 *
 * - Display whether an integration is connected and active
 * - Show when authentication is required or has expired
 * - Provide direct links for users to authenticate or re-authenticate
 * - Implement connection health indicators in your application
 *
 * **Important:** Verification does not modify the secret or its state. It's
 * a read-only operation that safely checks authentication status without
 * risking changes to the integration configuration. Use the authenticate
 * endpoint to actually establish or refresh authentication.
 */
