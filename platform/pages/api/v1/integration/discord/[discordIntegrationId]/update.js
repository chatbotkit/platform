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

import { sendEvent } from '@/pages/api/v1/integration/discord/[discordIntegrationId]/queue'

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
 * /integration/discord/{discordIntegrationId}/update:
 *   post:
 *     operationId: updateDiscordIntegration
 *     summary: Update a Discord integration
 *     tags:
 *       - Discord Integration
 *     parameters:
 *       - in: path
 *         name: discordIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Discord integration
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
 *         description: The Discord integration was updated successfully
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
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
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

      const discordIntegration =
        await prisma.discordIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'discordIntegrationId')
        )

      if (!discordIntegration) {
        return notFound()
      }

      if (discordIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.discordIntegration.update({
        where: {
          id: discordIntegration.id,
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

          meta: getMeta(meta, discordIntegration.meta),
        },
      })

      await sendEvent(discordIntegration.id, {
        type: 'setup',
        payload: {},
      })

      return ok({ id: discordIntegration.id })
    })
  )
)

/**
 * @manual Discord Integration
 * @index 20
 *
 * ## Updating a Discord Integration
 *
 * Updating a Discord integration allows you to modify configuration settings,
 * change bot credentials, adjust behavior options, or update the associated bot
 * after the initial integration setup. This is particularly useful when rotating
 * security credentials, changing slash command handles, or adjusting conversation
 * settings based on usage patterns and requirements.
 *
 * When you update an integration, the system automatically triggers a re-setup
 * process to ensure Discord commands are synchronized with your new configuration.
 * This means any changes to the handle parameter will result in the slash command
 * being updated in Discord immediately, though users may need to restart their
 * Discord clients to see the updated commands.
 *
 * ```http
 * POST /api/v1/integration/discord/{discordIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Support Bot",
 *   "description": "Enhanced customer support bot with new features",
 *   "handle": "help",
 *   "ephemeral": true,
 *   "sessionDuration": 7200000
 * }
 * ```
 *
 * All parameters from the create endpoint are supported in updates. You can modify
 * basic information like name and description, update security credentials including
 * appId, botToken, and publicKey, change the slash command handle, adjust behavior
 * settings like ephemeral messages, update session management options including
 * sessionDuration and contactCollection, and configure sender restrictions via
 * allowFrom.
 *
 * ## Important Update Considerations
 *
 * When updating Discord credentials (Application ID, Bot Token, or Public Key),
 * ensure the new credentials belong to the same Discord application. Changing to
 * a different application may cause webhook verification failures and require
 * reconfiguration of the Interactions Endpoint URL in Discord.
 *
 * Changing the handle parameter updates your bot's slash command in Discord. Users
 * will need to use the new command format (e.g., `/help` instead of `/support`).
 * Existing conversations are not affected, but new interactions must use the updated
 * command. Consider notifying your Discord community before changing handles to
 * avoid confusion.
 *
 * The `sessionDuration` parameter controls how long conversation context is maintained.
 * Decreasing this value won't immediately expire existing sessions but will apply to
 * new interactions. Increasing it allows longer contextual conversations but may
 * increase resource usage. The value is specified in milliseconds, with a maximum
 * of one month (2592000000 milliseconds).
 *
 * **Warning:** Updating sensitive credentials like Bot Token or Public Key while
 * the bot is actively handling conversations may cause temporary interruptions.
 * Consider updating during low-traffic periods or notify users of potential brief
 * disruptions. The system will automatically re-establish connections after updates.
 */
