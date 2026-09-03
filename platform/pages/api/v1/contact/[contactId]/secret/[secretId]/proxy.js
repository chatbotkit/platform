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
 * /contact/{contactId}/secret/{secretId}/proxy:
 *   post:
 *     operationId: proxyContactSecret
 *     summary: Proxy a request with a contact's secret
 *     description: |
 *       Performs an outbound HTTP request with a personal (per-contact) secret
 *       injected into the request headers at egress. The secret value never
 *       leaves the server. The upstream response is returned verbatim.
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

      return executeSecretProxy(session.user.id, secret, body, { contact })
    })
  )
)

/**
 * @manual Contact Secrets
 * @index 40
 *
 * ## Proxying Requests Through a Contact's Secret
 *
 * The contact-scoped proxy endpoint performs an outbound HTTP request using a
 * personal (per-contact) secret, with the credential injected server-side. This
 * is the per-user variant of the secret proxy: the `contactId` selects which
 * end-user's stored credential to use.
 *
 * ```http
 * POST /api/v1/contact/{contactId}/secret/{secretId}/proxy
 * Content-Type: application/json
 *
 * {
 *   "method": "GET",
 *   "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages",
 *   "headers": { "Authorization": "${SECRET_DEFAULT}" }
 * }
 * ```
 *
 * The credential value is never returned. For shared (app-level) secrets, use
 * the unscoped variant at `/api/v1/secret/{secretId}/proxy`.
 */
