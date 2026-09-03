// @ts-check
import prisma from '@/prisma/client'
import { SkillsetVisibility } from '@/prisma/types'

import debug from '@/lib/debug'
import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import stateSchema from '@/schemas/state'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  visibility: schema.string().valid(...Object.keys(SkillsetVisibility)),

  state: stateSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /skillset/{skillsetId}/update:
 *   post:
 *     operationId: updateSkillset
 *     summary: Update skillset
 *     tags:
 *       - Skillset
 *     parameters:
 *       - in: path
 *         name: skillsetId
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
 *                   visibility:
 *                    $ref: '#/components/schemas/SkillsetVisibility'
 *                   state:
 *                    $ref: '#/components/schemas/ResourceState'
 *     responses:
 *       200:
 *         description: The skillset was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated skillset
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

        visibility,

        state,

        meta,
      } = body

      debug(`updating skillset`, {
        name,
        description,

        visibility,

        meta,
      })

      const skillset = await prisma.skillset.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'skillsetId')
      )

      if (!skillset) {
        return notFound()
      }

      if (skillset.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.skillset.update({
        where: {
          id: skillset.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          // resource specific

          visibility,

          // lifecycle

          state,

          // meta and others

          meta: getMeta(meta, skillset.meta),
        },
      })

      return ok({ id: skillset.id })
    })
  )
)

/**
 * @manual Skillsets
 *
 * ## Updating Skillsets
 *
 * As your requirements evolve, you'll need to update skillset properties such as
 * the name, description, or visibility settings. Updating a skillset allows you
 * to refine its configuration without affecting the abilities it contains. This
 * is particularly useful when you want to reorganize your skillsets, clarify
 * their purposes, or adjust access controls.
 *
 * When updating a skillset, you can modify any of the properties that were set
 * during creation, including the name, description, blueprint association, and
 * visibility settings. The abilities contained within the skillset remain
 * unchanged - you manage those separately through the ability endpoints.
 *
 * ```http
 * POST /api/v1/skillset/{skillsetId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Enhanced Customer Support Toolkit",
 *   "description": "Expanded abilities for comprehensive customer support including multi-language support and advanced analytics",
 *   "visibility": "private"
 * }
 * ```
 *
 * The update operation is atomic, meaning all changes are applied together or
 * none are applied if there's an error. This ensures your skillset always
 * remains in a consistent state. After updating a skillset, the changes take
 * effect immediately for any conversations or agents using that skillset.
 *
 * **Important Considerations:**
 *
 * - Updating a skillset does not modify its abilities - those must be updated separately
 * - Changes to skillset properties take effect immediately for active conversations
 * - You can change the blueprint association to reorganize your project structure
 * - Updating visibility affects who can see and use the skillset
 * - The skillset ID remains constant, so existing references remain valid
 */
