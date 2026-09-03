// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { makeJsonSafe } from '@/lib/struct'
import { withChildUserSession } from '@/lib/user.handler'

import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import contactIdSchema from '@/schemas/contactId'
import datasetIdSchema from '@/schemas/datasetId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import skillsetIdSchema from '@/schemas/skillsetId'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),
  botId: botIdSchema('use'),
  datasetId: datasetIdSchema('use'),
  skillsetId: skillsetIdSchema('use'),
  contactId: contactIdSchema('use'),

  payload: schema.object().unknown(true).optional().allow(null),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /user/{userId}/context/create:
 *   post:
 *     operationId: createUserContext
 *     summary: Create user context
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           description: The ID of the user
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - type: object
 *                 properties:
 *                   payload:
 *                     description: Context payload
 *                     type: object
 *     responses:
 *       200:
 *         description: The user context was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - type: object
 *                   properties:
 *                     blueprintId:
 *                       type: string
 *                     botId:
 *                       type: string
 *                     datasetId:
 *                       type: string
 *                     skillsetId:
 *                       type: string
 *                     contactId:
 *                       type: string
 *                     payload:
 *                       type: object
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withChildUserSession(
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        name,
        description,

        blueprintId: blueprint,
        botId: bot,
        datasetId: dataset,
        skillsetId: skillset,
        contactId: contact,

        payload,

        meta,
      } = body

      const context = await prisma.context.create({
        data: {
          userId: session.user.id,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,
          botId: bot?.id || bot,
          datasetId: dataset?.id || dataset,
          skillsetId: skillset?.id || skillset,
          contactId: contact?.id || contact,

          // resource specific

          payload,

          // meta and others

          meta,
        },

        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          blueprintId: true,
          botId: true,
          datasetId: true,
          skillsetId: true,
          contactId: true,

          // resource specific

          payload: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return ok(makeJsonSafe(context))
    })
  )
)

/**
 * @manual User Contexts
 * @description User contexts associate a user with specific platform resources such as blueprints, bots, datasets, and skillsets, enabling scoped AI experiences with optional custom payload data.
 * @category User
 * @tags users, context, multi-tenant, resources
 * @index 10
 *
 * User contexts let you bind a user to a set of
 * platform resources - a blueprint, bot, dataset, skillset, or contact - along
 * with a free-form payload object. This is useful when each of your customers
 * should operate within a pre-defined AI configuration, or when you want to
 * attach arbitrary metadata to a customer's resource scope without modifying
 * the underlying resource. Linking a context to a contact scopes its payload to
 * that contact, so it is compiled into any bot interaction involving them.
 *
 * Contexts are managed entirely by the parent User on behalf of its child
 * Users, using the same `X-RunAs-UserId` header pattern that applies
 * to all user operations. The user's isolated environment remains
 * unchanged; the context is an additional layer of linkage.
 *
 * ## Creating a User Context
 *
 * Send a POST request with the target user's ID in the path and the
 * desired resource associations in the request body. All resource references
 * (`blueprintId`, `botId`, `datasetId`, `skillsetId`) are optional, so you
 * can link as many or as few as the use case requires.
 *
 * The optional `payload` field accepts any JSON object, making it a flexible
 * store for configuration data, user preferences, or integration-specific
 * settings that your application needs to attach to the context.
 *
 * ```http
 * POST /api/v1/user/{userId}/context/create
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "name": "Customer Onboarding Context",
 *   "description": "Links the customer to the onboarding bot and dataset",
 *   "botId": "bot_abc123",
 *   "datasetId": "dataset_xyz789",
 *   "payload": {
 *     "tier": "premium",
 *     "locale": "en-US"
 *   }
 * }
 * ```
 *
 * The response contains the full context record including all linked resource
 * IDs, the payload, and standard metadata fields (`id`, `createdAt`,
 * `updatedAt`).
 *
 * **Note:** At least one resource ID or a payload value should be provided,
 * though the API does not enforce this constraint. Contexts with no resource
 * links and no payload offer no practical value.
 */
