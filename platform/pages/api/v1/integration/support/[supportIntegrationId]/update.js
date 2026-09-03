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
import botIdSchema from '@/schemas/botId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import triggerSchema from '@/schemas/trigger'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  email: schema.string().allow(null, '').email({ tlds: false }),

  trigger: triggerSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/support/{supportIntegrationId}/update:
 *   post:
 *     operationId: updateSupportIntegration
 *     summary: Update a Support integration
 *     tags:
 *       - Support Integration
 *     parameters:
 *       - in: path
 *         name: supportIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Support integration
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
 *               - $ref: '#/components/schemas/BotRef'
 *               - type: object
 *                 properties:
 *                   email:
 *                     description: The email to use
 *                     type: string
 *     responses:
 *       200:
 *         description: The Support integration was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Support Integration
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

        botId: bot,

        email,

        trigger,

        meta,
      } = body

      const supportIntegration =
        await prisma.supportIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'supportIntegrationId')
        )

      if (!supportIntegration) {
        return notFound()
      }

      if (supportIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.supportIntegration.update({
        where: {
          id: supportIntegration.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          botId: bot?.id || bot,

          // resource specific

          email,

          trigger,

          // meta and others

          meta: getMeta(meta, supportIntegration.meta),
        },
      })

      return ok({ id: supportIntegration.id })
    })
  )
)

/**
 * @manual Support Integration
 * @index 40
 *
 * ## Updating a Support Integration
 *
 * You can modify an existing support integration's configuration to adjust
 * how conversations are routed to your support team, change the target email
 * address, or update the associated bot. This flexibility allows you to adapt
 * your support workflows as your needs evolve without creating new integrations.
 *
 * ```http
 * POST /api/v1/integration/support/{supportIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Support Integration",
 *   "email": "support-new@acme.com"
 * }
 * ```
 *
 * All configuration parameters from the creation endpoint are available for
 * updates, including the integration name, description, associated bot ID,
 * and support email address. You only need to include the fields you want to
 * change - omitted fields will retain their current values.
 *
 * ### Common Update Scenarios
 *
 * **Changing Support Email:** If you migrate to a new support system or want
 * to route conversations to a different team, update the `email` parameter to
 * the new destination address. The integration will immediately begin forwarding
 * new conversations to the updated email address.
 *
 * **Switching Associated Bots:** Update the `botId` to connect the integration
 * to a different chatbot. This is useful when restructuring your bot architecture
 * or when you want to use a specialized bot for support interactions while
 * maintaining the same support email routing.
 *
 * ### Metadata Management
 *
 * The `meta` field supports partial updates, allowing you to add or modify
 * specific metadata properties without affecting existing ones. This is
 * particularly useful for storing custom tracking information, integration
 * states, or workflow-specific data alongside your support integration
 * configuration.
 */
