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
 * /memory/list:
 *   get:
 *     operationId: listMemories
 *     summary: List memories
 *     tags:
 *       - Memory
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
 *         description: The list of memories was retrieved successfully
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
 *                           contactId:
 *                             type: string
 *                             description: The contact associated with the memory
 *                           botId:
 *                             type: string
 *                             description: The bot associated with the memory
 *                           text:
 *                             type: string
 *                             description: The text of the memory
 *                           expiresAt:
 *                             description: The timestamp (ms) at which the memory expires and is automatically deleted
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
 *                       $ref: '#/paths/~1memory~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const memories = await prisma.memory.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').Memory>} */ (
              getFieldQueryFilter
            )(req, ['contactId', 'botId']),
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

          botId: true,

          // resource specific

          text: true,

          expiresAt: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(memories),
      }
    })
  )
)

/**
 * @manual Memories
 * @index 10
 *
 * ## Listing Memories
 *
 * Listing memories enables you to retrieve all stored memories in your account,
 * with support for pagination and filtering by associated resources. This is
 * essential for browsing your memory collection, auditing stored information,
 * and managing your data at scale.
 *
 * The list endpoint returns memories in reverse chronological order by default,
 * showing the most recently created memories first. You can control pagination
 * using cursor-based navigation, which ensures consistent results even as new
 * memories are created during iteration.
 *
 * ```http
 * GET /api/v1/memory/list?take=20&order=desc
 * ```
 *
 * To filter memories by bot or contact, use query parameters:
 *
 * ```http
 * GET /api/v1/memory/list?botId=bot_123&take=50
 * ```
 *
 * The response includes all memory details such as id, name, description, text
 * content, associated bot and contact IDs, metadata, and timestamps. Use the
 * `cursor` parameter from the response to fetch the next page of results:
 *
 * ```http
 * GET /api/v1/memory/list?cursor=eyJpZCI6ImN1cnNvcl92YWx1ZSJ9&take=20
 * ```
 *
 * **Parameters:**
 *
 * - `take` - Number of memories to retrieve (default varies by endpoint)
 * - `order` - Sort order: `asc` or `desc` (default: `desc`)
 * - `cursor` - Pagination cursor from previous response
 * - `botId` - Filter by associated bot ID
 * - `contactId` - Filter by associated contact ID
 *
 * The listing operation is optimized for performance and supports filtering
 * through query parameters, making it easy to retrieve specific subsets of
 * memories without loading your entire collection.
 */
