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

  appId: schema.string().allow(null, ''),
  botToken: schema.string().allow(null, ''),
  publicKey: schema.string().allow(null, ''),

  handle: schema.string().allow(null, '').pattern(/^\w*$/),

  ephemeral: schema.boolean().allow(null),

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
 * /integration/discord/create:
 *   post:
 *     operationId: createDiscordIntegration
 *     summary: Create Discord integration
 *     tags:
 *       - Discord Integration
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
 *                   appId:
 *                     description: The Discord application ID
 *                     type: string
 *                   botToken:
 *                     description: The Discord bot token
 *                     type: string
 *                   publicKey:
 *                     description: The Discord public key
 *                     type: string
 *                   handle:
 *                     description: The Discord command handle
 *                     type: string
 *                   # ephemeral:
 *                   #   description: Indicate if the conversation is only visible to the user who invoked it.
 *                   #   type: boolean
 *                   contactCollection:
 *                     description: Weather to collect contacts
 *                     type: boolean
 *                   sessionDuration:
 *                     description: The chat session duration
 *                     type: number
 *                   # attachments:
 *                   #   description: Weather the bot supports attachments
 *                   #   type: boolean
 *                   allowFrom:
 *                     description: Restrict which Discord users can interact with this integration. Accepts Discord user IDs (17-18 digit snowflakes) or @username, one per line. Use * to allow all senders. Leave empty to deny all.
 *                     type: string
 *     responses:
 *       200:
 *         description: The Discord integration was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Discord Integration
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

        appId,
        botToken,
        publicKey,

        handle,

        ephemeral,

        contactCollection,

        sessionDuration,

        attachments,

        allowFrom,

        meta,
      } = body

      const { id } = await prisma.discordIntegration.create({
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

          appId,
          botToken,
          publicKey,

          handle,

          ephemeral,

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
 * @manual Discord Integration
 * @description Discord Integration enables you to connect ChatBotKit with Discord, allowing you to deploy conversational AI bots directly in Discord servers through slash commands and interactive messages.
 * @category Integrations
 * @tags discord, integration, messaging, slash-commands
 * @index 1
 *
 * Discord Integration allows you to bring ChatBotKit's conversational AI capabilities
 * directly into Discord servers, enabling bot interactions through slash commands and
 * interactive messaging. This integration provides seamless communication between your
 * AI bot and Discord users, supporting features like ephemeral messages and
 * customizable command handles.
 *
 * ## Creating a Discord Integration
 *
 * Creating a Discord integration establishes the connection between ChatBotKit and
 * your Discord application. Before creating an integration, you must first set up
 * a Discord bot application through the Discord Developer Portal. This involves
 * creating an application, adding a bot user, and obtaining the necessary credentials.
 *
 * To create a Discord integration, you need three key pieces of information from
 * your Discord application: the Application ID, Bot Token, and Public Key. These
 * credentials enable secure communication between ChatBotKit and Discord's API.
 * The Application ID identifies your Discord application, the Bot Token authenticates
 * API requests, and the Public Key verifies webhook signatures to ensure request
 * authenticity.
 *
 * ```http
 * POST /api/v1/integration/discord/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Support Bot",
 *   "description": "Customer support bot for Discord server",
 *   "botId": "bot_abc123",
 *   "appId": "1234567890123456789",
 *   "botToken": "YOUR_DISCORD_BOT_TOKEN_HERE",
 *   "publicKey": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
 *   "handle": "support",
 *   "ephemeral": false,
 *   "sessionDuration": 3600000
 * }
 * ```
 *
 * The `handle` parameter defines the slash command users will type to interact with
 * your bot (e.g., `/support` for a handle of "support"). If not specified, the default
 * handle is "chatbotkit". The `ephemeral` setting determines whether bot responses
 * are visible only to the user who invoked the command or to all members in the channel.
 *
 * Additional configuration options include `sessionDuration` to control conversation
 * session length (in milliseconds), `contactCollection` to enable user data collection,
 * `attachments` to allow file sharing, and `allowFrom` to restrict which Discord
 * users can send messages to the bot.
 *
 * **Important:** After creating the integration, you must configure the Interactions
 * Endpoint URL in your Discord application settings. This URL receives webhook events
 * from Discord and must be set to complete the integration setup. See the Setup section
 * for detailed configuration steps.
 *
 * ## Required Discord Bot Permissions
 *
 * When configuring your Discord bot in the Developer Portal, ensure your bot has the
 * following OAuth2 scopes enabled:
 *
 * - `applications.commands` - Required to register and manage slash commands
 * - `bot` - Standard bot permissions for server interaction
 *
 * The bot also requires these specific permissions within Discord servers:
 *
 * - Read Messages/View Channels - To see where commands are used
 * - Send Messages - To reply to user commands
 * - Use Slash Commands - Core functionality for command-based interactions
 * - Embed Links - To format rich message responses
 *
 * For more detailed information about Discord bot setup and configuration, refer to
 * the [Discord Integration Documentation](/docs/discord) and the
 * [Discord Developer Documentation](https://discord.com/developers/docs).
 */
