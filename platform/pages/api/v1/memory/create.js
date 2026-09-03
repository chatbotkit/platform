// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
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

  text: dbTextSchema.required(),

  expiresAt: expiresAtSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /memory/create:
 *   post:
 *     operationId: createMemory
 *     summary: Create a new memory
 *     description: |
 *       Create a new memory with the given parameters.
 *     tags:
 *       - Memory
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
 *                     description: Epoch-ms timestamp at which the memory is automatically deleted; null for no expiry
 *                 required:
 *                   - text
 *     responses:
 *       200:
 *         description: The memory was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created memory
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        name,
        description,

        contactId: contact,

        botId: bot,

        text,

        expiresAt,

        meta,
      } = body

      // @note undefined -> use default; null -> no expiry; epoch ms -> Date
      const normalizedExpiresAt =
        expiresAt === undefined
          ? undefined
          : expiresAt == null
            ? null
            : new Date(expiresAt)

      const { id } = await prisma.memory.create({
        data: {
          userId: session.user.id,

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
 * @manual Memories
 * @description Memories are persistent data storage units that enable applications to store and retrieve information associated with bots and contacts, providing context and historical data for intelligent interactions.
 * @category Objects
 * @tags memory, data-storage, context
 * @index 1
 *
 * Memories serve as the foundational data layer for maintaining context and
 * storing information across conversations and interactions. They enable bots
 * and applications to recall previous information, maintain user preferences,
 * and provide personalized experiences based on historical data.
 *
 * Unlike bot memories which are automatically created during conversations,
 * general memories can be manually created, updated, and managed through the
 * API, providing explicit control over what information is stored and how it
 * is organized. This makes them ideal for importing external data, storing
 * structured information, or maintaining application-specific context.
 *
 * ## Creating Memories
 *
 * Creating a memory allows you to store arbitrary text content along with
 * optional metadata, enabling you to build custom knowledge bases or maintain
 * contextual information for your applications. Each memory can be associated
 * with a specific bot or contact, providing scoped access and organization.
 *
 * To create a memory, you need to provide the text content and optionally
 * specify a name, description, and resource associations. The memory will be
 * stored with a unique identifier that can be used for future retrieval,
 * updates, or deletion.
 *
 * ```http
 * POST /api/v1/memory/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Preference",
 *   "description": "Preferred communication style",
 *   "text": "Customer prefers email communication and detailed explanations",
 *   "botId": "bot_123",
 *   "contactId": "contact_456"
 * }
 * ```
 *
 * The `text` field contains the actual content of the memory and is required.
 * The `name` and `description` fields help organize and identify memories when
 * browsing or searching. The `botId` and `contactId` fields allow you to
 * associate the memory with specific resources, making it easier to filter and
 * retrieve relevant memories later.
 */
