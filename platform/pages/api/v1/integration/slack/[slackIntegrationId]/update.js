// @ts-check
import { ONE_MONTH_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

import { sendEvent } from '@/pages/api/v1/integration/slack/[slackIntegrationId]/queue'

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
 * /integration/slack/{slackIntegrationId}/update:
 *   post:
 *     operationId: updateSlackIntegration
 *     summary: Update a Slack integration
 *     tags:
 *       - Slack Integration
 *     parameters:
 *       - in: path
 *         name: slackIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Slack integration
 *           type: string
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
 *                   contactCollection:
 *                     description: Weather to collect contacts
 *                     type: boolean
 *                   sessionDuration:
 *                     description: The session duration for the Slack integration
 *                     type: number
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
 *         description: The Slack integration was updated successfully
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
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
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

      const slackIntegration =
        await prisma.slackIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'slackIntegrationId')
        )

      if (!slackIntegration) {
        return notFound()
      }

      if (slackIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.slackIntegration.update({
        where: {
          id: slackIntegration.id,
        },

        data: {
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

          meta: getMeta(meta, slackIntegration.meta),
        },
      })

      await sendEvent(slackIntegration.id, {
        type: 'setup',
        payload: {},
      })

      return ok({ id: slackIntegration.id })
    })
  )
)

/**
 * @manual Slack Integration
 *
 * ## Updating Integration Configuration
 *
 * Modify an existing Slack integration's configuration, including authentication credentials, feature settings, and resource associations. Updates take effect immediately and trigger an automatic setup verification to ensure the integration continues functioning correctly.
 *
 * The update endpoint accepts the same parameters as the create endpoint, allowing you to modify any aspect of your integration's configuration. When you update authentication credentials or enable new features, the integration automatically re-validates its configuration with Slack.
 *
 * ```http
 * POST /api/v1/integration/slack/{slackIntegrationId}/update
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "name": "Updated Bot Name",
 *   "visibleMessages": 5,
 *   "references": true,
 *   "ratings": false
 * }
 * ```
 *
 * ### Common Update Scenarios
 *
 * **Rotating Credentials**: If your Slack bot token or signing secret is compromised or expired, update them immediately:
 *
 * ```json
 * {
 *   "signingSecret": "new_signing_secret_from_slack",
 *   "botToken": "xoxb-new-bot-token"
 * }
 * ```
 *
 * After updating credentials, the integration automatically triggers a setup validation to confirm the new credentials work correctly.
 *
 * **Enabling Beta Features**: Activate new features like attachments or references:
 *
 * ```json
 * {
 *   "attachments": true,
 *   "references": true,
 *   "ratings": true
 * }
 * ```
 *
 * **Adjusting Context Window**: Modify the number of visible messages for better context:
 *
 * ```json
 * {
 *   "visibleMessages": 10
 * }
 * ```
 *
 * Higher values (8-10) provide more context but may increase processing time and token usage. Lower values (3-5) offer faster responses with less context.
 *
 * **Changing Bot Association**: Switch to a different bot configuration:
 *
 * ```json
 * {
 *   "botId": "bot_new_configuration"
 * }
 * ```
 *
 * This is useful when you've improved your bot's backstory, added new datasets, or want to test different AI models without creating a new integration.
 *
 * **Restricting Senders**: Update `allowFrom` to control who can interact with the bot. Provide one entry per line using Slack user IDs, channel IDs, `@username`, or `#channel-name`. Use `*` to allow all senders. Leave empty to deny all:
 *
 * ```json
 * {
 *   "allowFrom": "U01234ABCDE\nC01234ABCDE\n@alice"
 * }
 * ```
 *
 * ### Automatic Setup Validation
 *
 * When you update an integration, the system automatically:
 *
 * 1. **Validates Credentials**: Confirms that signing secret and bot token are properly formatted
 * 2. **Tests Connectivity**: Verifies the bot token has the necessary OAuth scopes
 * 3. **Updates Webhooks**: Ensures event subscriptions are properly configured
 * 4. **Synchronizes State**: Updates internal caches and configuration
 *
 * This automatic validation helps catch configuration errors immediately rather than discovering them when users try to interact with the bot.
 *
 * ### Update Considerations
 *
 * **Credential Format**: The bot token must start with `xoxb-` and the signing secret should be a 32-character hexadecimal string. Invalid format results in validation errors.
 *
 * **OAuth Scopes**: If you update to a new bot token, ensure it has all required OAuth scopes. Missing scopes may cause the bot to work in some contexts but fail in others (e.g., working in DMs but not in channels).
 *
 * ### Context Security
 *
 * Slack direct messages and slash commands are treated as private conversation
 * surfaces. This lets private, account-specific actions continue when a user
 * has connected the required credentials.
 *
 * Channels, private channels, group conversations, and threads are shared
 * surfaces. The bot can still answer there, but private user context is not
 * used for actions that require user-specific credentials. If an action needs a
 * user's private credentials, the user should continue in a direct message or
 * slash command flow.
 *
 * **Feature Dependencies**: Some features have dependencies:
 * - `attachments` requires the `files:read` OAuth scope
 * - `references` requires proper event subscription configuration
 * - `ratings` works independently but provides better UX when combined with references
 *
 * **Session Duration Limits**: The `sessionDuration` field accepts values from 0 to one month in milliseconds (2,592,000,000 ms). Values outside this range are rejected.
 *
 * **Visible Messages Range**: The `visibleMessages` parameter accepts values from 0 to 10. Values outside this range are rejected to prevent performance issues.
 *
 * ### Response
 *
 * ```json
 * {
 *   "id": "slack_xyz789"
 * }
 * ```
 *
 * The response confirms the integration ID was updated successfully. After a successful update, use the fetch endpoint to retrieve the complete updated configuration.
 *
 * **Warning:** Updating authentication credentials while the bot is actively handling conversations may cause temporary disruptions. Consider performing credential updates during low-traffic periods or notify users in advance when possible.
 *
 * **Note:** Changes to feature flags (`attachments`, `references`, `ratings`) take effect immediately. Users will see new buttons and features in subsequent bot responses, but existing messages remain unchanged.
 */
