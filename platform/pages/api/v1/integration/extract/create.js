// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'

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
 * /integration/extract/create:
 *   post:
 *     operationId: createExtractIntegration
 *     summary: Create Extract integration
 *     tags:
 *       - Extract Integration
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
 *         description: The Extract integration was created successfully
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
  withSessionLimits(
    ['database/integration'],
    withSchema(bodySchema, async function (_req, session, body) {
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

      const { id } = await prisma.extractIntegration.create({
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

          schema,

          request,

          model,

          trigger,

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
 * @manual Extract Integration
 * @description The Extract Integration enables automated data extraction from conversations using custom JSON schemas, allowing you to capture structured information from user interactions.
 * @category Integrations
 * @tags extract, integration, data-extraction
 * @index 240
 *
 * The Extract Integration is a powerful feature that allows you to automatically
 * pull contextually relevant information from conversations based on a predetermined
 * JSON schema. This integration enriches conversation metadata and facilitates more
 * efficient data usage in customer support, transcriptions, and data analytics scenarios.
 *
 * The integration empowers your AI bots to not only interact autonomously with
 * users but also to extract key pieces of information from conversations. After a
 * conversation ends or goes idle, the bot uses your provided JSON schema to extract
 * data, consequently enriching the conversation metadata with structured information.
 *
 * ## Creating an Extract Integration
 *
 * Creating an extract integration establishes the foundation for automated data
 * extraction from your conversations. The integration requires a custom JSON schema
 * that defines what information to extract and how to structure it.
 *
 * To create an extract integration, you need to provide basic information such as
 * the integration name, description, and most importantly, the extraction schema
 * that defines the data structure you want to capture.
 *
 * ```http
 * POST /api/v1/integration/extract/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Information Extractor",
 *   "description": "Extracts customer details from support conversations",
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
 *     "issueType": {
 *       "type": "string",
 *       "description": "The type of issue reported"
 *     }
 *   }
 * }
 * ```
 *
 * ### Schema Design Considerations
 *
 * When designing your extraction schema, consider the following:
 *
 * - **Field Types**: Use appropriate types (string, number, boolean) for each field
 * - **Required Fields**: Mark essential fields as required to ensure data completeness
 * - **Descriptions**: Provide clear, detailed descriptions to guide the extraction process
 * - **Conversation Flow**: Design your bot's backstory and conversation flow to naturally collect the information specified in your schema
 *
 * ### Optional Webhook Configuration
 *
 * You can optionally configure a webhook URL in the `request` field to receive the
 * extracted data automatically. When specified, the integration will POST the extracted
 * data to your webhook endpoint after processing each conversation.
 *
 * The webhook request will include:
 * - The extracted data according to your schema
 * - The conversation messages that were used for extraction
 * - An HMAC signature for request verification
 *
 * ### Bot Filtering
 *
 * When you specify a `botId`, the integration will only process conversations from
 * that specific bot. This allows you to have different extraction schemas for different
 * bots or use cases within your application.
 *
 * **Warning:** The extraction schema structure should be carefully designed and tested
 * before deployment. Inaccurate or inappropriate schemas could lead to incomplete or
 * incorrect data extraction. Test your schema with various conversation scenarios to
 * ensure it extracts the intended data accurately.
 */
