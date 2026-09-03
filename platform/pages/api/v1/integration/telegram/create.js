// @ts-check
import { ONE_MONTH_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  botToken: schema.string().allow(null, ''),

  contactCollection: schema.boolean(),

  sessionDuration: schema
    .number()
    .min(0)
    .max(ONE_MONTH_IN_MILLISECONDS)
    .allow(null),

  attachments: schema.boolean(),

  allowFrom: schema.string().allow(null, ''),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/telegram/create:
 *   post:
 *     operationId: createTelegramIntegration
 *     summary: Create Telegram integration
 *     tags:
 *       - Telegram Integration
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
 *                   botToken:
 *                     description: The Telegram integration bot token
 *                     type: string
 *                   contactCollection:
 *                     description: Weather to collect contacts
 *                     type: boolean
 *                   sessionDuration:
 *                     description: The session duration (in milliseconds)
 *                     type: number
 *                   attachments:
 *                     description: Weather the bot supports attachments
 *                     type: boolean
 *                   allowFrom:
 *                     description: Newline-or-comma-separated list of allowed senders. Use @username or @numericId for users, #chatId for groups. Leave empty to allow all.
 *                     type: string
 *     responses:
 *       200:
 *         description: The Telegram integration was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Telegram Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['database/integration'],
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        alias,

        name,
        description,

        blueprintId: blueprint,

        botId: bot,

        botToken,

        contactCollection,

        sessionDuration,

        attachments,

        allowFrom,

        meta,
      } = body

      const { id } = await prisma.telegramIntegration.create({
        data: {
          userId: session.user.id,

          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          botId: bot?.id || bot,

          // resource specific

          botToken,

          contactCollection,

          sessionDuration,

          attachments,

          allowFrom,

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

/**
 * @manual Telegram Integration
 * @description Telegram integration allows you to connect ChatBotKit with Telegram bots, enabling powerful conversational AI experiences directly within Telegram messaging platform for individuals and businesses.
 * @category Integrations
 * @tags telegram, integration, messaging, bot
 * @index 20
 *
 * Telegram is one of the most popular messaging platforms worldwide, with millions
 * of active users. Integrating ChatBotKit with Telegram allows you to create
 * intelligent conversational bots that can interact with users in real-time,
 * providing automated support, information delivery, and engaging conversations
 * directly within the Telegram app.
 *
 * The Telegram integration enables your ChatBotKit bots to receive and respond
 * to messages from Telegram users, supporting both individual chats and group
 * conversations. With features like contact collection, session management, and
 * attachment handling, you can build sophisticated bot experiences tailored to
 * your specific use case.
 *
 * ## Creating a Telegram Integration
 *
 * Before creating a Telegram integration in ChatBotKit, you need to create a
 * bot through Telegram's BotFather. Once you have your bot token from BotFather,
 * you can create the integration to connect your ChatBotKit bot with Telegram.
 *
 * To create a new Telegram integration, send a POST request with your bot token
 * and configuration options:
 *
 * ```http
 * POST /api/v1/integration/telegram/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support Bot",
 *   "description": "Telegram bot for customer support",
 *   "botId": "bot_xxxxx",
 *   "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
 *   "contactCollection": true,
 *   "sessionDuration": 3600000,
 *   "attachments": false
 * }
 * ```
 *
 * The `botToken` is the authentication token provided by Telegram's BotFather
 * when you create your bot. This token is required and must be kept secure as
 * it provides full access to your Telegram bot's functionality.
 *
 * ### Configuration Options
 *
 * - **name**: A descriptive name for your integration
 * - **description**: Optional description for internal reference
 * - **botId**: Link to an existing ChatBotKit bot that will handle conversations
 * - **blueprintId**: Optional blueprint for advanced configuration
 * - **botToken**: Your Telegram bot token from BotFather (required)
 * - **contactCollection**: Enable to collect user contact information
 * - **sessionDuration**: Session timeout in milliseconds (max 30 days)
 * - **attachments**: Enable to allow users to send file attachments
 *
 * **Important:** After creating the integration, you must call the setup endpoint
 * to configure the webhook with Telegram. The integration will not be active
 * until the webhook is properly configured.
 *
 * ## Getting Your Bot Token
 *
 * To obtain a bot token from Telegram:
 *
 * 1. Open Telegram and search for `@BotFather`
 * 2. Start a conversation and send `/newbot`
 * 3. Follow the prompts to name your bot and choose a username
 * 4. BotFather will provide your bot token - save it securely
 * 5. Use this token when creating your ChatBotKit integration
 *
 * For detailed setup instructions, refer to the [Telegram Integration Guide](/docs/telegram).
 *
 * **Security Note:** Never share your bot token publicly or commit it to version
 * control. Anyone with access to your bot token can control your Telegram bot.
 */
