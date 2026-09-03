// @ts-check
// @todo convert to edge
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /conversation/{conversationId}/message/{messageId}/fetch:
 *   get:
 *     operationId: fetchConversationMessage
 *     summary: Fetch conversation message
 *     tags:
 *       - Conversation Message
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation containing the message
 *           type: string
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           description: The ID of the message to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The message was fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - type: object
 *                   properties:
 *                     type:
 *                       $ref: '#/components/schemas/MessageType'
 *                     text:
 *                       description: The text of the fetched message
 *                       type: string
 *                   required:
 *                     - type
 *                     - text
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: requiredUrlParam(req, 'conversationId'),
      },

      select: {
        id: true,

        userId: true,

        messages: {
          where: {
            id: requiredUrlParam(req, 'messageId'),
          },

          select: {
            // identifiers

            id: true,

            // basic information

            name: true,
            description: true,

            // resource specific

            type: true,

            text: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },

          take: 1,
        },
      },
    })

    if (!conversation) {
      return notFound()
    }

    if (conversation.userId !== session.user.id) {
      return notAuthorized()
    }

    if (!conversation.messages.length) {
      return notFound()
    }

    const message = await prisma.message.findUnique({
      where: {
        id: conversation.messages[0].id,
      },

      select: {
        // identifiers

        id: true,

        // basic information

        // resource linking

        // resource specific

        type: true,
        text: true,

        // meta and others

        meta: true,

        createdAt: true,
        updatedAt: true,
      },
    })

    if (!message) {
      return notFound()
    }

    return ok(makeJsonSafe(message))
  })
)

/**
 * @manual Conversation Messages
 * @index 90
 *
 * ## Fetching a Specific Message
 *
 * Retrieving a single message by its ID provides access to the complete message
 * details, including its content, type, metadata, and timestamps. This is useful
 * when you need to reference a specific message, display message details, or
 * verify message content.
 *
 * To fetch a specific message:
 *
 * ```http
 * GET /api/v1/conversation/{conversationId}/message/{messageId}/fetch
 * ```
 *
 * Replace `{conversationId}` with the conversation ID and `{messageId}` with
 * the specific message ID you want to retrieve.
 *
 * ### Response Details
 *
 * The response includes the complete message object:
 *
 * ```json
 * {
 *   "id": "msg_abc123",
 *   "type": "user",
 *   "text": "What are your business hours?",
 *   "meta": {},
 *   "createdAt": "2025-01-09T10:30:00Z",
 *   "updatedAt": "2025-01-09T10:30:00Z"
 * }
 * ```
 *
 * ### Use Cases
 *
 * Fetching individual messages is commonly used for:
 *
 * - **Message References**: Displaying quoted or referenced messages in a UI
 * - **Deep Linking**: Allowing users to link directly to specific messages
 * - **Verification**: Confirming message content after creation or update
 * - **Auditing**: Retrieving specific messages for compliance or review
 * - **Context Retrieval**: Getting specific message details for processing or
 *   analysis
 *
 * **Performance Note:** For retrieving multiple messages, use the list endpoint
 * with appropriate filters rather than fetching messages individually, as this
 * is more efficient and reduces API calls.
 */
