// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withChildUserSession } from '@/lib/user.handler'

import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  config: schema.object().allow(null), // @todo validate the shape

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /user/{userId}/token/{tokenId}/update:
 *   post:
 *     operationId: updateUserToken
 *     summary: Update a user token
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           description: The ID of the user
 *           type: string
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           description: The ID of the user token to update
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
 *         description: The user token was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated user token
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withChildUserSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        name,
        description,

        config,

        meta,
      } = body

      const token = await prisma.token.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'tokenId'),
        {
          select: {
            id: true,
            userId: true,
            meta: true,
          },
        }
      )

      if (!token) {
        return notFound()
      }

      if (token.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.token.update({
        where: {
          id: token.id,
        },

        data: {
          // basic information

          name,
          description,

          // resource specific

          config,

          // meta and others

          meta: getMeta(meta, token.meta),
        },
      })

      return ok({ id: token.id })
    })
  )
)

/**
 * @manual User Tokens
 *
 * ## Updating User Tokens
 *
 * To update an API token belonging to a user, send a
 * POST request to the user token update endpoint with the token ID and the
 * fields you want to persist. This allows the parent user to keep
 * token metadata, descriptions, and configuration aligned with the customer
 * integration the token is serving.
 *
 * ```http
 * POST /api/v1/user/{userId}/token/{tokenId}/update
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
 * update endpoint: `name`, `description`, `config`, and `meta`. Metadata is
 * merged with the token's existing metadata rather than replacing it outright,
 * allowing parent users to add or override specific keys without losing unrelated
 * values already stored on the token.
 *
 * **Operational Note:** Updating a token does not rotate or reveal its secret
 * value. Use the create and delete endpoints when you need to replace a token
 * credential entirely, and use this update endpoint when you only need to
 * adjust its descriptive fields or attached metadata.
 */
