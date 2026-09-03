// @ts-check
import prisma from '@/prisma/client'

import { UserAuthError } from '@/lib/error'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { conflict, notAuthorized, notFound, ok } from '@/lib/response'
import { canUseSecret } from '@/lib/secret.access'
import { DirectSecretManager, getSecretManager } from '@/lib/secret.manager'
import { getSecretValue } from '@/lib/secret.value'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /secret/{secretId}/verify:
 *   post:
 *     operationId: verifySecret
 *     summary: Verify secret
 *     tags:
 *       - Secret
 *     parameters:
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
 *         description: The secret was verified successfully
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
        value = await getSecretValue(secret, {})
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
          secretManager = getSecretManager(secret, {})

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
 * @manual Secrets
 * @index 35
 *
 * ## Verifying Secret Status
 *
 * Check whether a secret is properly configured and authenticated. This endpoint is
 * essential for validating that credentials are available and ready to use, especially
 * for OAuth-based secrets that require user authentication. The verify endpoint returns
 * the secret's authentication status and provides an action URL if authentication is
 * needed.
 *
 * Verification is particularly important for `personal` secrets and OAuth secrets,
 * where users must complete an authentication flow before the secret can be used.
 * This endpoint helps you determine whether additional steps are required before
 * agents can successfully use the secret.
 *
 * To verify a secret's status:
 *
 * ```http
 * POST /api/v1/secret/{secretId}/verify
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The response indicates the authentication status and provides next steps if needed:
 *
 * ```json
 * {
 *   "id": "secret_abc123",
 *   "status": "unauthenticated",
 *   "action": {
 *     "type": "authenticate",
 *     "url": "https://oauth.example.com/authorize?client_id=..."
 *   }
 * }
 * ```
 *
 * **Status Values:**
 * - `authenticated` - Secret is properly configured and ready to use
 * - `unauthenticated` - Secret requires user authentication (OAuth flow needed)
 *
 * **When Status is "unauthenticated":**
 * The response includes an `action` object with:
 * - `type` - The action type (typically "authenticate")
 * - `url` - The authentication URL the user must visit
 *
 * **Use Cases:**
 * - Verify secrets before using them in agent configurations
 * - Check if OAuth tokens are still valid or need refresh
 * - Display authentication prompts in your user interface when secrets need setup
 * - Validate secret configuration during integration testing
 * - Audit secret readiness across your workspace
 *
 * **Best Practices:**
 * - Always verify secrets before deploying agents to production
 * - Implement retry logic for authentication failures in your applications
 * - Use this endpoint to proactively detect expired or revoked OAuth tokens
 * - Cache verification results temporarily to avoid excessive API calls
 * - Display clear instructions to users when authentication is required
 */
