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
 * /secret/{secretId}/mint:
 *   post:
 *     operationId: mintSecret
 *     summary: Mint a secret for a token
 *     description: |
 *       Returns a usable token minted from the secret (a refreshed OAuth access
 *       token, a freshly signed JWT, or a stored bearer token). This is the one
 *       endpoint where the credential leaves the server, for use when a proxy
 *       cannot serve the request (provider SDKs, non-HTTP, or targets not
 *       reachable from the platform). Owner-only. `basic`/`plain` and
 *       platform-managed secrets are not mintable - use the proxy instead.
 *     tags:
 *       - Secret
 *     parameters:
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

    return mintSecret(secret)
  })
)

/**
 * @manual Secrets
 * @index 45
 *
 * ## Minting a Secret for a Token
 *
 * The mint endpoint returns a usable token minted from the secret so your
 * own code can call the provider directly. This is the one operation where the
 * credential leaves the platform, intended for cases the proxy cannot serve:
 * provider SDKs that need a token string, non-HTTP protocols, or endpoints that
 * are not reachable from the platform's network (private/internal/IP-allowlisted
 * services you reach from your own environment).
 *
 * ```http
 * POST /api/v1/secret/{secretId}/mint
 * ```
 *
 * The response carries the token and its expiry only:
 *
 * ```json
 * {
 *   "token": "ya29.a0Af...",
 *   "expiresAt": 1782950400000
 * }
 * ```
 *
 * **Rules:**
 * - Mint is **owner-only** - only the secret's owner may retrieve its token.
 * - Only `oauth` and `jwt` secrets are mintable - they mint a fresh,
 *   short-lived token. `bearer`, `basic` and `plain` secrets are static stored
 *   values and return `409 not_mintable` - use the proxy, which keeps the
 *   value server-side.
 * - **Platform-managed secrets cannot be minted** (there is no raw provider
 *   token to mint) - use the proxy instead.
 * - An unauthenticated secret returns `409 authorization_required` with a `url`
 *   the user must visit to authenticate.
 *
 * For per-user (personal) secrets, use the contact-scoped variant at
 * `/api/v1/contact/{contactId}/secret/{secretId}/mint`.
 */
