// @ts-check
import prisma from '@/prisma/client'
import { BotVisibility } from '@/prisma/types'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import backstorySchema from '@/schemas/backstory'
import blueprintIdSchema from '@/schemas/blueprintId'
import datasetIdSchema from '@/schemas/datasetId'
import descriptionSchema from '@/schemas/description'
import languageModelSchema from '@/schemas/languageModel'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import skillsetIdSchema from '@/schemas/skillsetId'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  backstory: backstorySchema,

  model: languageModelSchema,

  datasetId: datasetIdSchema('use'),
  skillsetId: skillsetIdSchema('use'),

  privacy: schema.boolean(),
  moderation: schema.boolean(),

  visibility: schema.string().valid(...Object.keys(BotVisibility)),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /bot/{botId}/update:
 *   post:
 *     operationId: updateBot
 *     summary: Update bot
 *     tags:
 *       - Bot
 *     parameters:
 *       - in: path
 *         name: botId
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
 *               - $ref: '#/components/schemas/BotConfig'
 *               - $ref: '#/components/schemas/BlueprintProps'
 *               - type: object
 *                 properties:
 *                   visibility:
 *                     $ref: '#/components/schemas/BotVisibility'
 *     responses:
 *       200:
 *         description: The bot was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated bot
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

        backstory,

        model,

        datasetId: dataset,
        skillsetId: skillset,

        privacy,
        moderation,

        visibility,

        meta,
      } = body

      const bot = await prisma.bot.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'botId')
      )

      if (!bot) {
        return notFound()
      }

      if (bot.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.bot.update({
        where: {
          id: bot.id,
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

          backstory,

          model,

          datasetId: dataset?.id || dataset,
          skillsetId: skillset?.id || skillset,

          privacy,
          moderation,

          visibility,

          // meta and others

          meta: getMeta(meta, bot.meta),
        },
      })

      return ok({ id: bot.id })
    })
  )
)

/**
 * @manual Bots
 * @index 30
 *
 * ## Updating Bots
 *
 * Updating a bot allows you to modify its configuration, behavior, and
 * connected resources after creation. This is essential for refining bot
 * performance, adjusting its personality, changing the underlying AI model,
 * connecting or disconnecting datasets and skillsets, or updating security and
 * visibility settings.
 *
 * You can update any aspect of your bot including its name, description,
 * backstory, model, connected resources, privacy settings, moderation options,
 * and visibility. The update operation is flexible, allowing you to modify
 * only the specific fields you want to change while leaving others unchanged.
 *
 * ```http
 * POST /api/v1/bot/{botId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Advanced Support Bot",
 *   "backstory": "You are an expert technical support representative with deep product knowledge.",
 *   "model": "glm-5.2",
 *   "datasetId": "dataset_xyz789",
 *   "privacy": true,
 *   "moderation": true
 * }
 * ```
 *
 * Updating the backstory is a powerful way to refine your bot's behavior
 * without creating a new bot. You can adjust the tone, add new instructions,
 * or modify how the bot should handle specific scenarios. Changes to the
 * backstory take effect immediately for all new conversations.
 *
 * Switching the AI model can significantly impact your bot's capabilities and
 * performance characteristics. Different models offer varying levels of
 * intelligence, response quality, speed, and cost. Consider testing model
 * changes in a development environment before applying them to production bots
 * that are actively serving users.
 *
 * Connecting or disconnecting datasets and skillsets allows you to dynamically
 * adjust your bot's knowledge base and capabilities. When you connect a new
 * dataset, the bot gains access to that information for answering questions.
 * Similarly, connecting skillsets enables new abilities that the bot can use
 * during conversations.
 */
