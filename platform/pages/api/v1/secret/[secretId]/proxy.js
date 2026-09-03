// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound } from '@/lib/response'
import { canUseSecret } from '@/lib/secret.access'
import { executeSecretProxy } from '@/lib/secret.proxy'
import { withSession } from '@/lib/session.handler'

export const bodySchema = schema.object({
  method: schema
    .string()
    .valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS')
    .default('GET'),

  url: schema
    .string()
    .uri({ scheme: ['http', 'https'] })
    .required(),

  headers: schema.object().unknown(true).default({}),

  body: schema.string().allow(null, ''),
})

/**
 * @swagger
 *
 * /secret/{secretId}/proxy:
 *   post:
 *     operationId: proxySecret
 *     summary: Proxy a request with a secret
 *     description: |
 *       Performs an outbound HTTP request with the secret injected into the
 *       request headers at egress. The secret value never leaves the server.
 *       Reference the secret in any header value using `${SECRET_DEFAULT}`; if
 *       no header references the secret, it is injected into `Authorization`.
 *       The upstream response is returned verbatim.
 *     tags:
 *       - Secret
 *     parameters:
 *       - in: path
 *         name: secretId
 *         required: true
 *         schema:
 *           type: string
 *           description: The ID of the secret to inject
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               method:
 *                 description: The HTTP method
 *                 type: string
 *               url:
 *                 description: The destination URL
 *                 type: string
 *               headers:
 *                 description: The request headers (may reference the secret)
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *               body:
 *                 description: The request body
 *                 type: string
 *             required:
 *               - url
 *     responses:
 *       200:
 *         description: The upstream response, returned verbatim
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
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

      return executeSecretProxy(session.user.id, secret, body)
    })
  )
)

/**
 * @manual Secrets
 * @index 40
 *
 * ## Proxying Requests Through a Secret
 *
 * The proxy endpoint performs an outbound HTTP request on your behalf with the
 * secret injected into the request headers server-side. The credential value
 * never leaves the platform - you describe the request, and the platform fills
 * in the secret and returns the upstream response.
 *
 * This is the simplest way to call a third-party API using a stored secret
 * without handling the credential yourself. It works for every secret type,
 * including OAuth (the access token is refreshed automatically) and
 * platform-managed secrets (routed through the relevant provider).
 *
 * ```http
 * POST /api/v1/secret/{secretId}/proxy
 * Content-Type: application/json
 *
 * {
 *   "method": "POST",
 *   "url": "https://slack.com/api/chat.postMessage",
 *   "headers": { "Authorization": "${SECRET_DEFAULT}", "Content-Type": "application/json" },
 *   "body": "{\"channel\":\"C123\",\"text\":\"hello\"}"
 * }
 * ```
 *
 * Reference the secret in any header with `${SECRET_DEFAULT}`. If you omit it,
 * the secret is injected into the `Authorization` header automatically. The
 * upstream status, headers and body are returned verbatim (the injected
 * `Authorization` header is never echoed back).
 *
 * **Notes:**
 * - The request is made from the platform's network, so the destination must be
 *   publicly reachable. For private or IP-restricted endpoints, retrieve the
 *   token instead and call from your own environment.
 * - For per-user (personal) secrets, use the contact-scoped variant at
 *   `/api/v1/contact/{contactId}/secret/{secretId}/proxy`.
 */
