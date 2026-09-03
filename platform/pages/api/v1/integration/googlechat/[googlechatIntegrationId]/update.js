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

import { sendEvent } from '@/pages/api/v1/integration/googlechat/[googlechatIntegrationId]/queue'

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
 * /integration/googlechat/{googlechatIntegrationId}/update:
 *   post:
 *     operationId: updateGooglechatIntegration
 *     summary: Update a Google Chat integration
 *     tags:
 *       - Google Chat Integration
 *     parameters:
 *       - in: path
 *         name: googlechatIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Google Chat integration
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
 *                   serviceAccountKey:
 *                     description: The Google service account JSON key for sending messages
 *                     type: string
 *                   projectNumber:
 *                     description: The Google Cloud project number for JWT verification
 *                     type: string
 *                   contactCollection:
 *                     description: Whether to collect contacts
 *                     type: boolean
 *                   sessionDuration:
 *                     description: The session duration for the integration
 *                     type: number
 *                   attachments:
 *                     description: Whether file attachment processing is enabled
 *                     type: boolean
 *                   autoRespond:
 *                     description: The auto-respond configuration
 *                     type: string
 *                   allowFrom:
 *                     description: The allowed senders for this integration
 *                     type: string
 *     responses:
 *       200:
 *         description: The Google Chat integration was updated successfully
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
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
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

      const googlechatIntegration =
        await prisma.googlechatIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'googlechatIntegrationId')
        )

      if (!googlechatIntegration) {
        return notFound()
      }

      if (googlechatIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.googlechatIntegration.update({
        where: {
          id: googlechatIntegration.id,
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

          serviceAccountKey,

          projectNumber,

          contactCollection,

          sessionDuration,

          attachments,

          autoRespond,

          allowFrom,

          // meta and others

          meta: getMeta(meta, googlechatIntegration.meta),
        },
      })

      await sendEvent(googlechatIntegration.id, {
        type: 'setup',
        payload: {},
      })

      return ok({ id: googlechatIntegration.id })
    })
  )
)

/**
 * @manual Google Chat Integration
 * @index 20
 *
 * ## Updating a Google Chat Integration
 *
 * Modify the configuration of an existing Google Chat integration. All fields
 * are optional - only send the fields you want to change. The integration
 * continues to handle messages without interruption while the update is applied.
 * After a successful update, a setup validation event is automatically
 * triggered to verify the new configuration.
 *
 * ```http
 * POST /api/v1/integration/googlechat/{googlechatIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Bot Name",
 *   "botId": "bot_xyz789",
 *   "contactCollection": true,
 *   "attachments": true,
 *   "sessionDuration": 3600000
 * }
 * ```
 *
 * ### Updatable Fields
 *
 * - **name** (string): Human-readable label for the integration
 * - **description** (string): Description of the integration's purpose
 * - **blueprintId** (string): Associate the integration with a blueprint resource
 * - **botId** (string): Change the bot that handles incoming Google Chat messages
 * - **serviceAccountKey** (string or null): Google Cloud service account key JSON.
 *   Send `"********"` to preserve the existing key, or send a new JSON string to
 *   replace it. Set to `null` to clear the credential.
 * - **projectNumber** (string or null): Google Cloud project number used for
 *   request verification. This is the numeric project identifier (typically 12
 *   digits), distinct from the human-readable project ID. You can find it on the
 *   Chat API Configuration page under
 *   "Application info" as "Project number (App ID)", on the Google Cloud
 *   Console home dashboard under "Project info", in the project picker
 *   drop-down, or via `gcloud projects describe YOUR_PROJECT_ID
 *   --format="value(projectNumber)"`.
 * - **contactCollection** (boolean): Enable or disable contact collection for
 *   direct message conversations. Shared spaces and group conversations are not
 *   associated with contacts.
 * - **sessionDuration** (number or null): Session timeout in milliseconds. Set to
 *   `null` for unlimited sessions. Maximum is one month.
 * - **attachments** (boolean): Enable or disable uploaded file processing.
 *   Uploaded Google Chat files are stored as conversation attachments when this
 *   is enabled. Google Drive-backed attachments are skipped.
 * - **autoRespond** (string or null): Reserved auto-respond behavior setting.
 *   Google Chat interaction webhooks only deliver direct messages and explicit
 *   app interactions in spaces, such as @mentions; they don't deliver every
 *   message posted in a space.
 * - **allowFrom** (string or null): Restrict which sender types receive bot responses
 * - **meta** (object): Custom metadata key-value pairs attached to the integration
 *
 * ### Setup Validation
 *
 * After each update, the system automatically validates the setup for the
 * integration. This ensures that credential or configuration changes are
 * applied and verified without requiring a manual re-setup step.
 *
 * ### Example: Updating Credentials
 *
 * To rotate the service account key while keeping other settings unchanged:
 *
 * ```http
 * POST /api/v1/integration/googlechat/{googlechatIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "serviceAccountKey": "{\"type\":\"service_account\",\"project_id\":\"...\"}",
 *   "projectNumber": "123456789012"
 * }
 * ```
 *
 * The response returns the integration ID on success:
 *
 * ```json
 * { "id": "googlechat_abc123" }
 * ```
 */
