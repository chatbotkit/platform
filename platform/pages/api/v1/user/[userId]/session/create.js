// @ts-check
import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import cuid from '@/lib/cuid'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { getTemporaryAPISessionToken } from '@/lib/session.temp'
import { withChildUserSession } from '@/lib/user.handler'

export const bodySchema = schema.object({
  durationInSeconds: schema.number().integer().positive().allow(null),

  config: schema
    .object({
      allowedRoutes: schema.array().items(schema.string()).allow(null),

      contactId: schema.string().allow(null, ''),

      // ----------------
      // unstable options
      // ----------------

      // namespace

      namespace: schema.string().allow(null, ''),
    })
    .allow(null),
})

/**
 * @swagger
 *
 * /user/{userId}/session/create:
 *   post:
 *     operationId: createUserSession
 *     summary: Create a user session
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           description: The ID of the user
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               durationInSeconds:
 *                 description: The lifetime of the session token in seconds
 *                 type: number
 *               config:
 *                 type: object
 *                 properties:
 *                   allowedRoutes:
 *                     description: Glob patterns restricting which API routes the token may access
 *                     type: array
 *                     items:
 *                       type: string
 *                   contactId:
 *                     description: Optional contact ID to include in the session token
 *                     type: string
 *     responses:
 *       200:
 *         description: The session was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created session
 *                   type: string
 *                 token:
 *                   description: The temporary session token
 *                   type: string
 *                 expiresAt:
 *                   description: The timestamp for when the session token expires (in milliseconds)
 *                   type: number
 *               required:
 *                 - id
 *                 - token
 *                 - expiresAt
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withChildUserSession(
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        durationInSeconds: dis,

        config,
      } = body

      const childSession = {
        ...session,
        id: cuid(),
      }

      const tokenOptions =
        config || (dis !== undefined && dis !== null)
          ? {
              ...(config || {}),
              ...(dis !== undefined && dis !== null
                ? { durationInSeconds: dis }
                : {}),
            }
          : undefined

      const token = await getTemporaryAPISessionToken(
        childSession,
        tokenOptions
      )

      const durationInSeconds = dis ?? QUARTER_HOUR_IN_SECONDS

      const expiresAt = Date.now() + durationInSeconds * 1000

      return ok({ id: childSession.id, token, expiresAt })
    })
  )
)

/**
 * @manual User Sessions
 * @category User
 *
 * ## Creating User Sessions
 *
 * You can mint a temporary session token for a user by
 * sending a POST request to the user session creation endpoint. This
 * provides a time-limited alternative to long-lived API tokens when you need
 * to delegate limited access to a customer account.
 *
 * The session token is created in the context of the user selected by
 * the `{userId}` path parameter. The parent user remains the caller,
 * but the resulting token authenticates requests as the user. A fresh
 * transient session ID is generated for each call so every minted token is
 * isolated from the caller's own authenticated browser session.
 *
 * ```http
 * POST /api/v1/user/{userId}/session/create
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "durationInSeconds": 1200,
 *   "config": {
 *     "allowedRoutes": [
 *       "/api/v1/bot/**",
 *       "!/api/v1/conversation/**"
 *     ]
 *   }
 * }
 * ```
 *
 * The `durationInSeconds` field controls how long the minted session token
 * remains valid. The optional `config` object is forwarded into the temporary
 * session token generator and is intended for behavioral restrictions such as
 * `allowedRoutes`, plus additional internal session-scoping values like
 * `contactId`.
 *
 * **Security Note:** Prefer session tokens over persistent API tokens when the
 * access you need is short-lived or should be restricted to a narrow set of
 * API paths. Using `allowedRoutes` greatly reduces blast radius if a token is
 * leaked.
 */
