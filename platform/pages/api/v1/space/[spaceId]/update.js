// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import contactIdSchema from '@/schemas/contactId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  contactId: contactIdSchema('use'),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /space/{spaceId}/update:
 *   post:
 *     operationId: updateSpace
 *     summary: Update space
 *     tags:
 *       - Space
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BlueprintProps'
 *               - type: object
 *                 properties:
 *                   contactId:
 *                     type: string
 *                     description: The contact associated with the space
 *     responses:
 *       200:
 *         description: The space was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated space
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

        blueprintId: blueprint,

        contactId: contact,

        meta,
      } = body

      const space = await prisma.space.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'spaceId')
      )

      if (!space) {
        return notFound()
      }

      if (space.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.space.update({
        where: {
          id: space.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          contactId: contact?.id,

          // resource specific

          // @todo add here

          // meta and others

          meta: getMeta(meta, space.meta),
        },
      })

      return ok({ id: space.id })
    })
  )
)

/**
 * @manual Spaces
 * @index 30
 *
 * ## Updating a Space
 *
 * Modifying space properties allows you to keep workspace information current
 * as project requirements evolve or organizational needs change. The update
 * operation provides flexibility to modify any configurable space property
 * while maintaining the space's identity and existing relationships.
 *
 * When updating a space, you can modify its name, description, associated
 * contact, and custom metadata. The update operation intelligently merges
 * metadata changes, preserving existing metadata keys that aren't explicitly
 * updated while applying new values for keys that are provided.
 *
 * To update a space, send a POST request with the updated properties:
 *
 * ```http
 * POST /api/v1/space/{spaceId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Premium Support - ACME Corp",
 *   "description": "Upgraded support space with priority handling",
 *   "contactId": "contact_xyz789",
 *   "meta": {
 *     "tier": "premium",
 *     "sla": "4-hour response"
 *   }
 * }
 * ```
 *
 * All fields in the update request are optional, allowing you to modify only
 * the properties that need changing. For example, to update just the name:
 *
 * ```http
 * POST /api/v1/space/space_abc123/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Space Name"
 * }
 * ```
 *
 * **Metadata Management:** When updating metadata, the system intelligently
 * merges new metadata with existing values. To remove a metadata key, you
 * must explicitly set it to `null` in your update request. This behavior
 * ensures that partial metadata updates don't inadvertently delete existing
 * metadata properties.
 */
