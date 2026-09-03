// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import botIdSchema from '@/schemas/botId'
import contactIdSchema from '@/schemas/contactId'
import dbTextSchema from '@/schemas/dbText'
import descriptionSchema from '@/schemas/description'
import expiresAtSchema from '@/schemas/expiresAt'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  contactId: contactIdSchema('use'),

  botId: botIdSchema('use'),

  text: dbTextSchema,

  expiresAt: expiresAtSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /memory/{memoryId}/update:
 *   post:
 *     operationId: updateMemory
 *     summary: Update memory
 *     tags:
 *       - Memory
 *     parameters:
 *       - in: path
 *         name: memoryId
 *         required: true
 *         schema:
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
 *                   contactId:
 *                     type: string
 *                     description: The contact associated with the memory
 *                   botId:
 *                     type: string
 *                     description: The bot associated with the memory
 *                   text:
 *                     type: string
 *                     description: The text of the memory
 *                   expiresAt:
 *                     type: integer
 *                     nullable: true
 *                     description: Epoch-ms timestamp at which the memory is automatically deleted; null clears any expiry
 *     responses:
 *       200:
 *         description: The memory was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated memory
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
        name,
        description,

        contactId: contact,

        botId: bot,

        text,

        expiresAt,

        meta,
      } = body

      // @note undefined -> leave unchanged; null -> clear expiry; epoch ms -> Date
      const normalizedExpiresAt =
        expiresAt === undefined
          ? undefined
          : expiresAt == null
            ? null
            : new Date(expiresAt)

      const memory = await prisma.memory.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'memoryId')
      )

      if (!memory) {
        return notFound()
      }

      if (memory.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.memory.update({
        where: {
          id: memory.id,
        },

        data: {
          // basic information

          name,
          description,

          // resource linking

          contactId: contact?.id,

          botId: bot?.id,

          // resource specific

          text,

          expiresAt: normalizedExpiresAt,

          // meta and others

          meta: getMeta(meta, memory.meta),
        },
      })

      return ok({ id: memory.id })
    })
  )
)

/**
 * @manual Memories
 * @index 30
 *
 * ## Updating a Memory
 *
 * Updating a memory allows you to modify any aspect of an existing memory,
 * including its content, name, description, associations, and metadata. This
 * is essential for maintaining accurate information as requirements change or
 * new information becomes available.
 *
 * The update operation supports partial updates, meaning you only need to
 * include the fields you want to modify. Fields not included in the request
 * will remain unchanged. This makes it easy to update specific aspects without
 * having to resend the entire memory object.
 *
 * ```http
 * POST /api/v1/memory/{memoryId}/update
 * Content-Type: application/json
 *
 * {
 *   "text": "Updated memory content with new information",
 *   "description": "Updated description reflecting changes"
 * }
 * ```
 *
 * You can update any combination of fields in a single request:
 *
 * ```http
 * POST /api/v1/memory/mem_123abc/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Preference",
 *   "text": "Customer now prefers phone calls for urgent matters",
 *   "botId": "bot_456",
 *   "meta": {
 *     "lastModifiedBy": "automation",
 *     "priority": "high"
 *   }
 * }
 * ```
 *
 * **Available Fields:**
 *
 * - `name` - Update the memory's name
 * - `description` - Update the description
 * - `text` - Update the memory content
 * - `botId` - Change or set the associated bot
 * - `contactId` - Change or set the associated contact
 * - `expiresAt` - Epoch-ms expiry after which the memory is auto-deleted (null to clear)
 * - `meta` - Update or merge metadata
 */
