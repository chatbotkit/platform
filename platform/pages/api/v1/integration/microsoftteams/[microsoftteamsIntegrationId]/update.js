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

import { sendEvent } from '@/pages/api/v1/integration/microsoftteams/[microsoftteamsIntegrationId]/queue'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  botFrameworkAppId: schema.string().allow(null, ''),
  botFrameworkAppSecret: schema.string().allow(null, ''),
  tenantId: schema.string().allow(null, ''),

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
 * /integration/microsoftteams/{microsoftteamsIntegrationId}/update:
 *   post:
 *     operationId: updateMicrosoftteamsIntegration
 *     summary: Update a Microsoft Teams integration
 *     tags:
 *       - Microsoft Teams Integration
 *     parameters:
 *       - in: path
 *         name: microsoftteamsIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Microsoft Teams integration
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
 *                   botFrameworkAppId:
 *                     description: The Microsoft Bot Framework Application ID
 *                     type: string
 *                   botFrameworkAppSecret:
 *                     description: The Microsoft Bot Framework Application Secret
 *                     type: string
 *                   tenantId:
 *                     description: The Microsoft Entra tenant ID
 *                     type: string
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
 *                     description: The allowed senders for this integration
 *                     type: string
 *     responses:
 *       200:
 *         description: The Microsoft Teams integration was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Microsoft Teams integration
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

        botFrameworkAppId,
        botFrameworkAppSecret,
        tenantId,

        contactCollection,

        sessionDuration,

        attachments,

        allowFrom,

        meta,
      } = body

      const microsoftteamsIntegration =
        await prisma.microsoftteamsIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'microsoftteamsIntegrationId')
        )

      if (!microsoftteamsIntegration) {
        return notFound()
      }

      if (microsoftteamsIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.microsoftteamsIntegration.update({
        where: {
          id: microsoftteamsIntegration.id,
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

          botFrameworkAppId,
          botFrameworkAppSecret,
          tenantId,

          contactCollection,

          sessionDuration,

          attachments,

          allowFrom,

          // meta and others

          meta: getMeta(meta, microsoftteamsIntegration.meta),
        },
      })

      await sendEvent(microsoftteamsIntegration.id, {
        type: 'setup',
        payload: {},
      })

      return ok({ id: microsoftteamsIntegration.id })
    })
  )
)

/**
 * @manual Microsoft Teams Integration
 * @index 20
 *
 * ## Updating a Microsoft Teams Integration
 *
 * Update the configuration of an existing Microsoft Teams integration. Send a POST
 * request with only the fields you want to change - all fields are optional.
 * Only the fields you provide will be modified; all others remain unchanged.
 *
 * ```http
 * POST /api/v1/integration/microsoftteams/{microsoftteamsIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Teams Bot",
 *   "botFrameworkAppId": "your-app-id",
 *   "botFrameworkAppSecret": "your-app-secret",
 *   "attachments": true
 * }
 * ```
 *
 * ## Updatable Fields
 *
 * | Field | Type | Description |
 * |-------|------|-------------|
 * | `name` | string | A human-readable label for this integration |
 * | `description` | string | Optional notes about this integration's purpose |
 * | `blueprintId` | string | Link to a ChatBotKit Blueprint for managed configuration |
 * | `botId` | string | The ChatBotKit bot that handles conversations |
 * | `botFrameworkAppId` | string | Application (client) ID from Azure Bot Service |
 * | `botFrameworkAppSecret` | string | Client secret from Azure App registration |
 * | `tenantId` | string | Azure AD tenant ID; set to `null` to allow multi-tenant access |
 * | `sessionDuration` | number | Conversation context window in milliseconds (max one month) |
 * | `contactCollection` | boolean | When `true`, creates Contact records for users who interact with the bot |
 * | `attachments` | boolean | When `true`, enables attachment handling for files sent in Teams messages |
 * | `allowFrom` | string | Restrict which users can interact with the bot; set to `null` to allow all |
 * | `meta` | object | Custom key-value metadata - merged with existing metadata rather than replaced |
 *
 * ## After Updating
 *
 * A setup event is automatically triggered after every successful update to
 * validate the Bot Framework credentials. If the `botFrameworkAppId` or
 * `botFrameworkAppSecret` has changed, the validation will verify the new
 * credentials against the Microsoft Bot Framework.
 *
 * The response returns the integration ID on success:
 *
 * ```json
 * { "id": "teams_integration_abc123" }
 * ```
 *
 * **Note:** To rotate credentials securely, update `botFrameworkAppSecret`
 * and `botFrameworkAppId` together in a single request to avoid a window
 * where mismatched credentials could cause validation failures.
 */
