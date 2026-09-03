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

  phoneNumberId: schema.string().allow(null, ''),
  accessToken: schema.string().allow(null, ''),
  appSecret: schema.string().allow(null, ''),

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
 * /integration/whatsapp/{whatsappIntegrationId}/update:
 *   post:
 *     operationId: updateWhatsAppIntegration
 *     summary: Update a WhatsApp integration
 *     tags:
 *       - WhatsApp Integration
 *     parameters:
 *       - in: path
 *         name: whatsappIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the WhatsApp integration
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
 *                   phoneNumberId:
 *                     description: The WhatsApp integration phone number ID
 *                     type: string
 *                     nullable: true
 *                   accessToken:
 *                     description: The WhatsApp integration access token
 *                     type: string
 *                     nullable: true
 *                   appSecret:
 *                     description: The Meta app secret used to validate webhook signatures
 *                     type: string
 *                     nullable: true
 *                   contactCollection:
 *                     description: Weather to collect contacts
 *                     type: boolean
 *                   sessionDuration:
 *                     description: The session duration (in milliseconds)
 *                     type: number
 *                     nullable: true
 *                   attachments:
 *                     description: Weather the bot supports attachments
 *                     type: boolean
 *                   allowFrom:
 *                     description: Newline-or-comma-separated list of allowed senders. Use E.164 phone numbers with or without the leading `+`. Set to `*` to allow all. Leave empty to deny all.
 *                     type: string
 *                     nullable: true
 *     responses:
 *       200:
 *         description: The WhatsApp integration was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the WhatsApp Integration
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

        phoneNumberId,
        accessToken,
        appSecret,

        contactCollection,

        sessionDuration,

        attachments,

        allowFrom,

        meta,
      } = body

      if (accessToken === '********') {
        accessToken = undefined
      }

      if (appSecret === '********') {
        appSecret = undefined
      }

      const whatsappIntegration =
        await prisma.whatsappIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'whatsappIntegrationId')
        )

      if (!whatsappIntegration) {
        return notFound()
      }

      if (whatsappIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.whatsappIntegration.update({
        where: {
          id: whatsappIntegration.id,
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

          phoneNumberId,
          accessToken,
          appSecret,

          contactCollection,

          sessionDuration,

          attachments,

          allowFrom,

          // meta and others

          meta: getMeta(meta, whatsappIntegration.meta),
        },
      })

      return ok({ id: whatsappIntegration.id })
    })
  )
)

/**
 * @manual WhatsApp Integration
 *
 * ## Updating Integration Configuration
 *
 * Modify the configuration of an existing WhatsApp integration to adjust
 * settings, update credentials, or change linked resources. This endpoint
 * allows you to fine-tune integration behavior and keep credentials current
 * without recreating the integration.
 *
 * The update operation supports modifying all configurable integration
 * properties while preserving the integration ID and verify token. This
 * is particularly useful for updating Meta access tokens when they expire
 * or need to be rotated for security purposes:
 *
 * ```http
 * POST /api/v1/integration/whatsapp/{whatsappIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Customer Support Bot",
 *   "phoneNumberId": "1234567890",
 *   "accessToken": "EAAa...new_token",
 *   "contactCollection": true,
 *   "sessionDuration": 7200000,
 *   "attachments": true
 * }
 * ```
 *
 * ### Updatable Configuration
 *
 * **Basic Information**: Modify the integration name and description to
 * reflect changes in purpose or organizational structure. These fields are
 * for display purposes and don't affect operational behavior.
 *
 * **WhatsApp Credentials**: Update the Phone Number ID if you migrate to
 * a different WhatsApp Business phone number. The access token should be
 * updated when rotating credentials or when token permissions change.
 *
 * **Feature Toggles**: Enable or disable contact collection, file attachments,
 * and other optional features based on your use case and privacy requirements.
 *
 * **Session Management**: Adjust session duration to control how long the
 * system treats incoming messages as part of an ongoing conversation. Longer
 * durations maintain context better but may not be suitable for all use cases.
 *
 * **Resource Linking**: Change the associated bot or blueprint to modify
 * the conversational behavior and capabilities of the integration.
 *
 * ### Important Considerations
 *
 * **Verify Token Immutability**: The verify token cannot be changed after
 * integration creation. If you need a different verify token, you must
 * create a new integration and reconfigure your Meta webhooks.
 *
 * **Access Token Rotation**: When updating the access token, ensure the
 * new token has the required permissions (`whatsapp_business_messaging`
 * and `whatsapp_business_management`). Invalid tokens will cause message
 * delivery failures.
 *
 * **Phone Number Changes**: If you update the Phone Number ID, you may
 * need to reconfigure webhooks in the Meta Developer Portal to ensure
 * messages are routed correctly.
 *
 * **Active Conversations**: Configuration changes take effect immediately
 * for new conversations but don't affect ongoing conversation sessions.
 *
 * **Metadata Preservation**: The metadata field uses merge semantics -
 * new metadata is merged with existing metadata rather than replacing it
 * entirely, allowing partial updates.
 *
 * ### Update Best Practices
 *
 * - **Test in Development**: Test configuration changes with test phone
 * numbers before applying to production integrations
 *
 * - **Monitor After Updates**: Watch event logs and message delivery after
 * updating credentials to ensure proper operation
 *
 * - **Document Changes**: Use the metadata field to track configuration
 * history and reasons for changes
 *
 * - **Secure Token Storage**: Never log or expose access tokens in client-side
 * code or error messages
 *
 * - **Incremental Updates**: Update one configuration aspect at a time to
 * simplify troubleshooting if issues arise
 */
