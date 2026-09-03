// @ts-check
import prisma from '@/prisma/client'
import { BlueprintVisibility } from '@/prisma/types'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintConfigSchema from '@/schemas/blueprintConfig'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  visibility: schema.string().valid(...Object.keys(BlueprintVisibility)),

  config: blueprintConfigSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /blueprint/{blueprintId}/update:
 *   post:
 *     operationId: updateBlueprint
 *     summary: Update blueprint
 *     tags:
 *       - Blueprint
 *     parameters:
 *       - in: path
 *         name: blueprintId
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
 *               - type: object
 *                 properties:
 *                   visibility:
 *                     $ref: '#/components/schemas/BlueprintVisibility'
 *     responses:
 *       200:
 *         description: The blueprint was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated blueprint
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

        visibility,

        config,

        meta,
      } = body

      const blueprint = await prisma.blueprint.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'blueprintId')
      )

      if (!blueprint) {
        return notFound()
      }

      if (blueprint.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.blueprint.update({
        where: {
          id: blueprint.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          // resource specific

          visibility,

          config: getMeta(config, blueprint.config),

          // meta and others

          meta: getMeta(meta, blueprint.meta),
        },
      })

      return ok({ id: blueprint.id })
    })
  )
)

/**
 * @manual Blueprints
 * @index 20
 *
 * ## Updating a Blueprint
 *
 * Modifying blueprint properties allows you to refine configurations, change visibility settings, and update metadata as your requirements evolve. Updates are applied to the blueprint container itself and don't affect the resources contained within it.
 *
 * To update a blueprint, send a POST request with the blueprint ID and the properties you want to change. You can update the name, description, visibility setting, config, or metadata without affecting any of the resources associated with the blueprint:
 *
 * ```http
 * POST /api/v1/blueprint/{blueprintId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Enhanced Customer Support Template",
 *   "description": "Updated customer support configuration with additional features",
 *   "visibility": "protected"
 * }
 * ```
 *
 * When updating, you only need to include the fields you want to change - any omitted fields will retain their current values. This partial update approach makes it convenient to modify specific aspects of a blueprint without having to resend all its properties.
 *
 * ### Common Update Scenarios
 *
 * **Changing Visibility**: Update the visibility setting when you want to share a blueprint with your organization or make it publicly accessible. This is useful when promoting internal templates to wider use.
 *
 * **Updating Config**: The config field stores UI-related configuration such as element positions and notes in the blueprint designer. This is managed by the designer interface and typically does not need to be modified directly.
 *
 * **Updating Metadata**: The meta field allows you to store custom application-specific properties, category tags, or other user-defined configuration. You can update this field to maintain additional context about your blueprint.
 *
 * **Renaming and Documentation**: Keep blueprint names and descriptions current as the contained resources evolve, making it easier for team members to understand the purpose and contents of each blueprint.
 *
 * **Note:** Updating a blueprint does not modify any of the resources it contains. To update contained resources like bots or datasets, you need to update them individually using their respective endpoints.
 */
