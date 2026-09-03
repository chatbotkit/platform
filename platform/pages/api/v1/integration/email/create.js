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
import dbTextSchema from '@/schemas/dbText'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  contactCollection: schema.boolean(),

  sessionDuration: schema
    .number()
    .min(0)
    .max(ONE_MONTH_IN_MILLISECONDS)
    .allow(null),

  attachments: schema.boolean(),

  allowFrom: dbTextSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/email/create:
 *   post:
 *     operationId: createEmailIntegration
 *     summary: Create Email integration
 *     tags:
 *       - Email Integration
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
 *                     description: Newline-separated list of email patterns allowed to send messages to this integration
 *                     type: string
 *     responses:
 *       200:
 *         description: The Email integration was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Email Integration
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

        contactCollection,

        sessionDuration,

        attachments,

        allowFrom,

        meta,
      } = body

      const { id } = await prisma.emailIntegration.create({
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
 * @manual Email Integration
 * @description Email Integration enables your chatbot to interact with users through email, providing a dedicated inbox for automated email responses and support.
 * @category Integrations
 * @tags email, integration, inbox, support
 * @index 10
 *
 * The Email Integration allows you to set up a dedicated email inbox for your
 * AI chatbot, enabling seamless communication between your bot and users via
 * email. This integration is particularly useful for managing customer support
 * queries, automated responses, and asynchronous conversations where users
 * prefer email communication over real-time chat.
 *
 * When you create an Email Integration, ChatBotKit generates a unique email
 * address (inbox) that routes incoming messages to your configured bot. The bot
 * processes these emails and can respond automatically, maintaining conversation
 * context across multiple email exchanges within the configured session duration.
 *
 * ## Creating an Email Integration
 *
 * To create a new Email Integration, you need to configure several key parameters
 * that control how your bot handles email interactions. The integration requires
 * linking to an existing bot and allows you to customize various behaviors such
 * as contact collection, session management, and attachment handling.
 *
 * The basic setup requires providing a name and description for identification
 * purposes. You must also link the integration to a bot that will handle the
 * incoming emails. Optionally, you can link to a blueprint for more complex
 * configurations:
 *
 * ```http
 * POST /api/v1/integration/email/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Support Email Bot",
 *   "description": "Automated email support for customer inquiries",
 *   "botId": "bot_abc123",
 *   "contactCollection": true,
 *   "sessionDuration": 3600000,
 *   "attachments": true
 * }
 * ```
 *
 * ### Configuration Parameters
 *
 * **Bot Linking**: The `botId` parameter connects your Email Integration to a
 * specific bot that will process incoming emails. This bot should be configured
 * with appropriate instructions and knowledge to handle email-based conversations.
 *
 * **Contact Collection**: When enabled, the integration automatically captures
 * contact information from email senders, including their email addresses and
 * any other details provided in the conversation. This is useful for building
 * contact lists and tracking user interactions.
 *
 * **Session Duration**: This parameter (in milliseconds) determines how long
 * the bot maintains conversation context. For example, setting this to 3600000
 * (1 hour) means the bot will remember previous exchanges within a 1-hour window,
 * enabling more coherent multi-email conversations.
 *
 * **Attachments**: Enable this option if you want your bot to receive and
 * process email attachments. The bot can access file information and, depending
 * on its configuration, may be able to analyze document contents.
 *
 * **Blueprint Integration**: Linking to a blueprint allows you to use pre-configured
 * setups that include datasets, skillsets, and other resources. This is useful
 * for deploying consistent configurations across multiple integrations.
 *
 * **Sender Filtering (allowFrom)**: Restrict which email senders can interact with
 * the integration. Provide a newline-separated list of email address patterns. When
 * left empty, all incoming emails are denied. To allow all senders, set this field
 * to `*`. Patterns may include full email addresses (e.g., `user@example.com`) or
 * domain-level entries (e.g., `@example.com`) to match all addresses from a domain.
 * This is useful for restricting your bot to internal teams, trusted customers, or
 * specific mailing lists.
 *
 * ### Generated Inbox Address
 *
 * After creating the integration, ChatBotKit generates a unique email address
 * that serves as your bot's inbox. This address is typically in the format
 * `[unique-identifier]@integration.chatbotkit.email`. All emails sent to this
 * address will be processed by your configured bot.
 *
 * Share this inbox address with your users or configure it as a forwarding
 * destination from your existing support email systems. The inbox can handle
 * multiple concurrent conversations and will route each sender's emails to
 * separate conversation threads.
 *
 * ### Important Considerations
 *
 * **Response Time**: Email responses are processed asynchronously. While the bot
 * typically responds within seconds, email delivery times depend on standard
 * email protocols and may take longer during high-volume periods.
 *
 * **Security**: The generated inbox address should be treated as a public endpoint.
 * Do not share sensitive authentication tokens or credentials via the inbox address
 * itself. Use the integration's metadata field for secure configuration storage.
 *
 * **Rate Limits**: Email integrations are subject to platform rate limits to
 * prevent abuse. High-volume use cases should contact support for appropriate
 * configuration.
 *
 * For detailed setup instructions and advanced configuration options, refer to
 * the Email Integration guide in the documentation.
 */
