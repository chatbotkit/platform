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

  serviceAccountKey: schema.string().allow(null, ''),

  projectNumber: schema.string().allow(null, ''),

  contactCollection: schema.boolean(),

  sessionDuration: schema
    .number()
    .min(0)
    .max(ONE_MONTH_IN_MILLISECONDS)
    .allow(null),

  attachments: schema.boolean(),

  autoRespond: schema.string().allow(null, ''),

  allowFrom: schema.string().allow(null, ''),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/googlechat/create:
 *   post:
 *     operationId: createGooglechatIntegration
 *     summary: Create Google Chat integration
 *     tags:
 *       - Google Chat Integration
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
 *                   serviceAccountKey:
 *                     description: The Google service account JSON key for sending messages via the Chat REST API
 *                     type: string
 *                   projectNumber:
 *                     description: The Google Cloud project number used to verify incoming event JWT audience claims
 *                     type: string
 *                   contactCollection:
 *                     description: Whether to collect contacts
 *                     type: boolean
 *                   sessionDuration:
 *                     description: The session duration for the Google Chat integration
 *                     type: number
 *                   attachments:
 *                     description: Whether file attachment processing is enabled
 *                     type: boolean
 *                   autoRespond:
 *                     description: Configure automatic response behavior. Use '@all' to respond to all messages, '@agent <instructions>' for agent-powered decisions, or custom instructions for lightweight LLM filtering. Null/empty defaults to DMs and direct messages only.
 *                     type: string
 *                   allowFrom:
 *                     description: Restrict which Google Chat users can interact with this integration. Accepts user resource names (users/USER_ID) or * to allow all. One per line.
 *                     type: string
 *     responses:
 *       200:
 *         description: The Google Chat integration was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Google Chat Integration
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

        serviceAccountKey,

        projectNumber,

        contactCollection,

        sessionDuration,

        attachments,

        autoRespond,

        allowFrom,

        meta,
      } = body

      if (serviceAccountKey === '********') {
        serviceAccountKey = undefined
      }

      const { id } = await prisma.googlechatIntegration.create({
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

          serviceAccountKey,

          projectNumber,

          contactCollection,

          sessionDuration,

          attachments,

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
 * @manual Google Chat Integration
 * @description Integrate ChatBotKit with Google Chat to deploy intelligent AI agents directly within Google Workspace spaces, enabling seamless collaboration through direct messages and space conversations.
 * @category Integrations
 * @tags googlechat, integration, webhook, bot
 * @index 1
 *
 * ChatBotKit's Google Chat integration enables you to deploy AI agents
 * directly within Google Chat spaces and direct messages, allowing teams to
 * interact with intelligent assistants through natural conversations.
 *
 * ## Creating a Google Chat Integration
 *
 * Before creating the integration, you need a Google Cloud project with the
 * Google Chat API enabled and a service account in that same project. The
 * Google Chat API is enabled via APIs & Services → Library in the Google
 * Cloud Console (search "Google Chat API" → Enable) - it does not appear
 * elsewhere in the console until that step is done. The service account
 * itself does not need an IAM role: it is recognised as your Chat app
 * because it lives in the same project as the Chat API configuration.
 *
 * To create the integration, send a POST request with your Google Cloud
 * credentials:
 *
 * ```http
 * POST /api/v1/integration/googlechat/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Google Chat Bot",
 *   "description": "AI assistant for our workspace",
 *   "botId": "bot_abc123",
 *   "serviceAccountKey": "{...service account JSON string...}",
 *   "projectNumber": "123456789"
 * }
 * ```
 *
 * The response includes the integration ID needed for the next step:
 *
 * ```json
 * { "id": "googlechat_abc123..." }
 * ```
 *
 * ### Webhook Configuration
 *
 * After creating the integration, configure this URL as the HTTP endpoint in
 * your Google Cloud Console under APIs & Services → Enabled APIs & services
 * → Google Chat API → Configuration → Connection settings:
 *
 * ```
 * https://api.chatbotkit.com/v1/integration/googlechat/{googlechatIntegrationId}/event
 * ```
 *
 * Replace `{googlechatIntegrationId}` with the ID returned from this endpoint.
 *
 * To use the bot in a Google Chat space or group conversation, you must also
 * add the Chat app to that specific space in Google Chat. Open the space, use
 * "Manage members" or "Add people & apps", search for the app by its App name,
 * and add it. The Google Cloud "Join spaces and group conversations" setting
 * only makes the app eligible to join spaces; it does not automatically install
 * the app into existing spaces.
 */
