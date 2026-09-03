// @ts-check
import prisma from '@/prisma/client'

import { digestCredential } from '@/lib/credential.digest'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { makeJsonSafe } from '@/lib/struct'
import { withChildUserSession } from '@/lib/user.handler'

import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

import crypto from 'crypto'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  config: schema.object().allow(null), // @todo validate the shape

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /user/{userId}/token/create:
 *   post:
 *     operationId: createUserToken
 *     summary: Create user token
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
 *               name:
 *                 description: The name of the token
 *                 type: string
 *               description:
 *                 description: The description of the token
 *                 type: string
 *               config:
 *                 description: Token configuration
 *                 type: object
 *               meta:
 *                 description: Custom metadata for the token
 *                 type: object
 *     responses:
 *       200:
 *         description: The user token was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created user token
 *                   type: string
 *                 token:
 *                   description: The token of the created user token
 *                   type: string
 *                 createdAt:
 *                   description: The timestamp for when the user token was created (in milliseconds)
 *                   type: number
 *               required:
 *                 - id
 *                 - token
 *                 - createdAt
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withChildUserSession(
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        name,
        description,

        config,

        meta,
      } = body

      const token = `sk-${crypto.randomBytes(32).toString('hex')}`
      const tokenDigest = await digestCredential(token)

      const { id, createdAt } = await prisma.token.create({
        data: {
          userId: session.user.id,

          // basic information

          name,
          description,

          // resource specific

          config,

          token: tokenDigest,

          // meta and others

          meta,
        },

        select: {
          // identifiers

          id: true,

          // meta and others

          createdAt: true,
        },
      })

      return ok(makeJsonSafe({ id, token, createdAt }))
    })
  )
)

/**
 * @manual User Tokens
 * @description User tokens are API authentication tokens created for users, enabling secure programmatic access on behalf of an isolated account.
 * @category User
 * @tags user, tokens, api-keys, authentication
 * @index 2
 *
 * User tokens provide an authentication mechanism for child Users to
 * access the ChatBotKit API programmatically without user impersonation. The
 * parent User creates these tokens on behalf of its child Users, and each
 * token grants access within the target User's isolated scope.
 *
 * ## Creating User Tokens
 *
 * To create an API token for a user, send a POST request
 * to the user token creation endpoint. This operation must be performed by
 * the parent user and requires the target user's ID. The
 * created token will belong to the user and grant access to their
 * resources and permissions.
 *
 * User tokens are particularly useful when building integrated solutions
 * where your application needs to perform operations on behalf of customer
 * accounts. For example, you might create tokens during customer onboarding
 * to enable immediate API access, or generate tokens for specific integrations
 * that need to interact with ChatBotKit services.
 *
 * ```http
 * POST /api/v1/user/{userId}/token/create
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "name": "Customer Integration Token",
 *   "description": "Used by the customer CRM sync job",
 *   "config": null,
 *   "meta": {
 *     "environment": "production"
 *   }
 * }
 * ```
 *
 * The request body supports the same token fields as the standard user token
 * creation endpoint: `name`, `description`, `config`, and `meta`. The API
 * returns the newly created token string along with its ID and creation
 * timestamp. This is the only time the complete token value will be available
 * - it cannot be retrieved again later for security reasons. Store the token
 * securely in your application's configuration or secret management system.
 *
 * **Critical Security Notice:** API tokens provide full access to the
 * user and all its resources. The returned token value (prefixed
 * with `sk-`) must be treated as a highly sensitive credential. Never expose
 * tokens in client-side code, log files, error messages, or publicly
 * accessible locations. Always transmit tokens over HTTPS and store them
 * encrypted at rest.
 *
 * **Token Usage:** The created token can be used in the `Authorization` header
 * as a Bearer token for all ChatBotKit API requests. When the token is used,
 * all operations are performed within the context of the user account,
 * with access to only their resources and subject to their configured limits.
 *
 * **Important:** Unlike regular user sessions, API tokens do not expire
 * automatically and remain valid until explicitly deleted. Implement token
 * rotation policies in your application to periodically create new tokens and
 * delete old ones, reducing the risk of compromised credentials being used
 * indefinitely.
 */
