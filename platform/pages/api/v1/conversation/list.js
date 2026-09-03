// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getFieldQueryFilter,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /conversation/list:
 *   get:
 *     operationId: listConversations
 *     summary: List conversations
 *     tags:
 *       - Conversation
 *     parameters:
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
 *       - in: query
 *         name: meta
 *         schema:
 *           description: Key-value pairs to filter the items by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
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
 *                           spaceId:
 *                             description: The space id assigned to this conversation
 *                             type: string
 *                           expiresAt:
 *                             description: The timestamp (ms) at which the conversation expires and is automatically deleted
 *                             type: number
 *                             nullable: true
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
 *                       $ref: '#/paths/~1conversation~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const conversations = await prisma.conversation.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').Conversation>} */ (
              getFieldQueryFilter
            )(req, ['botId', 'contactId', 'taskId']),
          ],
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

          spaceId: true,

          botId: true,

          datasetId: true,

          skillsetId: true,

          // resource specific

          backstory: true,

          model: true,

          privacy: true,
          moderation: true,

          expiresAt: true,

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
 * @manual Conversations
 * @index 10
 *
 * ## Listing Conversations
 *
 * Retrieving a list of conversations allows you to access and manage all
 * conversations associated with your account. The list endpoint provides
 * powerful filtering, pagination, and ordering capabilities to help you find
 * and organize conversations efficiently.
 *
 * To list conversations, send a GET request to the list endpoint:
 *
 * ```http
 * GET /api/v1/conversation/list
 * ```
 *
 * This returns all conversations for the authenticated user, ordered by creation
 * date (most recent first) by default.
 *
 * ### Pagination and Ordering
 *
 * The list endpoint supports cursor-based pagination for efficient retrieval of
 * large conversation sets:
 *
 * ```http
 * GET /api/v1/conversation/list?take=20&order=desc
 * ```
 *
 * Available parameters for pagination and ordering include:
 *
 * - **cursor**: A pagination cursor from the previous response to fetch the next
 *   page of results
 * - **take**: Number of conversations to retrieve (default and maximum depend on
 *   your plan)
 * - **order**: Sort order, either "asc" (ascending) or "desc" (descending) by
 *   creation date
 *
 * The response includes an items array containing conversation objects, each with
 * their ID, name, description, configuration, and timestamps. If there are more
 * results available, the response will include a cursor for fetching the next
 * page.
 *
 * ### Filtering by Relationships
 *
 * You can filter conversations by their associated resources using query
 * parameters:
 *
 * ```http
 * GET /api/v1/conversation/list?botId=bot_abc123&contactId=contact_xyz789
 * ```
 *
 * Supported filter parameters include:
 *
 * - **botId**: Filter by associated bot
 * - **contactId**: Filter by associated contact
 * - **taskId**: Filter by associated task
 *
 * ### Filtering by Metadata
 *
 * Conversations with custom metadata can be filtered using meta queries. This
 * allows you to organize and retrieve conversations based on your own custom
 * fields and values.
 *
 * ### Response Format
 *
 * Each conversation in the response includes:
 *
 * - Core identifiers (id)
 * - Basic information (name, description)
 * - Resource relationships (botId, contactId, taskId, spaceId, datasetId,
 *   skillsetId)
 * - Configuration (backstory, model, privacy, moderation)
 * - Metadata (meta)
 * - Timestamps (createdAt, updatedAt)
 *
 * **Best Practices:**
 *
 * - Use pagination for large conversation sets to improve performance
 * - Apply filters to narrow results when searching for specific conversations
 * - Consider the order parameter based on your use case (recent conversations
 *   vs. oldest first)
 * - Store cursors for efficient navigation through paginated results
 */
