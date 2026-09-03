// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound } from '@/lib/response'
import { canManipulateSecret } from '@/lib/secret.access'
import { mintSecret } from '@/lib/secret.mint'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /contact/{contactId}/secret/{secretId}/mint:
 *   post:
 *     operationId: mintContactSecret
 *     summary: Mint a contact's secret for a token
 *     description: |
 *       Returns a usable token minted from a personal (per-contact) secret. The
 *       credential leaves the server, for use when a proxy cannot serve the
 *       request. Owner-only. Platform-managed and `basic`/`plain` secrets are
 *       not mintable.
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
 *           description: The ID of the secret to mint
 *     responses:
 *       200:
 *         description: The minted token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   description: The usable token to send to the provider
 *                   type: string
 *                 expiresAt:
 *                   description: Token expiry as a unix timestamp in ms, or null
 *                   type: number
 *               required:
 *                 - token
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

    if (!(await canManipulateSecret(session.user, secret))) {
      return notAuthorized()
    }

    return mintSecret(secret, { contact })
  })
)

/**
 * @manual Contact Secrets
 * @index 45
 *
 * ## Minting a Contact's Secret for a Token
 *
 * The contact-scoped mint endpoint returns a usable token minted from a
 * personal (per-contact) secret, so your own code can call the provider as that
 * end-user. The `contactId` selects whose stored credential to mint from.
 *
 * ```http
 * POST /api/v1/contact/{contactId}/secret/{secretId}/mint
 * ```
 *
 * Mint is owner-only. Only `oauth`/`jwt` secrets are mintable, platform-managed
 * secrets are not, and an unauthenticated secret returns
 * `409 authorization_required` with a `url`. Only the contact's own personal
 * secrets can be minted here - a shared (app-level) secret is rejected with
 * `403`; use the unscoped variant at `/api/v1/secret/{secretId}/mint` for those.
 */
