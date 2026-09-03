// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
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
 * /user/{userId}/context/{contextId}/update:
 *   post:
 *     operationId: updateUserContext
 *     summary: Update a user context
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           description: The ID of the user
 *           type: string
 *       - in: path
 *         name: contextId
 *         required: true
 *         schema:
 *           description: The ID of the context to update
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
 *         description: The context was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated context
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withChildUserSession(
    withSchema(bodySchema, async function (req, session, body) {
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

      const context = await prisma.context.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'contextId')
      )

      if (!context) {
        return notFound()
      }

      if (context.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.context.update({
        where: {
          id: context.id,
        },

        data: {
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

          meta: getMeta(meta, context.meta),
        },
      })

      return ok({ id: context.id })
    })
  )
)

/**
 * @manual User Contexts
 * @index 30
 *
 * ## Updating a User Context
 *
 * Modify an existing user context. All fields are optional in the
 * update request; only the fields you include will be changed. This follows
 * the standard ChatBotKit partial-update pattern.
 *
 * Common update scenarios include changing the linked bot when a customer
 * upgrades to a different configuration, updating the payload to reflect
 * changed preferences, or reassigning a context to a different blueprint.
 *
 * ```http
 * POST /api/v1/user/{userId}/context/{contextId}/update
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "botId": "bot_new456",
 *   "payload": {
 *     "tier": "enterprise",
 *     "locale": "de-DE"
 *   }
 * }
 * ```
 *
 * The response contains only the context `id` to confirm which record was
 * updated. Retrieve the full updated record using the fetch endpoint if you
 * need to verify the new field values.
 *
 * **Note:** Passing `null` for a resource ID field (e.g. `"botId": null`)
 * will clear the link for that resource. Omitting the field entirely leaves
 * the existing value unchanged.
 */
