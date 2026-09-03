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
 * /integration/telegram/{telegramIntegrationId}/update:
 *   post:
 *     operationId: updateTelegramIntegration
 *     summary: Update a Telegram integration
 *     tags:
 *       - Telegram Integration
 *     parameters:
 *       - in: path
 *         name: telegramIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Telegram integration
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
 *         description: The Telegram integration was updated successfully
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
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
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

      const telegramIntegration =
        await prisma.telegramIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'telegramIntegrationId')
        )

      if (!telegramIntegration) {
        return notFound()
      }

      if (telegramIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.telegramIntegration.update({
        where: {
          id: telegramIntegration.id,
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

          botToken,

          contactCollection,

          sessionDuration,

          attachments,

          allowFrom,

          // meta and others

          meta: getMeta(meta, telegramIntegration.meta),
        },
      })

      return ok({ id: telegramIntegration.id })
    })
  )
)

/**
 * @manual Telegram Integration
 *
 * ## Updating a Telegram Integration
 *
 * Modify the configuration of an existing Telegram integration to adjust settings,
 * change the connected bot, or update operational parameters. Updates are applied
 * immediately and affect how your integration processes incoming messages.
 *
 * To update a Telegram integration, send a POST request with the updated configuration:
 *
 * ```http
 * POST /api/v1/integration/telegram/{telegramIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Support Bot",
 *   "contactCollection": false,
 *   "sessionDuration": 7200000,
 *   "attachments": true
 * }
 * ```
 *
 * You can update any of the configuration options available during creation,
 * including the bot token if you need to reconnect to a different Telegram bot.
 *
 * ### Updatable Fields
 *
 * - **name**: Change the display name for easier identification
 * - **description**: Update internal documentation
 * - **botId**: Switch to a different ChatBotKit bot
 * - **blueprintId**: Link or unlink from blueprints
 * - **botToken**: Replace with a new Telegram bot token
 * - **contactCollection**: Enable or disable contact collection
 * - **sessionDuration**: Adjust session timeout (milliseconds, max 30 days)
 * - **attachments**: Toggle file attachment support
 * - **meta**: Update custom metadata
 *
 * ### Partial Updates
 *
 * You only need to include the fields you want to change. Omitted fields will
 * retain their current values. This allows for efficient partial updates without
 * needing to send the entire configuration.
 *
 * ### Important Considerations
 *
 * **Bot Token Changes**: If you update the bot token, you must run the setup
 * endpoint again to reconfigure the webhook with Telegram. The old webhook
 * configuration will no longer be valid with the new token.
 *
 * **Session Duration**: Changing session duration only affects new conversations.
 * Existing sessions will continue with their original timeout settings until
 * they expire naturally.
 *
 * **Contact Collection**: Enabling contact collection on an existing integration
 * will only apply to new conversations. Historical conversations are not affected.
 *
 * After updating critical settings like the bot token, remember to call the
 * setup endpoint to ensure the webhook is properly configured with Telegram's
 * servers. Without this step, your integration may stop receiving messages.
 */
