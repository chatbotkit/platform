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
 * /integration/messenger/create:
 *   post:
 *     operationId: createMessengerIntegration
 *     summary: Create Messenger integration
 *     tags:
 *       - Messenger Integration
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
 *                     description: The Messenger integration access token
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
 *         description: The Messenger integration was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Messenger Integration
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

      const { id } = await prisma.messengerIntegration.create({
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
 * @manual Messenger Integration
 * @description Integrate ChatBotKit with Facebook Messenger to deploy conversational AI that engages with your Messenger audience through automated responses, natural language understanding, and seamless conversation management.
 * @category Integrations
 * @tags messenger, facebook, integration, webhook
 * @index 1
 *
 * Messenger integration enables your ChatBotKit bots to interact with users
 * on Facebook Messenger, one of the world's most popular messaging platforms
 * with over 1 billion active users. This integration provides real-time
 * message handling, webhook-based event processing, and comprehensive support
 * for attachments, postbacks, and persistent menus.
 *
 * The integration handles all aspects of Facebook Messenger's API, including
 * webhook verification, message sending and receiving, conversation session
 * management, and seamless handoff to human agents when needed. Your bot can
 * respond to text messages, process image attachments, handle button clicks
 * and quick replies, and maintain conversation context across multiple
 * interactions.
 *
 * ## Creating Messenger Integrations
 *
 * Creating a Messenger integration is the first step to deploying your bot on
 * Facebook Messenger. The integration requires a Facebook Page and an access
 * token from the Facebook Developer Portal with appropriate permissions to
 * send and receive messages on behalf of your page.
 *
 * Before creating the integration in ChatBotKit, you need to set up a Facebook
 * App in the Facebook Developer Portal, add the Messenger product, and generate
 * a Page Access Token with the following permissions: `pages_messaging`,
 * `pages_manage_metadata`, and `pages_read_engagement`. This token authenticates
 * your integration and allows ChatBotKit to send messages through your
 * Facebook Page.
 *
 * The integration creation process generates a unique verify token that you'll
 * use to configure the webhook in Facebook's Developer Portal. This verify
 * token ensures that only Facebook can send webhook events to your integration,
 * preventing unauthorized access and maintaining security.
 *
 * ```http
 * POST /api/v1/integration/messenger/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support Messenger Bot",
 *   "description": "Automated customer support on Messenger",
 *   "botId": "bot_abc123",
 *   "accessToken": "EAAxxxxxxxxxxxxxx",
 *   "sessionDuration": 86400000,
 *   "attachments": true,
 *   "contactCollection": true
 * }
 * ```
 *
 * The `accessToken` parameter is your Facebook Page Access Token, which you can
 * generate in the Facebook Developer Portal. The `sessionDuration` parameter
 * controls how long conversation sessions persist (in milliseconds), with a
 * default of 24 hours. Setting `attachments` to `true` enables your bot to
 * receive and process image, video, and file attachments sent by users.
 *
 * **Important:** After creating the integration, you must complete the webhook
 * setup in Facebook's Developer Portal using the callback URL and verify token
 * provided by ChatBotKit. Without proper webhook configuration, your integration
 * will not receive messages from Facebook Messenger. Additionally, you should
 * call the setup endpoint to configure the persistent menu and get started button
 * for an optimal user experience.
 *
 * **Security Note:** Store your access token securely and never expose it in
 * client-side code. The access token grants full control over your Facebook
 * Page's messaging capabilities and should be treated as a sensitive credential.
 * Consider using short-lived tokens and rotating them periodically for enhanced
 * security.
 */
