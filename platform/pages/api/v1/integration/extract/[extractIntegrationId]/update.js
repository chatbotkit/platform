// @ts-check
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
import { propertiesJsonSchema as propertiesJsonSchemaSchema } from '@/schemas/jsonSchema'
import languageModelSchema from '@/schemas/languageModel'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import requestSchema from '@/schemas/request'
import triggerSchema from '@/schemas/trigger'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  schema: propertiesJsonSchemaSchema,

  request: requestSchema,

  model: languageModelSchema,

  trigger: triggerSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/extract/{extractIntegrationId}/update:
 *   post:
 *     operationId: updateExtractIntegration
 *     summary: Update a Extract integration
 *     tags:
 *       - Extract Integration
 *     parameters:
 *       - in: path
 *         name: extractIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Extract integration
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
 *               - type: object
 *                 properties:
 *                   botId:
 *                     description: The ID of the Bot to use
 *                     type: string
 *                   schema:
 *                     description: The configured extraction schema
 *                     type: object
 *                     additionalProperties: true
 *                   request:
 *                     description: Optional webhook to receive the extracted data
 *                     type: string
 *                   model:
 *                     description: The language model to use for data extraction
 *                     type: string
 *     responses:
 *       200:
 *         description: The Extract integration was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Extract Integration
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

        schema,

        request,

        model,

        trigger,

        meta,
      } = body

      const extractIntegration =
        await prisma.extractIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'extractIntegrationId')
        )

      if (!extractIntegration) {
        return notFound()
      }

      if (extractIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.extractIntegration.update({
        where: {
          id: extractIntegration.id,
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

          schema,

          request,

          model,

          trigger,

          // meta and others

          meta: getMeta(meta, extractIntegration.meta),
        },
      })

      return ok({ id: extractIntegration.id })
    })
  )
)

/**
 * @manual Extract Integration
 *
 * ## Updating an Extract Integration
 *
 * Updating an extract integration allows you to refine your data extraction
 * configuration as your needs evolve. You can modify the extraction schema,
 * change webhook settings, adjust bot associations, or update trigger conditions.
 *
 * ```http
 * POST /api/v1/integration/extract/{extractIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Enhanced Customer Extractor",
 *   "schema": {
 *     "customerName": {
 *       "type": "string",
 *       "description": "The customer's full name",
 *       "required": true
 *     },
 *     "email": {
 *       "type": "string",
 *       "description": "The customer's email address",
 *       "required": true
 *     },
 *     "orderAmount": {
 *       "type": "number",
 *       "description": "The order amount in dollars",
 *       "collect": true
 *     }
 *   }
 * }
 * ```
 *
 * ### Common Update Scenarios
 *
 * **Refining Extraction Schema**: As you analyze extracted data, you may discover
 * additional fields to capture or existing fields that need clearer descriptions.
 * Update your schema to improve extraction accuracy.
 *
 * **Adding Numeric Metrics**: Add the `collect: true` property to numeric fields
 * in your schema to enable automatic metric tracking. This allows you to monitor
 * trends and analyze quantitative data from conversations.
 *
 * **Changing Webhook Configuration**: Update the `request` field to change where
 * extracted data is sent, or remove it entirely if you no longer need webhook
 * notifications.
 *
 * **Adjusting Bot Filtering**: Change the `botId` to apply the integration to
 * a different bot, or remove it to process conversations from all bots.
 *
 * **Modifying Trigger Conditions**: Update the `trigger` setting to control when
 * extraction occurs (e.g., on conversation end or idle).
 *
 * ### Testing Schema Changes
 *
 * After updating your extraction schema, it's recommended to use the trigger
 * endpoint to reprocess recent conversations and verify that the new schema
 * extracts data as expected before it affects new conversations.
 *
 * **Note:** Schema updates only affect future extractions. To apply the new
 * schema to historical conversations, use the trigger endpoint to reprocess them.
 */
