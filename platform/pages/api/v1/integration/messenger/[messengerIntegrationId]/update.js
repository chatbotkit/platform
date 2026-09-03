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

  accessToken: schema.string().allow(null, ''),
  appSecret: schema.string().allow(null, ''),

  contactCollection: schema.boolean(),

  sessionDuration: schema
    .number()
    .min(0)
    .max(ONE_MONTH_IN_MILLISECONDS)
    .allow(null),

  attachments: schema.boolean(),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/messenger/{messengerIntegrationId}/update:
 *   post:
 *     operationId: updateMessengerIntegration
 *     summary: Update a Messenger integration
 *     tags:
 *       - Messenger Integration
 *     parameters:
 *       - in: path
 *         name: messengerIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Messenger integration
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
 *                   accessToken:
 *                     description: The Messenger integration access token
 *                     type: string
 *                     nullable: true
 *                   appSecret:
 *                     description: The Meta app secret used to validate webhook signatures
 *                     type: string
 *                     nullable: true
 *                   contactCollection:
 *                     description: Whether to collect contacts
 *                     type: boolean
 *                   sessionDuration:
 *                     description: The session duration (in milliseconds)
 *                     type: number
 *                     nullable: true
 *                   attachments:
 *                     description: Whether the bot supports attachments
 *                     type: boolean
 *     responses:
 *       200:
 *         description: The Messenger integration was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Messenger Integration
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

        accessToken,

        appSecret,

        contactCollection,

        sessionDuration,

        attachments,

        meta,
      } = body

      if (accessToken === '********') {
        accessToken = undefined
      }

      if (appSecret === '********') {
        appSecret = undefined
      }

      const messengerIntegration =
        await prisma.messengerIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'messengerIntegrationId')
        )

      if (!messengerIntegration) {
        return notFound()
      }

      if (messengerIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.messengerIntegration.update({
        where: {
          id: messengerIntegration.id,
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

          accessToken,
          appSecret,

          contactCollection,

          sessionDuration,

          attachments,

          // meta and others

          meta: getMeta(meta, messengerIntegration.meta),
        },
      })

      return ok({ id: messengerIntegration.id })
    })
  )
)

/**
 * @manual Messenger Integration
 *
 * ## Updating Messenger Integrations
 *
 * Updating a Messenger integration allows you to modify configuration settings,
 * change the connected bot, rotate access tokens, adjust session durations, or
 * enable and disable features like attachment processing. This flexibility
 * ensures your integration can evolve as your requirements change without
 * needing to recreate the entire integration and reconfigure webhooks.
 *
 * Common update scenarios include switching to a different bot implementation
 * after testing and refinement, rotating Facebook Page Access Tokens for
 * security compliance, adjusting session timeout values based on user behavior
 * patterns, and enabling new features like attachment support after initial
 * deployment. Updates take effect immediately for new conversations, while
 * existing active conversations continue using their original configuration
 * until the session expires.
 *
 * When updating the access token, ensure the new token has the same permissions
 * as the original token (`pages_messaging`, `pages_manage_metadata`, and
 * `pages_read_engagement`). Token rotation is recommended every 60 days as a
 * security best practice. If you change the access token, you do not need to
 * reconfigure the webhook in Facebook's Developer Portal, as the webhook
 * verification uses the verify token which remains constant.
 *
 * ```http
 * POST /api/v1/integration/messenger/{messengerIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Customer Support Bot",
 *   "description": "Enhanced with new capabilities",
 *   "botId": "bot_xyz789",
 *   "sessionDuration": 172800000,
 *   "attachments": true,
 *   "contactCollection": true
 * }
 * ```
 *
 * The update operation supports partial updates, meaning you only need to
 * include the fields you want to change. Omitted fields retain their current
 * values. This allows you to make targeted adjustments without needing to
 * resend the entire configuration.
 *
 * **Important:** Changing the bot ID immediately affects all new conversations
 * but does not interrupt active conversations. Users with ongoing sessions
 * will continue interacting with the previous bot until their session expires
 * or they start a new conversation. Plan bot updates during low-traffic periods
 * or use staged rollouts for critical changes.
 *
 * **Metadata Updates:** The metadata field supports custom tags and properties
 * that can be used for organization, analytics, and filtering. Updates to
 * metadata are merged with existing values rather than replacing them entirely,
 * allowing you to add or modify specific properties without affecting others.
 */
