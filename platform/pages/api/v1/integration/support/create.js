// @ts-check
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
 * /integration/support/create:
 *   post:
 *     operationId: createSupportIntegration
 *     summary: Create Support integration
 *     tags:
 *       - Support Integration
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
 *         description: The Support integration was created successfully
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
  withSessionLimits(
    ['database/integration'],
    withSchema(bodySchema, async function (_req, session, body) {
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

      const { id } = await prisma.supportIntegration.create({
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

          email,

          trigger,

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
 * @manual Support Integration
 * @description Support integrations enable automated customer support workflows by connecting AI chatbots with support systems like Zendesk, Intercom, and email platforms, automatically extracting customer information and routing conversations.
 * @category Integrations
 * @tags support, integration, customer-support, zendesk, intercom
 * @index 15
 *
 * Support integrations bridge the gap between fully autonomous AI support
 * and human customer service agents. When configured, these integrations
 * allow your AI chatbot to handle initial customer inquiries in real-time,
 * collect essential customer information, and seamlessly escalate conversations
 * to human support teams when needed.
 *
 * The integration automatically extracts customer details such as name and
 * email address during conversations, which are then used to properly route
 * transcribed and summarized conversations to your support system. This ensures
 * human support agents have full context and can follow up with customers
 * effectively.
 *
 * ## Creating a Support Integration
 *
 * To create a support integration, you need to configure the connection between
 * your chatbot and your support system. The most critical configuration is
 * specifying the incoming email address for your support platform, which is
 * where conversation summaries and customer information will be forwarded.
 *
 * ```http
 * POST /api/v1/integration/support/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support Integration",
 *   "description": "Routes customer conversations to support team",
 *   "botId": "bot_abc123",
 *   "email": "support@acme.com"
 * }
 * ```
 *
 * The `email` parameter should be set to your support system's incoming email
 * address (e.g., support@acme.com for direct email, or your Zendesk/Intercom
 * email address). This is where ChatBotKit will forward conversation summaries
 * and customer information after interactions complete.
 *
 * ### Bot Configuration Requirements
 *
 * For the integration to work effectively, your chatbot must be instructed to
 * collect the user's name and email address during the conversation. This can
 * be configured in the bot's backstory with instructions like:
 *
 * "During the conversation, politely collect the user's full name and email
 * address. Ask for these details naturally as part of helping them with their
 * inquiry."
 *
 * **Warning for Zendesk Users:** Emails forwarded from ChatBotKit may initially
 * be marked as spam by Zendesk due to the reply-to header configuration required
 * for proper customer routing. To resolve this, add ChatBotKit's email address
 * to your Zendesk whitelist by marking one incoming email as "not spam". This
 * is a one-time setup step necessary for reliable operation.
 */
