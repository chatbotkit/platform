// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { getSortedMessages } from '@/lib/message'
import { withGet } from '@/lib/method'
import { queryParam, requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /conversation/{conversationId}/message/list:
 *   get:
 *     operationId: listConversationMessages
 *     summary: List conversation messages
 *     tags:
 *       - Conversation Message
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation to list messages for
 *           type: string
 *       - in: query
 *         name: cursor
 *         schema:
 *           description: The cursor to use for pagination
 *           type: string
 *       - in: query
 *         name: order
 *         schema:
 *           description: The order of the paginated items
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *       - in: query
 *         name: take
 *         schema:
 *           description: The number of items to retrieve
 *           type: integer
 *     responses:
 *       200:
 *         description: The messages were listed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - type: object
 *                         properties:
 *                           type:
 *                             $ref: '#/components/schemas/MessageType'
 *                           text:
 *                             description: The text of the message
 *                             type: string
 *                         required:
 *                           - type
 *                           - text
 *                 cursor:
 *                   description: Cursor for fetching the next page
 *                   type: string
 *               required:
 *                 - items
 *                 - cursor
 *           application/jsonl:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     type:
 *                       description: The type of event
 *                       type: string
 *                       enum:
 *                         - item
 *                     data:
 *                       $ref: '#/paths/~1conversation~1{conversationId}~1message~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
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
        return throwNotFound(`Conversation not found`)
      }

      if (conversation.userId !== session.user.id) {
        return throwNotAuthorized()
      }

      // @note the reason we use findMyriad because the messages contains
      // db.Text which can get quite big thus exceeding the total buffer size
      // allocated for sorting

      const messages = await prisma.message.findMyriad({
        where: {
          AND: [
            { conversationId: conversation.id },

            ...getMetaQueryFilter(req),
          ],
        },

        ...getCursorConstraints(req, cursor, 'asc'),

        ...getTakeConstraints(req),

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

      return {
        items: makeJsonSafe(
          getSortedMessages(
            messages,
            {
              asc: 'asc',
              desc: 'desc',
            }[queryParam(req, 'order') || 'asc']
          )
        ),
      }
    })
  )
)

/**
 * @manual Conversation Messages
 * @index 80
 *
 * ## Listing Conversation Messages
 *
 * Retrieving the list of messages in a conversation provides access to the
 * complete dialogue history, allowing you to display conversations, analyze
 * interactions, or export conversation data. The list endpoint supports
 * pagination and ordering to efficiently handle conversations of any length.
 *
 * To list all messages in a conversation:
 *
 * ```http
 * GET /api/v1/conversation/{conversationId}/message/list
 * ```
 *
 * Replace `{conversationId}` with the actual conversation ID. This returns all
 * messages in chronological order (oldest first) by default.
 *
 * ### Pagination and Ordering
 *
 * For conversations with many messages, use pagination to retrieve messages in
 * manageable chunks:
 *
 * ```http
 * GET /api/v1/conversation/{conversationId}/message/list?take=50&order=asc
 * ```
 *
 * Available parameters include:
 *
 * - **cursor**: Pagination cursor from the previous response for fetching the
 *   next page
 * - **take**: Number of messages to retrieve per request
 * - **order**: Sort order - "asc" (chronological, oldest first) or "desc"
 *   (reverse chronological, newest first)
 *
 * The default order is "asc" (chronological), which is most natural for
 * displaying conversations. Use "desc" to retrieve the most recent messages
 * first.
 *
 * ### Response Structure
 *
 * The response includes an items array with message objects:
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "msg_abc123",
 *       "type": "user",
 *       "text": "Hello, I have a question",
 *       "meta": {},
 *       "createdAt": "2025-01-09T10:30:00Z",
 *       "updatedAt": "2025-01-09T10:30:00Z"
 *     },
 *     {
 *       "id": "msg_def456",
 *       "type": "bot",
 *       "text": "I'd be happy to help! What's your question?",
 *       "meta": {},
 *       "createdAt": "2025-01-09T10:30:15Z",
 *       "updatedAt": "2025-01-09T10:30:15Z"
 *     }
 *   ]
 * }
 * ```
 *
 * Each message includes:
 *
 * - **id**: Unique message identifier
 * - **type**: Message type (user, bot, context, activity)
 * - **text**: Message content
 * - **meta**: Custom metadata attached to the message
 * - **createdAt**: When the message was created
 * - **updatedAt**: When the message was last modified
 *
 * ### Filtering by Metadata
 *
 * Messages with custom metadata can be filtered using meta query parameters,
 * allowing you to retrieve specific subsets of messages based on your custom
 * fields and values.
 *
 * ### Message Ordering Considerations
 *
 * The default ascending order (chronological) is optimal for:
 *
 * - Displaying complete conversations from beginning to end
 * - Exporting conversation transcripts
 * - Analyzing conversation flow and progression
 * - Maintaining natural reading order
 *
 * Descending order (reverse chronological) is useful for:
 *
 * - Loading the most recent messages first in a chat UI
 * - Checking the latest activity in a conversation
 * - Implementing "load more" functionality that fetches older messages
 *
 * ### Performance Considerations
 *
 * For conversations with very large messages or extensive history:
 *
 * - Use pagination with appropriate take values (50-100 messages per request)
 * - Consider caching message lists on your application side
 * - Use cursor-based pagination for consistent results during active
 *   conversations
 * - Filter by metadata when you only need specific message types
 *
 * ### Use Cases
 *
 * Common scenarios for listing messages include:
 *
 * - **Chat UI Display**: Loading and displaying conversation history in your
 *   application
 * - **Conversation Export**: Retrieving full conversation transcripts for
 *   archival or analysis
 * - **Context Analysis**: Examining message flow to understand conversation
 *   patterns
 * - **Debugging**: Reviewing actual message content during development or
 *   troubleshooting
 * - **Reporting**: Analyzing conversation content for business insights
 *
 * **Best Practices:**
 *
 * - Use ascending order for displaying conversations naturally
 * - Implement pagination for conversations with many messages
 * - Cache message lists when appropriate to reduce API calls
 * - Handle empty conversation cases gracefully
 * - Consider message type when rendering in your UI
 * - Store cursor values for efficient pagination
 */
