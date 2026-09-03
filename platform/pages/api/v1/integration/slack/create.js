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

  signingSecret: schema.string().allow(null, ''),

  botToken: schema.string().allow(null, ''),

  userToken: schema.string().allow(null, ''),

  contactCollection: schema.boolean(),

  sessionDuration: schema
    .number()
    .min(0)
    .max(ONE_MONTH_IN_MILLISECONDS)
    .allow(null),

  attachments: schema.boolean(),

  references: schema.boolean(),

  ratings: schema.boolean(),

  visibleMessages: schema.number().min(0).max(10).allow(null),

  autoRespond: schema.string().allow(null, ''),

  allowFrom: schema.string().allow(null, ''),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/slack/create:
 *   post:
 *     operationId: createSlackIntegration
 *     summary: Create Slack integration
 *     tags:
 *       - Slack Integration
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
 *                   signingSecret:
 *                     description: The signing secret for the Slack integration
 *                     type: string
 *                   botToken:
 *                     description: The bot token for the Slack integration
 *                     type: string
 *                   userToken:
 *                     description: The user token for the Slack integration
 *                     type: string
 *                   sessionDuration:
 *                     description: The session duration for the Slack integration
 *                     type: number
 *                   contactCollection:
 *                     description: Weather to collect contacts
 *                     type: boolean
 *                   # attachments:
 *                   #   description: Weather the bot supports attachments
 *                   #   type: boolean
 *                   references:
 *                     description: Whether to enable references feature
 *                     type: boolean
 *                   ratings:
 *                     description: Whether to enable ratings buttons feature
 *                     type: boolean
 *                   visibleMessages:
 *                     description: The number of visible messages outside of the new thread
 *                     type: number
 *                   autoRespond:
 *                     description: Configure automatic response behavior. Use '@all' to respond to all messages, '@agent <instructions>' for agent-powered decisions, or custom instructions for lightweight LLM filtering. Null/empty defaults to current behavior (DMs, mentions, threads only).
 *                     type: string
 *                   allowFrom:
 *                     description: Restrict which Slack users or channels can interact with this integration. Accepts Slack user IDs (U…/W…), channel IDs (C…/G…/D…), @username, or #channel-name, one per line. Use * to allow all senders. Leave empty to deny all.
 *                     type: string
 *     responses:
 *       200:
 *         description: The Slack integration was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Slack Integration
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

        signingSecret,

        botToken,

        userToken,

        contactCollection,

        sessionDuration,

        attachments,

        references,

        ratings,

        visibleMessages,

        autoRespond,

        allowFrom,

        meta,
      } = body

      if (signingSecret === '********') {
        signingSecret = undefined
      }

      if (botToken === '********') {
        botToken = undefined
      }

      if (userToken === '********') {
        userToken = undefined
      }

      const { id } = await prisma.slackIntegration.create({
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

          signingSecret,

          botToken,

          userToken,

          contactCollection,

          sessionDuration,

          attachments,

          references,

          ratings,

          visibleMessages,

          autoRespond,

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
 * @manual Slack Integration
 * @description Integrate ChatBotKit with Slack to deploy intelligent AI agents directly within your Slack workspace, enabling seamless team collaboration through channels, direct messages, and slash commands.
 * @category Integrations
 * @tags slack, integration, webhook, bot
 * @index 1
 *
 * ChatBotKit's Slack integration enables you to deploy powerful AI agents
 * directly within your Slack workspace, allowing teams to interact with
 * intelligent assistants through natural conversations in channels, direct
 * messages, and slash commands. This integration provides a comprehensive
 * solution for customer support automation, knowledge management, team
 * collaboration, and workflow enhancement.
 *
 * The Slack integration supports advanced features including contextual
 * conversations with visible message history, file attachments for document
 * analysis, interactive references with citation buttons, and user feedback
 * collection through reaction-based ratings. All interactions are processed
 * through secure webhook endpoints that handle real-time events from Slack.
 *
 * ## Creating a Slack Integration
 *
 * Creating a Slack integration establishes the foundation for deploying your
 * AI agent within a Slack workspace. The integration requires proper
 * authentication credentials from Slack and allows you to configure various
 * behavioral options that control how your bot interacts with users.
 *
 * Before creating the integration, you'll need to set up a Slack app in your
 * workspace and obtain the necessary credentials. The Slack app must be
 * configured with appropriate OAuth scopes, event subscriptions, and slash
 * command settings to enable full functionality.
 *
 * To create a new Slack integration, send a POST request with your
 * configuration:
 *
 * ```http
 * POST /api/v1/integration/slack/create
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "name": "Customer Support Bot",
 *   "description": "AI assistant for customer support inquiries",
 *   "botId": "bot_abc123",
 *   "signingSecret": "your_slack_signing_secret",
 *   "botToken": "xoxb-your-bot-token",
 *   "visibleMessages": 10,
 *   "attachments": true,
 *   "references": true,
 *   "ratings": true
 * }
 * ```
 *
 * The `signingSecret` and `botToken` are obtained from your Slack app
 * configuration. The signing secret is found under "Basic Information" →
 * "App Credentials" → "Signing Secret", and the bot token is located under
 * "OAuth & Permissions" → "Bot User OAuth Token" (starts with `xoxb-`).
 *
 * ### Required OAuth Scopes
 *
 * Your Slack app must have these Bot Token Scopes configured in "OAuth & Permissions":
 *
 * - `app_mentions:read` - Allows the bot to see when it's mentioned in channels
 * - `channels:history` - Enables reading public channel message history
 * - `groups:history` - Allows reading private channel messages
 * - `im:history` - Enables reading direct message history
 * - `mpim:history` - Allows reading group direct message history
 * - `chat:write` - Permits sending messages to channels and DMs
 * - `users:read` - Enables reading user profile information
 * - `commands` - Required for slash command functionality
 * - `files:read` - Required when attachments feature is enabled
 *
 * ### Configuration Options
 *
 * The integration supports several optional configuration parameters:
 *
 * **visibleMessages** (number, 0-10): Number of recent channel messages to
 * include as context for bot responses. When set to a value greater than 0,
 * the bot can understand and reference previous messages in the conversation
 * thread. Recommended value is 5-10 for optimal context without overwhelming
 * the AI model.
 *
 * **attachments** (boolean): Enables file upload support, allowing users to
 * share documents, images, spreadsheets, and other files with the bot for
 * processing and analysis. Useful for technical support scenarios, document
 * review workflows, and content analysis tasks.
 *
 * **references** (boolean): Displays interactive "View References" buttons
 * below bot responses that contain citations or source material. Users can
 * click these buttons to see the exact sources used in generating the response,
 * including document names and relevant excerpts.
 *
 * **ratings** (boolean): Adds thumbs up (👍) and thumbs down (👎) reaction
 * buttons below bot responses, enabling users to provide immediate feedback on
 * response quality. Downvotes prompt users to optionally provide detailed
 * feedback explaining why the response wasn't helpful.
 *
 * **contactCollection** (boolean): Enables collection and storage of user
 * contact information during conversations, useful for lead generation and
 * customer relationship management.
 *
 * **sessionDuration** (number): Maximum duration in milliseconds for
 * conversation sessions before automatic reset. When null or not specified,
 * sessions remain active indefinitely.
 *
 * **allowFrom** (string): Restrict which Slack senders can interact with the
 * integration. Provide one entry per line. Accepted formats are:
 *
 * - Slack user IDs starting with `U` or `W` (e.g., `U01234ABCDE`)
 * - Channel IDs starting with `C`, `G`, or `D` (e.g., `C01234ABCDE`)
 * - `@username` for user display-name matching
 * - `#channel-name` for channel name matching
 * - `*` to allow all senders
 *
 * Leave this field empty to deny all messages. This is useful for limiting
 * the bot to specific users, teams, or channels.
 *
 * ### Webhook Configuration
 *
 * After creating the integration, configure these webhook URLs in your Slack
 * app settings:
 *
 * **Event Subscriptions** (Enable Events → Request URL):
 * ```
 * https://api.chatbotkit.com/v1/integration/slack/{slackIntegrationId}/event
 * ```
 *
 * Subscribe to these bot events:
 * - `app_mention` - When bot is mentioned in channels
 * - `message.channels` - Public channel messages
 * - `message.groups` - Private channel messages
 * - `message.im` - Direct messages
 * - `message.mpim` - Group direct messages
 *
 * **Slash Commands** (Create New Command → Request URL):
 * ```
 * https://api.chatbotkit.com/v1/integration/slack/{slackIntegrationId}/command
 * ```
 *
 * **Interactivity & Shortcuts** (Turn on Interactivity → Request URL):
 * ```
 * https://api.chatbotkit.com/v1/integration/slack/{slackIntegrationId}/interaction
 * ```
 *
 * Replace `{slackIntegrationId}` with the ID returned from the create endpoint.
 *
 * **Warning:** The signing secret and bot token are sensitive credentials that
 * must be kept secure. Never commit these values to version control or share
 * them publicly. If credentials are compromised, regenerate them in your Slack
 * app settings and update your ChatBotKit integration immediately.
 *
 * **Note:** Some configuration options like `attachments`, `references`, and
 * `ratings` are marked as beta features and may evolve based on user feedback
 * and platform improvements.
 *
 * For comprehensive setup instructions including step-by-step Slack app
 * configuration, see the [Slack Integration Documentation](/docs/slack).
 */
