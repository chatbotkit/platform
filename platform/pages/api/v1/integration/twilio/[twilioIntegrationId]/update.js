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
import structstrSchema from '@/schemas/structstr'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  accountSid: schema.string().allow(null, ''),

  authToken: schema.string().allow(null, ''),

  voice: structstrSchema,

  contactCollection: schema.boolean(),

  sessionDuration: schema
    .number()
    .min(0)
    .max(ONE_MONTH_IN_MILLISECONDS)
    .allow(null),

  allowFrom: schema.string().allow(null, ''),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/twilio/{twilioIntegrationId}/update:
 *   post:
 *     operationId: updateTwilioIntegration
 *     summary: Update a Twilio integration
 *     tags:
 *       - Twilio Integration
 *     parameters:
 *       - in: path
 *         name: twilioIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Twilio integration
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
 *                   accountSid:
 *                     description: The Twilio account SID
 *                     type: string
 *                   authToken:
 *                     description: The Twilio auth token
 *                     type: string
 *                   voice:
 *                     description: The voice configuration structured string
 *                     type: string
 *                   contactCollection:
 *                     description: Weather to collect contacts
 *                     type: boolean
 *                   sessionDuration:
 *                     description: The session duration (in milliseconds)
 *                     type: number
 *                   allowFrom:
 *                     description: Newline-or-comma-separated list of allowed senders. Use E.164 phone numbers with or without the leading `+`. Set to `*` to allow all. Leave empty to deny all.
 *                     type: string
 *     responses:
 *       200:
 *         description: The Twilio integration was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Twilio Integration
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

        accountSid,

        authToken,

        voice,

        contactCollection,

        sessionDuration,

        allowFrom,

        meta,
      } = body

      const twilioIntegration =
        await prisma.twilioIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'twilioIntegrationId')
        )

      if (!twilioIntegration) {
        return notFound()
      }

      if (twilioIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.twilioIntegration.update({
        where: {
          id: twilioIntegration.id,
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

          accountSid,

          authToken,

          voice,

          contactCollection,

          sessionDuration,

          allowFrom,

          // meta and others

          meta: getMeta(meta, twilioIntegration.meta),
        },
      })

      return ok({ id: twilioIntegration.id })
    })
  )
)

/**
 * @manual Twilio Integration
 *
 * ## Updating Twilio Integrations
 *
 * Modify an existing Twilio integration's configuration to change which bot handles
 * conversations, adjust session management settings, or update organizational
 * information. Updates take effect immediately and apply to all subsequent SMS
 * interactions through the integration.
 *
 * Update a Twilio integration by sending a POST request with the new configuration:
 *
 * ```http
 * POST /api/v1/integration/twilio/{twilioIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Customer Support SMS",
 *   "description": "Updated description with new details",
 *   "botId": "bot_new789",
 *   "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
 *   "authToken": "your_new_twilio_auth_token",
 *   "voice": "twilio/language=en-GB/voice=Polly.Emma",
 *   "sessionDuration": 3600000,
 *   "contactCollection": true,
 *   "allowFrom": "+12025551234,+447911123456"
 * }
 * ```
 *
 * The API confirms the update by returning the integration ID:
 *
 * ```json
 * {
 *   "id": "twilio_abc123"
 * }
 * ```
 *
 * ### Updatable Parameters
 *
 * **name and description**: Update identification and documentation for the
 * integration. Changes are immediately visible in the ChatBotKit interface and
 * API responses.
 *
 * **botId**: Switch which bot handles SMS conversations through this integration.
 * This is useful when you want to change bot behavior, deploy a new bot version,
 * or redirect traffic to a different conversational experience. The change takes
 * effect immediately for new conversations.
 *
 * **accountSid**: Update the Twilio Account SID used for outbound API replies.
 * This should match the Twilio account that owns the phone number receiving
 * inbound messages.
 *
 * **authToken**: Update or rotate the Twilio Auth Token used with `accountSid`.
 * This credential is sensitive and is needed when ChatBotKit sends a delayed SMS
 * reply through the Twilio REST API after the webhook response window has passed.
 *
 * **voice**: Update the optional structured voice configuration used for call
 * responses, such as `twilio/language=en-GB/voice=Polly.Emma`. Leave it empty to
 * use Twilio's default speech settings.
 *
 * **sessionDuration**: Adjust how long conversation context persists between
 * messages. Increasing the duration helps maintain context for users who take
 * longer breaks between messages. Decreasing it causes conversations to reset
 * more quickly, which may be appropriate for transactional interactions.
 *
 * **contactCollection**: Enable or disable automatic contact record creation for
 * SMS interactions. Enabling this feature allows you to track conversation history
 * and user engagement patterns.
 *
 * **allowFrom**: Restrict inbound SMS messages and calls to specific phone
 * numbers. Use newline- or comma-separated E.164 phone numbers, with or without
 * the leading `+`. Set it to `*` to allow everyone, or leave it empty to block
 * all inbound senders.
 *
 * **blueprintId**: Associate the integration with a different blueprint, or remove
 * the blueprint association by setting it to null. This affects how the integration
 * is organized and managed within your account.
 *
 * **meta**: Add or modify custom metadata fields for categorization, filtering,
 * and management purposes.
 *
 * ### Update Behavior
 *
 * **Immediate Effect**: Configuration changes apply immediately to new conversations
 * and messages. Users who send messages after the update will experience the new
 * configuration.
 *
 * **Active Conversations**: Ongoing conversations continue using the configuration
 * that was active when they started. Session context and conversation state are
 * not affected by updates during an active session.
 *
 * **Webhook Configuration**: Updates to your ChatBotKit integration don't require
 * changes to your Twilio webhook configuration. The webhook URL and authentication
 * remain the same.
 *
 * ### Common Update Scenarios
 *
 * **Bot Deployment**: Update the botId to deploy a new or improved version of
 * your conversational bot to the SMS channel.
 *
 * **Session Tuning**: Adjust sessionDuration based on observed user behavior and
 * conversation patterns to optimize context retention.
 *
 * **Feature Enablement**: Enable contactCollection after initial deployment to
 * begin tracking user engagement and conversation history.
 *
 * **Organizational Changes**: Update blueprintId when reorganizing resources or
 * changing how integrations are grouped for management purposes.
 *
 * **Documentation Updates**: Modify name and description to reflect current usage,
 * purpose, or any operational changes to the service.
 *
 * ### Best Practices
 *
 * **Test Before Production**: When changing botId, test the new bot thoroughly
 * before updating production integrations to ensure conversation quality.
 *
 * **Monitor After Changes**: After updating critical configuration like botId or
 * sessionDuration, monitor conversation metrics to verify the changes have the
 * desired effect.
 *
 * **Document Changes**: Use metadata or external documentation to track why
 * configuration was changed, when, and by whom for audit and troubleshooting
 * purposes.
 *
 * **Incremental Updates**: When making multiple changes, consider updating one
 * parameter at a time to isolate the impact of each change and make troubleshooting
 * easier if issues arise.
 */
