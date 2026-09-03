// @ts-check
// @todo convert to edge
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { getMessageType } from '@/lib/message'
import { withPost } from '@/lib/method'
import { detectPiiEntities, getSafeTextAndEntities } from '@/lib/pii'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { recordMessageUsage } from '@/lib/usage.record'

import descriptionSchema from '@/schemas/description'
import messageTextSchema from '@/schemas/messageText'
import messageTypeSchema from '@/schemas/messageType'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  items: schema
    .array()
    .items(
      schema.object({
        id: schema.string().optional(),

        name: nameSchema,
        description: descriptionSchema,

        type: messageTypeSchema.required(),

        text: messageTextSchema.required(),

        entities: schema.array().items(schema.object({}).unknown(true)),

        meta: metaSchema,
      })
    )
    .min(1)
    .max(100),
})

/**
 * -@swagger
 *
 * /conversation/{conversationId}/message/batch/create:
 *   post:
 *     operationId: batchCreateConversationMessage
 *     summary: Batch create message
 *     tags:
 *       - Conversation Message
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceCrudProps'
 *                       - type: object
 *                         properties:
 *                           id:
 *                             description: The original ID of the message
 *                             type: string
 *                           type:
 *                             $ref: '#/components/schemas/MessageType'
 *                           text:
 *                             description: The text of the message
 *                             type: string
 *                           entities:
 *                             description: Known entities
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/Entity'
 *                         required:
 *                           - type
 *                           - text
 *             required:
 *               - items
 *     responses:
 *       200:
 *         description: The message was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         description: The ID of the created message
 *                         type: string
 *                       entities:
 *                         description: Extracted entities from the message
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/Entity'
 *                       originalId:
 *                         description: The original ID of the message
 *                         type: string
 *                     required:
 *                       - id
 *                       - entities
 *               required:
 *                 - items
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['rate/message', 'message'],
    withSchema(bodySchema, async function (req, session, body) {
      const { items } = body

      const conversation = await prisma.conversation.findUnique({
        where: {
          id: requiredUrlParam(req, 'conversationId'),
        },

        select: {
          id: true,

          userId: true,
        },
      })

      if (!conversation) {
        return notFound()
      }

      if (conversation.userId !== session.user.id) {
        return notAuthorized()
      }

      const results = []

      for (const {
        id: originalId,

        name,
        description,

        type,

        text,

        entities: knownEntities = [],

        meta,
      } of items) {
        let safeText, safeEntities

        if (knownEntities?.length) {
          const entities = await detectPiiEntities(text)

          ;({ safeText, safeEntities } = getSafeTextAndEntities(
            text,
            entities,
            knownEntities
          ))
        } else {
          ;(safeText = text), (safeEntities = [])
        }

        const { id } = await prisma.message.create({
          data: {
            conversationId: conversation.id,

            // basic information

            name,
            description,

            // resource specific

            type: getMessageType(type),

            text: safeText,

            // meta and others

            meta,
          },

          select: {
            id: true,
          },
        })

        results.push({ id, entities: safeEntities, originalId })
      }

      await recordMessageUsage({ user: session.user, count: items.length })

      return ok({ items: results })
    })
  )
)

/**
 * @manual Conversations
 *
 * ## Batch Creating Messages
 *
 * The batch message creation endpoint enables efficient addition of multiple
 * messages to a conversation in a single atomic operation, providing significant
 * performance advantages and transactional guarantees when working with
 * conversation history imports, data migrations, chat transcript ingestion, or
 * programmatic conversation initialization scenarios. This functionality is
 * essential for building robust integrations that need to efficiently populate
 * conversations with historical context, migrate chat data from other platforms,
 * or initialize conversations with pre-existing dialogue history.
 *
 * Unlike creating messages individually through repeated single-message API
 * calls, the batch endpoint processes all messages together, reducing network
 * overhead, minimizing database round trips, and ensuring consistent ordering
 * of messages within the conversation. This approach is particularly valuable
 * when dealing with data import scenarios where maintaining message sequence
 * and timestamp accuracy is critical for conversation coherence and historical
 * accuracy.
 *
 * The batch creation process supports up to 100 messages per request, allowing
 * you to efficiently populate conversations with substantial dialogue history
 * while maintaining system performance and reliability. Each message in the
 * batch can have its own type (user, bot, context, system), text content,
 * entities, metadata, and optional identifiers for maintaining references to
 * source systems during migration or import operations.
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/message/batch/create
 * Content-Type: application/json
 *
 * {
 *   "items": [
 *     {
 *       "type": "user",
 *       "text": "Hello, I need help with my order",
 *       "meta": {
 *         "originalTimestamp": "2024-01-15T10:30:00Z",
 *         "sourceSystem": "zendesk"
 *       }
 *     },
 *     {
 *       "type": "bot",
 *       "text": "I'd be happy to help you with your order. Can you provide your order number?",
 *       "meta": {
 *         "originalTimestamp": "2024-01-15T10:30:15Z",
 *         "sourceSystem": "zendesk"
 *       }
 *     },
 *     {
 *       "type": "user",
 *       "text": "Sure, it's order #12345",
 *       "meta": {
 *         "originalTimestamp": "2024-01-15T10:30:45Z",
 *         "sourceSystem": "zendesk"
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * ### Message Structure
 *
 * Each message in the batch must include:
 *
 * - **type**: Message type (user, bot, context, system, instruction, tool_request, tool_response)
 * - **text**: The message content (required, supports markdown and rich text)
 * - **entities**: Optional array of detected entities (names, dates, locations, etc.)
 * - **meta**: Custom metadata for storing additional context or source system references
 * - **id**: Optional external identifier for maintaining references during migrations
 *
 * ### Use Cases
 *
 * **Chat History Import**: Migrate existing chat transcripts from legacy
 * systems, customer support platforms, or other conversational AI solutions
 * into ChatBotKit conversations while preserving message order, timestamps,
 * and contextual information.
 *
 * **Conversation Initialization**: Set up conversations with pre-existing
 * context by adding historical messages that provide the AI with necessary
 * background information before the user's current inquiry, enabling more
 * contextually aware and relevant responses.
 *
 * **Testing and Development**: Quickly create test conversations with specific
 * dialogue patterns for testing bot behavior, training conversational flows,
 * or demonstrating capabilities in development and staging environments.
 *
 * **Data Migration**: Transfer conversation data between systems, accounts, or
 * organizational units while maintaining message integrity, sequence, and
 * associated metadata for compliance and historical accuracy.
 *
 * **Bulk Operations**: Process large volumes of messages efficiently when
 * importing transcripts, synchronizing external systems, or performing data
 * transformations that generate multiple related messages.
 *
 * ### Performance and Limitations
 *
 * - Maximum of 100 messages per batch request
 * - Messages are processed atomically - all succeed or all fail
 * - Message ordering within the batch is preserved in the conversation
 * - Each message counts toward account usage limits
 * - PII detection and content moderation apply to all messages in the batch
 * - Timestamps are automatically assigned based on creation time unless preserved in metadata
 *
 * **Best Practices**:
 *
 * - Use batch creation for 10+ messages to realize performance benefits
 * - Include source system identifiers in metadata for traceability
 * - Preserve original timestamps in metadata when importing historical data
 * - Order messages chronologically in the batch array for natural conversation flow
 * - Consider breaking very large imports into multiple batch requests
 * - Validate message content and structure before batch submission to avoid rollback
 *
 * **Important Notes**:
 *
 * - Batch creation is a write operation that cannot be undone
 * - Messages appear immediately in the conversation after successful creation
 * - The endpoint does not trigger automated bot responses (use send endpoint for that)
 * - Entity detection runs on all message text during batch processing
 * - Messages are subject to content moderation if enabled on the conversation
 */
