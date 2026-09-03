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
  name: nameSchema,
  description: descriptionSchema,

  type: messageTypeSchema.required(),

  text: messageTextSchema.required(),

  entities: schema.array().items(schema.object({}).unknown(true)),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /conversation/{conversationId}/message/create:
 *   post:
 *     operationId: createConversationMessage
 *     summary: Create message
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
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - type: object
 *                 properties:
 *                   type:
 *                     $ref: '#/components/schemas/MessageType'
 *                   text:
 *                     description: The text of the message
 *                     type: string
 *                   entities:
 *                     description: Known entities
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Entity'
 *                 required:
 *                   - type
 *                   - text
 *     responses:
 *       200:
 *         description: The message was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created message
 *                   type: string
 *                 entities:
 *                   description: Extracted entities from the message
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Entity'
 *               required:
 *                 - id
 *                 - entities
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['rate/message', 'message'],
    withSchema(bodySchema, async function (req, session, body) {
      const {
        name,
        description,

        type,

        text,

        entities: knownEntities = [],

        meta,
      } = body

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

      await recordMessageUsage({ user: session.user, count: 1 })

      return ok({ id, entities: safeEntities })
    })
  )
)

/**
 * @manual Conversation Messages
 * @description Messages are individual units of communication within a conversation, representing either user inputs or AI responses, and can be created, retrieved, updated, or deleted to manage conversation content.
 * @category Objects/Conversations
 * @tags conversation, messages, chat
 * @index 70
 *
 * Messages are the fundamental building blocks of conversations in ChatBotKit,
 * representing each individual communication within a dialogue. Every message
 * has a type (user, bot, context, or activity) and contains text content along
 * with optional metadata, entities, and other attributes.
 *
 * Understanding message management is essential for building sophisticated chat
 * applications that require precise control over conversation content. You can
 * create messages manually, retrieve specific messages, update message content,
 * or remove messages from conversations.
 *
 * ## Creating Messages
 *
 * Creating a message manually allows you to add content to a conversation
 * without triggering the AI response system. This is useful for importing
 * existing conversations, adding system messages, or building conversation
 * histories programmatically.
 *
 * To create a message in a conversation:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/message/create
 * Content-Type: application/json
 *
 * {
 *   "type": "user",
 *   "text": "Hello, I have a question about pricing"
 * }
 * ```
 *
 * Replace `{conversationId}` with the actual conversation ID. The type and text
 * fields are required.
 *
 * ### Message Types
 *
 * Messages can have different types indicating their role in the conversation:
 *
 * - **user**: Messages from the end user
 * - **bot**: Responses from the AI assistant
 * - **context**: System or contextual messages providing information
 * - **activity**: Activity or status messages (function calls, actions)
 *
 * Choose the appropriate type based on the message's purpose. For most manual
 * message creation, you'll use "user" or "bot" types.
 *
 * ### Message Fields
 *
 * When creating a message, you can specify:
 *
 * - **name**: Optional name or label for the message
 * - **description**: Optional description providing additional context
 * - **type**: Required message type (user, bot, context, activity)
 * - **text**: Required message content
 * - **meta**: Optional custom metadata
 *
 * ### Response
 *
 * After creating a message, the API returns the unique identifier for the created
 * message. This ID can be used to reference the message later.
 *
 * ### Use Cases for Manual Message Creation
 *
 * Manual message creation is commonly used for:
 *
 * - **Importing Conversations**: Migrating existing chat histories into
 *   ChatBotKit
 * - **Building Context**: Adding contextual messages that set up the
 *   conversation
 * - **Testing**: Creating test conversation scenarios for development
 * - **Conversation Assembly**: Constructing conversations programmatically for
 *   demonstrations or templates
 * - **System Messages**: Adding administrative or system-level messages to
 *   conversations
 *
 * **Important Notes:**
 *
 * - Creating a message manually does not trigger an AI response
 * - Messages must belong to an existing conversation
 * - The message type affects how it's displayed and processed
 * - Message creation counts toward your usage limits
 */

// @todo document entity annotations API for PII protection
