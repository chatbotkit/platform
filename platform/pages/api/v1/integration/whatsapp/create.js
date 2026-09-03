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

  phoneNumberId: schema.string().allow(null, ''),
  accessToken: schema.string().allow(null, ''),
  appSecret: schema.string().allow(null, ''),

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
 * /integration/whatsapp/create:
 *   post:
 *     operationId: createWhatsAppIntegration
 *     summary: Create WhatsApp integration
 *     tags:
 *       - WhatsApp Integration
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
 *                   phoneNumberId:
 *                     description: The WhatsApp integration phone number ID
 *                     type: string
 *                     nullable: true
 *                   accessToken:
 *                     description: The WhatsApp integration access token
 *                     type: string
 *                     nullable: true
 *                   appSecret:
 *                     description: The Meta app secret used to validate webhook signatures
 *                     type: string
 *                     nullable: true
 *                   contactCollection:
 *                     description: Weather to collect contacts
 *                     type: boolean
 *                   sessionDuration:
 *                     description: The session duration (in milliseconds)
 *                     type: number
 *                     nullable: true
 *                   attachments:
 *                     description: Weather the bot supports attachments
 *                     type: boolean
 *                   allowFrom:
 *                     description: Newline-or-comma-separated list of allowed senders. Use E.164 phone numbers with or without the leading `+`. Set to `*` to allow all. Leave empty to deny all.
 *                     type: string
 *                     nullable: true
 *     responses:
 *       200:
 *         description: The WhatsApp integration was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the WhatsApp Integration
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

        phoneNumberId,
        accessToken,
        appSecret,

        contactCollection,

        sessionDuration,

        attachments,

        allowFrom,

        meta,
      } = body

      if (accessToken === '********') {
        accessToken = undefined
      }

      if (appSecret === '********') {
        appSecret = undefined
      }

      const { id } = await prisma.whatsappIntegration.create({
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

          phoneNumberId,
          accessToken,
          appSecret,

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
 * @manual WhatsApp Integration
 * @description WhatsApp Integration enables you to connect your conversational AI with the WhatsApp Business platform, allowing you to engage with users through one of the world's most popular messaging applications.
 * @category Integrations
 * @tags whatsapp, integration, messaging, facebook, meta
 * @index 20
 *
 * WhatsApp Integration provides a powerful way to connect your AI bots with
 * WhatsApp Business, enabling you to reach billions of users worldwide through
 * a familiar and trusted messaging platform. The integration supports rich
 * features including contact collection, file attachments, vision models for
 * image processing, and comprehensive event logging for monitoring and analytics.
 *
 * The WhatsApp Integration leverages the Meta Business API and requires
 * proper configuration of webhooks, access tokens, and phone numbers through
 * the Meta Developer Portal. Once configured, your chatbot can receive and
 * respond to messages, handle multimedia content, and maintain conversation
 * sessions with customizable durations.
 *
 * ## Creating a WhatsApp Integration
 *
 * Creating a WhatsApp integration is the first step to connecting your
 * chatbot with WhatsApp Business. This process establishes the foundation
 * for receiving and sending messages through the WhatsApp platform.
 *
 * To create a new WhatsApp integration, you need to provide basic information
 * such as the integration name and optional description. The integration
 * automatically generates a unique verify token that will be used during
 * webhook setup with Meta's platform:
 *
 * ```http
 * POST /api/v1/integration/whatsapp/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support Bot",
 *   "description": "WhatsApp integration for customer inquiries",
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
 * and create a WhatsApp Business application through the Meta Developer Portal
 *
 * 2. **Set up Webhooks** - Configure webhook endpoints in the Meta Developer
 * Portal using the callback URL and verify token provided by ChatBotKit
 *
 * 3. **Configure Access Token** - Generate a permanent access token with
 * appropriate permissions (`whatsapp_business_messaging` and
 * `whatsapp_business_management`) and update your integration
 *
 * 4. **Add Phone Number ID** - Obtain your WhatsApp phone number ID from
 * the Meta API Setup page and configure it in your integration
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
 * - WhatsApp Business API requires a verified business account and may
 * require payment details depending on your usage tier
 *
 * - Test phone numbers have limitations and can only communicate with
 * pre-verified recipient numbers added in the Meta Developer Portal
 *
 * - The access token must have both `whatsapp_business_messaging` and
 * `whatsapp_business_management` permissions for full functionality
 *
 * **Sender Filtering (allowFrom)**: Restrict which phone numbers can send
 * messages to the integration. Provide a newline-or-comma-separated list of
 * allowed senders using E.164 phone number format (e.g., `+15551234567` or
 * `15551234567` without the leading `+`). Set this field to `*` to allow all
 * senders. Leave empty to deny all incoming messages. This is useful for
 * limiting the bot to known contacts, test numbers, or a specific user group.
 *
 * For detailed setup instructions, refer to the [WhatsApp Integration
 * Guide](/docs/whatsapp) in the main documentation.
 */
