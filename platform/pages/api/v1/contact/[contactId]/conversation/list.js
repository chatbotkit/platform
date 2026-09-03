// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /contact/{contactId}/conversation/list:
 *   get:
 *     operationId: listContactConversations
 *     summary: List contact conversations
 *     tags:
 *       - Contact Conversation
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           description: The ID of the contact to list conversations for
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
 *         description: The list of conversations was retrieved successfully
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
 *                       - $ref: '#/components/schemas/BotRefOrConfig'
 *                       - type: object
 *                         properties:
 *                           contactId:
 *                             description: The contact id assigned to this conversation
 *                             type: string
 *                           taskId:
 *                             description: The task id assigned to this conversation
 *                             type: string
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
 *                       $ref: '#/paths/~1contact~1{contactId}~1conversation~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const contact = await prisma.contact.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'contactId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

      if (!contact) {
        throwNotFound()
      }

      if (contact.userId !== session.user.id) {
        throwNotAuthorized()
      }

      const conversations = await prisma.conversation.findMany({
        where: {
          AND: [{ contactId: contact.id }, ...getMetaQueryFilter(req)],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          contactId: true,

          taskId: true,

          botId: true,

          datasetId: true,

          skillsetId: true,

          // resource specific

          backstory: true,

          model: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(conversations),
      }
    })
  )
)

/**
 * @manual Contacts
 *
 * ## Listing Contact Conversations
 *
 * Retrieve all conversations associated with a specific contact to track their
 * interaction history, analyze engagement patterns, and maintain conversation
 * context across multiple sessions. This endpoint provides a complete view of
 * all conversations a contact has participated in, including metadata and
 * associated resources like bots and datasets.
 *
 * This is particularly useful for customer support scenarios where you need to
 * understand the full conversation history with a customer, or for analytics
 * purposes to track engagement and satisfaction across multiple interactions.
 *
 * ```http
 * GET /api/v1/contact/{contactId}/conversation/list
 * ```
 *
 * The endpoint supports pagination through cursor-based navigation, allowing
 * you to efficiently retrieve large conversation histories. Use the `cursor`
 * parameter from previous responses to fetch the next page of results.
 *
 * **Query Parameters:**
 *
 * - `cursor`: Pagination cursor from previous response for retrieving next page
 * - `order`: Sort order for conversations ("asc" or "desc", default: "desc")
 * - `take`: Number of conversations to retrieve per page (default: 25)
 * - `meta`: Filter conversations by metadata key-value pairs
 *
 * Each conversation in the response includes complete configuration details
 * including the bot, dataset, and skillset associations, enabling you to
 * understand the full context of each conversation and how it was configured.
 *
 * **Practical Example:**
 *
 * ```http
 * GET /api/v1/contact/contact-abc123/conversation/list?take=50&order=desc
 * ```
 *
 * This retrieves the 50 most recent conversations for the specified contact,
 * ordered from newest to oldest, making it easy to see their recent
 * interaction history and engagement patterns.
 */
