// @ts-check
import prisma from '@/prisma/client'
import { BotVisibility } from '@/prisma/types'

import schema, { withSchema } from '@/lib/joi.handler'
import { withLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
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
 * /bot/create:
 *   post:
 *     operationId: createBot
 *     summary: Create bot
 *     tags:
 *       - Bot
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
 *         description: The bot was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created bot
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withLimits(
      ['database/bot'],
      withSchema(bodySchema, async function (_req, session, body) {
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

        const { id } = await prisma.bot.create({
          data: {
            userId: session.user.id,

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

            meta,
          },

          select: {
            id: true,
          },
        })

        return ok({ id })
      })
    )
  )
)

/**
 * @manual Bots
 * @description Bots are intelligent conversational agents that can interact with users, answer questions, and perform tasks using AI models and connected resources like datasets and skillsets.
 * @category Resources/Bots
 * @tags bot, ai-agent, chatbot
 * @index 1
 *
 * Bots are the core entities in ChatBotKit that represent your conversational
 * AI agents. Each bot combines an AI language model with custom instructions
 * (backstory), knowledge bases (datasets), and capabilities (skillsets) to
 * create intelligent, context-aware conversational experiences.
 *
 * Bots can be configured for various use cases including customer support,
 * content generation, data analysis, and interactive assistants. They support
 * multiple AI models, privacy controls, content moderation, and can be
 * integrated across different communication channels.
 *
 * ## Creating Bots
 *
 * Creating a bot is the first step in building a conversational AI agent.
 * When you create a bot, you define its personality through a backstory,
 * select the underlying AI model that powers its intelligence, and optionally
 * connect it to knowledge bases (datasets) and capabilities (skillsets) that
 * extend what it can do.
 *
 * The bot creation process requires a name and allows you to specify various
 * configuration options that control its behavior, capabilities, and security
 * settings. You can configure privacy settings to prevent conversation data
 * from being used in model training, enable content moderation to filter
 * inappropriate content, and set visibility levels to control who can access
 * and use the bot.
 *
 * ```http
 * POST /api/v1/bot/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support Bot",
 *   "description": "Helpful assistant for customer inquiries",
 *   "model": "glm-5.2",
 *   "backstory": "You are a friendly customer support representative who helps users with product questions and technical issues.",
 *   "datasetId": "dataset_abc123",
 *   "privacy": true,
 *   "moderation": true
 * }
 * ```
 *
 * The backstory is a critical parameter that defines your bot's personality,
 * behavior, and conversational style. It provides instructions to the AI model
 * about how to respond, what tone to use, and what information to prioritize.
 * A well-crafted backstory ensures consistent and appropriate responses across
 * all conversations.
 */
