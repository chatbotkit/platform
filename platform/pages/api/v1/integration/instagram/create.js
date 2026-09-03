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

import crypto from 'crypto'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  accessToken: schema.string().allow(null, ''),
  appSecret: schema.string().allow(null, ''),

  contactCollection: schema.boolean(),

  sessionDuration: schema
    .number()
    .min(0)
    .max(ONE_MONTH_IN_MILLISECONDS)
    .allow(null),

  attachments: schema.boolean(),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/instagram/create:
 *   post:
 *     operationId: createInstagramIntegration
 *     summary: Create Instagram integration
 *     tags:
 *       - Instagram Integration
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
 *                   accessToken:
 *                     description: The Instagram integration access token
 *                     type: string
 *                     nullable: true
 *                   appSecret:
 *                     description: The Meta app secret used to validate webhook signatures
 *                     type: string
 *                     nullable: true
 *                   contactCollection:
 *                     description: Whether to collect contacts
 *                     type: boolean
 *                   sessionDuration:
 *                     description: The session duration (in milliseconds)
 *                     type: number
 *                     nullable: true
 *                   attachments:
 *                     description: Whether the bot supports attachments
 *                     type: boolean
 *     responses:
 *       200:
 *         description: The Instagram integration was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Instagram Integration
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
      let {
        alias,

        name,
        description,

        blueprintId: blueprint,

        botId: bot,

        accessToken,

        appSecret,

        contactCollection,

        sessionDuration,

        attachments,

        meta,
      } = body

      if (accessToken === '********') {
        accessToken = undefined
      }

      if (appSecret === '********') {
        appSecret = undefined
      }

      const { id } = await prisma.instagramIntegration.create({
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

          verifyToken: crypto.randomBytes(32).toString('hex'),

          accessToken,
          appSecret,

          contactCollection,

          sessionDuration,

          attachments,

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
 * @manual Instagram Integration
 * @description Instagram Integration enables you to connect your conversational AI with the Instagram Messaging platform, allowing you to engage with users through Instagram Direct Messages.
 * @category Integrations
 * @tags instagram, integration, messaging, facebook, meta
 * @index 25
 *
 * Instagram Integration provides a powerful way to connect your AI bots with
 * Instagram Messaging, enabling you to reach users through Instagram Direct
 * Messages. The integration supports rich features including contact collection,
 * file attachments, and comprehensive event logging for monitoring and analytics.
 *
 * The Instagram Integration leverages the Meta Instagram Messaging API and
 * requires proper configuration of webhooks, access tokens, and app settings
 * through the Meta Developer Portal. Once configured, your chatbot can receive
 * and respond to messages, handle multimedia content, and maintain conversation
 * sessions with customizable durations.
 *
 * ## Creating an Instagram Integration
 *
 * Creating an Instagram integration is the first step to connecting your
 * chatbot with Instagram Messaging. This process establishes the foundation
 * for receiving and sending messages through the Instagram platform.
 *
 * To create a new Instagram integration, you need to provide basic information
 * such as the integration name and optional description. The integration
 * automatically generates a unique verify token that will be used during
 * webhook setup with Meta's platform:
 *
 * ```http
 * POST /api/v1/integration/instagram/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support Bot",
 *   "description": "Instagram integration for customer inquiries",
 *   "botId": "bot_abc123",
 *   "contactCollection": true,
 *   "attachments": true,
 *   "sessionDuration": 3600000
 * }
 * ```
 *
 * The response includes the integration ID, which you'll use for subsequent
 * configuration steps. After creating the integration, you'll need to:
 *
 * 1. **Configure Meta Business Account** - Set up a Meta Business account
 * and create an Instagram App through the Meta Developer Portal
 *
 * 2. **Connect Instagram Account** - Link your Instagram Professional or
 * Business account to your Facebook Page
 *
 * 3. **Set up Webhooks** - Configure webhook endpoints in the Meta Developer
 * Portal using the callback URL and verify token provided by ChatBotKit
 *
 * 4. **Configure Access Token** - Generate a permanent access token with
 * appropriate permissions (`instagram_manage_messages`) and update your
 * integration
 *
 * ### Integration Configuration Options
 *
 * **Contact Collection**: When enabled, the integration automatically
 * collects and stores contact information from users who interact with
 * your bot, enabling personalized experiences and data-driven insights.
 *
 * **Session Duration**: Customize how long conversation sessions persist
 * (in milliseconds). This determines when the bot should treat messages
 * as part of an ongoing conversation versus starting a new session.
 *
 * **File Attachments**: Enable support for receiving and processing files,
 * images, and other media sent by users. All attachments are securely
 * stored and accessible through the conversation history.
 *
 * **Blueprint and Bot Linking**: Link your integration to a specific bot
 * or blueprint to inherit configurations and enable centralized management
 * of multiple integrations.
 *
 * **Important Notes:**
 *
 * - The verify token is automatically generated and cannot be changed after
 * creation - you'll use this token during Meta webhook configuration
 *
 * - Instagram Messaging API requires a verified business account and may
 * require payment details depending on your usage tier
 *
 * - The access token must have the `instagram_manage_messages` permission
 * for full functionality
 *
 * For detailed setup instructions, refer to the [Instagram Integration
 * Guide](/docs/instagram) in the main documentation.
 */
