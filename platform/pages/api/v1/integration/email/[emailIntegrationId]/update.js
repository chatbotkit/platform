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
 * /integration/email/{emailIntegrationId}/update:
 *   post:
 *     operationId: updateEmailIntegration
 *     summary: Update a Email integration
 *     tags:
 *       - Email Integration
 *     parameters:
 *       - in: path
 *         name: emailIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Email integration
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
 *         description: The Email integration was updated successfully
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
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
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

      const emailIntegration =
        await prisma.emailIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'emailIntegrationId')
        )

      if (!emailIntegration) {
        return notFound()
      }

      if (emailIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.emailIntegration.update({
        where: {
          id: emailIntegration.id,
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

          contactCollection,

          sessionDuration,

          attachments,

          allowFrom,

          // meta and others

          meta: getMeta(meta, emailIntegration.meta),
        },
      })

      return ok({ id: emailIntegration.id })
    })
  )
)

/**
 * @manual Email Integration
 *
 * ## Updating an Email Integration
 *
 * Modify the configuration of an existing Email Integration to adjust bot
 * behavior, session management, feature enablement, or resource linkage. Updates
 * take effect immediately for new incoming emails while preserving the
 * integration's unique inbox address and maintaining existing conversation
 * history and contact records.
 *
 * Updating email integrations is essential for evolving your email automation
 * strategy. Common update scenarios include switching to an improved bot version,
 * enabling contact collection for lead generation, adjusting session duration
 * for better conversation continuity, enabling attachment processing, or linking
 * to updated blueprints with enhanced datasets and skillsets.
 *
 * ```http
 * POST /api/v1/integration/email/{emailIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Enhanced Support Inbox",
 *   "description": "Customer support with attachment analysis",
 *   "botId": "bot_improved123",
 *   "contactCollection": true,
 *   "sessionDuration": 7200000,
 *   "attachments": true
 * }
 * ```
 *
 * ### Configuration Parameter Details
 *
 * **Bot Replacement**: Changing the `botId` redirects all future email conversations
 * to a different bot. This is particularly useful when deploying improved bot
 * versions with better response quality, updated knowledge bases, or specialized
 * handling capabilities. Historical conversations remain accessible under the
 * original bot but new emails will be processed by the updated bot configuration.
 *
 * **Contact Collection**: Enabling `contactCollection` instructs the integration
 * to automatically capture and store contact information from email senders. The
 * system extracts email addresses, names when available, and associates them
 * with conversation history. This builds a valuable contact database for
 * marketing, support follow-ups, and relationship management. Disabling this
 * feature maintains privacy but foregoes contact tracking benefits.
 *
 * **Session Duration Management**: The `sessionDuration` parameter (measured in
 * milliseconds) determines how long the bot remembers context between emails
 * from the same sender. Longer durations enable multi-email conversations where
 * the bot recalls previous exchanges, creating more natural, contextual
 * interactions. For example, setting 7200000 (2 hours) means emails within a
 * 2-hour window share conversation context. Shorter durations treat each email
 * more independently, suitable for one-off inquiries.
 *
 * **Attachment Processing**: Enabling `attachments` allows your bot to receive,
 * access, and process email attachments. The bot can analyze document contents,
 * extract information from files, or provide context-aware responses based on
 * attachment data. This is valuable for support scenarios involving screenshots,
 * documents, or data files. Disable this if attachments aren't needed to improve
 * processing speed and reduce resource usage.
 *
 * **Sender Filtering (allowFrom)**: Update `allowFrom` to control which email senders can reach
 * your integration. Provide a newline-separated list of email address patterns. When
 * left empty, all incoming emails are denied. Use `*` to allow all senders, specific
 * addresses like `user@example.com`, or domain patterns like `@example.com` to match
 * all addresses from a domain.
 *
 * **Blueprint Switching**: Updating `blueprintId` applies a different set of
 * pre-configured resources to your email integration. Blueprints bundle datasets,
 * skillsets, abilities, and configuration into reusable templates. Switching
 * blueprints enables rapid deployment of enhanced capabilities or standardized
 * configurations across multiple email integrations simultaneously.
 *
 * ### Update Strategy Recommendations
 *
 * **Incremental Changes**: When making significant configuration changes,
 * consider updating one parameter at a time to isolate any unexpected behavior
 * and simplify troubleshooting. Test each change with sample emails before
 * proceeding to the next update.
 *
 * **Notification Management**: If your email integration sends automated
 * responses, inform your users or team when significant changes are deployed,
 * especially when switching bots or modifying response behavior patterns.
 *
 * **Testing Protocol**: After updates, send test emails covering various
 * scenarios to verify the integration behaves as expected. Pay special attention
 * to context retention when modifying session duration and attachment handling
 * when enabling that feature.
 *
 * **Monitoring Conversations**: Review the Conversations tab after deploying
 * updates to ensure emails are being processed correctly and responses meet
 * quality expectations. Look for any errors or unexpected behavior patterns
 * that might indicate configuration issues.
 *
 * **Important Note**: The integration's unique inbox email address never changes,
 * regardless of configuration updates. This ensures external systems and users
 * can continue sending emails to the same address without disruption, even as
 * the underlying bot and behavior evolve.
 */
