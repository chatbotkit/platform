// @ts-check
import prisma from '@/prisma/client'
import { UserLimits } from '@/prisma/zod'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  image: schema.string().allow(null, ''),

  email: schema
    .string()
    .allow(null, '')
    .email({
      allowFullyQualified: false,
      tlds: false,
    })
    .external((value) => {
      // @note return null when string is empty to avoid having unique constraint on empty string
      {
        if (value === '') {
          return null
        }
      }

      return value
    }, 'email'),

  limits: schema.object().zodSchema(UserLimits).allow(null),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /user/{userId}/update:
 *   post:
 *     operationId: updateUser
 *     summary: Update a user
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
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - type: object
 *                 properties:
 *                   image:
 *                     description: The image of the user
 *                     type: string
 *                   email:
 *                     description: The email of the user
 *                     type: string
 *                   limits:
 *                     $ref: '#/components/schemas/Limits'
 *     responses:
 *       200:
 *         description: The message was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated user
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        alias,

        name,
        description,

        image,

        email,

        limits,

        meta,
      } = body

      const user = await prisma.user.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'userId')
      )

      if (!user) {
        return notFound()
      }

      if (user.parentId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource specific

          image,

          parentContextName: name,
          parentContextEmail: email,

          limits,

          // meta and others

          meta: getMeta(meta, user.meta),
        },
      })

      return ok({ id: user.id })
    })
  )
)

/**
 * @manual Users
 *
 * ## Updating Users
 *
 * You can modify a user's properties by sending a POST
 * request to the user update endpoint. This operation allows you to
 * change the user's name, description, profile image, contact email, resource
 * limits, and custom metadata without affecting their underlying resources or
 * authentication credentials.
 *
 * Updates to users are particularly useful when customer information
 * changes, you need to adjust resource allocations, or you want to update
 * branding elements like profile images. All properties except the user's ID
 * and internal authentication details can be modified through this endpoint.
 *
 * ```http
 * POST /api/v1/user/{userId}/update
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "name": "Acme Corporation - Updated",
 *   "description": "Enterprise customer with expanded access",
 *   "email": "admin@acme.example.com"
 * }
 * ```
 *
 * The update operation is atomic and validates all input parameters before
 * applying any changes. If validation fails, no modifications are made to the
 * user account. The API returns the updated user's ID upon successful
 * completion, confirming that changes have been applied.
 *
 * **Important:** Updating resource limits affects what the user can
 * create and access within their isolated account. Be cautious when reducing limits,
 * as it may prevent the user from creating new resources until they're
 * within the new constraints. Existing resources are not automatically deleted
 * when limits are reduced.
 *
 * **Best Practice:** When implementing an admin interface for managing
 * users, fetch the current settings first, allow editing, then submit only
 * the changed fields along with unchanged required fields to maintain
 * consistency.
 */
