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
 * /integration/microsoftteams/create:
 *   post:
 *     operationId: createMicrosoftteamsIntegration
 *     summary: Create a Microsoft Teams integration
 *     tags:
 *       - Microsoft Teams Integration
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
 *         description: The Microsoft Teams integration was created successfully
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
  withSessionLimits(
    ['database/integration'],
    withSchema(bodySchema, async function (_req, session, body) {
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

      const { id } = await prisma.microsoftteamsIntegration.create({
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

          botFrameworkAppId,
          botFrameworkAppSecret,
          tenantId,

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
 * @manual Microsoft Teams Integration
 * @description The Microsoft Teams integration enables you to connect ChatBotKit with
 *   Microsoft Teams, allowing conversational AI bots to interact with users
 *   through Teams channels, group chats, and direct messages.
 * @category Integrations
 * @tags teams, integration, messaging, microsoft, bot-framework
 * @index 1
 *
 * The Microsoft Teams integration allows you to bring ChatBotKit's conversational AI
 * capabilities directly into Microsoft Teams workspaces. Users can interact
 * with your AI bot through channels, group chats, and direct messages
 * without leaving their Teams environment.
 *
 * ## Prerequisites
 *
 * Before creating a Microsoft Teams integration, ensure you have the following from
 * the Microsoft Azure portal:
 *
 * 1. A Microsoft Azure account with a registered Bot Framework resource
 * 2. A **Bot Framework App ID** - the Application (client) ID shown in your
 *    Azure Bot Service resource under Configuration
 * 3. A **Bot Framework App Secret** - a client secret generated under
 *    Certificates & Secrets in your Azure App registration
 * 4. Your **Tenant ID** - the Azure AD directory ID; leave blank to allow
 *    multi-tenant bots that work across any Microsoft 365 organization
 *
 * ## Creating a Microsoft Teams Integration
 *
 * To create a Microsoft Teams integration, send a POST request with your Bot Framework
 * credentials and a reference to the ChatBotKit bot that should handle
 * conversations:
 *
 * ```http
 * POST /api/v1/integration/microsoftteams/create
 * Content-Type: application/json
 *
 * {
 *   "name": "My Teams Bot",
 *   "botId": "bot_abc123",
 *   "botFrameworkAppId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
 *   "botFrameworkAppSecret": "your-app-secret",
 *   "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
 *   "sessionDuration": 86400000,
 *   "contactCollection": true
 * }
 * ```
 *
 * The response returns the ID of the newly created integration:
 *
 * ```json
 * { "id": "teams_integration_xyz789" }
 * ```
 *
 * ## Integration Fields
 *
 * | Field | Type | Description |
 * |-------|------|-------------|
 * | `name` | string | A human-readable label for this integration |
 * | `description` | string | Optional notes about this integration's purpose |
 * | `blueprintId` | string | Link to a ChatBotKit Blueprint for managed configuration |
 * | `botId` | string | The ChatBotKit bot that handles conversations (required) |
 * | `botFrameworkAppId` | string | Application (client) ID from Azure Bot Service |
 * | `botFrameworkAppSecret` | string | Client secret from Azure App registration |
 * | `tenantId` | string | Azure AD tenant ID; omit for multi-tenant support |
 * | `sessionDuration` | number | Conversation context window in milliseconds (default 86400000 = 1 day) |
 * | `contactCollection` | boolean | When `true`, creates Contact records for users who interact with the bot |
 * | `allowFrom` | string | Restrict which users can interact with the bot (optional) |
 * | `meta` | object | Custom key-value metadata attached to this integration |
 *
 * ## After Creating the Integration
 *
 * Once you have an integration ID, complete the setup in Azure Bot Service:
 *
 * 1. Copy your integration's callback URL from the ChatBotKit dashboard
 * 2. In Azure Bot Service, set the **Messaging Endpoint** to this callback URL
 * 3. Enable the **Microsoft Teams** channel in Azure Bot Service
 * 4. Call the setup endpoint to validate your credentials (see below)
 *
 * **Note:** Credentials are stored securely and the App Secret is never
 * returned in list or fetch responses to protect sensitive information.
 */
