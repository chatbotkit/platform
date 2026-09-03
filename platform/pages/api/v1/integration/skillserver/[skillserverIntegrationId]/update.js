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
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import skillsetIdSchema from '@/schemas/skillsetId'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  skillsetId: skillsetIdSchema('use'),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/skillserver/{skillserverIntegrationId}/update:
 *   post:
 *     operationId: updateSkillServerIntegration
 *     summary: Update a SkillServer integration
 *     tags:
 *       - SkillServer Integration
 *     parameters:
 *       - in: path
 *         name: skillserverIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the SkillServer integration
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
 *                   skillsetId:
 *                     description: The ID of the skillset
 *                     type: string
 *     responses:
 *       200:
 *         description: The SkillServer integration was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the SkillServer Integration
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

        skillsetId: skillset,

        meta,
      } = body

      const skillserverIntegration =
        await prisma.skillserverIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'skillserverIntegrationId')
        )

      if (!skillserverIntegration) {
        return notFound()
      }

      if (skillserverIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.skillserverIntegration.update({
        where: {
          id: skillserverIntegration.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          skillsetId: skillset?.id || skillset,

          // meta and others

          meta: getMeta(meta, skillserverIntegration.meta),
        },
      })

      return ok({ id: skillserverIntegration.id })
    })
  )
)

/**
 * @manual SkillServer Integration
 *
 * ## Updating SkillServer Integrations
 *
 * Change which skillset is exposed, update organizational information, or
 * re-associate the integration with a different blueprint. Updates take effect
 * immediately for subsequent manual and invoke requests.
 *
 * ```http
 * POST /api/v1/integration/skillserver/{skillserverIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Tools",
 *   "skillsetId": "skillset_001"
 * }
 * ```
 *
 * Changing `skillsetId` replaces which abilities are available; consumers should
 * re-read the manual after a change. The static access token is unaffected by
 * updates.
 */
