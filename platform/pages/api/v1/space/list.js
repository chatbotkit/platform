// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getBlueprintIdQueryFilter,
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
 * /space/list:
 *   get:
 *     operationId: listSpaces
 *     summary: List spaces
 *     tags:
 *       - Space
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
 *         description: The list of spaces was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceRefProperties'
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - $ref: '#/components/schemas/BlueprintProps'
 *                       - type: object
 *                         properties:
 *                           contactId:
 *                             description: The contact associated with the space
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
 *                       $ref: '#/paths/~1space~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const spaces = await prisma.space.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            ...getBlueprintIdQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').Space>} */ (
              getFieldQueryFilter
            )(req, ['contactId']),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // ref

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          blueprintId: true,

          contactId: true,

          // resource specific

          // @todo add here

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(spaces),
      }
    })
  )
)

/**
 * @manual Spaces
 * @index 10
 *
 * ## Listing Spaces
 *
 * Retrieving a list of your spaces is essential for discovering and managing
 * your workspace environments. The list endpoint provides comprehensive
 * filtering and pagination capabilities, allowing you to efficiently navigate
 * through large collections of spaces.
 *
 * The list operation supports cursor-based pagination for optimal performance
 * when working with extensive space collections. You can control the number
 * of results per page, the sort order, and apply filters based on metadata
 * or specific field values such as associated contact identifiers.
 *
 * To retrieve your spaces, send a GET request to the list endpoint:
 *
 * ```http
 * GET /api/v1/space/list?order=desc&take=20
 * ```
 *
 * For pagination through large result sets, use the cursor parameter returned
 * from previous requests:
 *
 * ```http
 * GET /api/v1/space/list?cursor=eyJpZCI6InNwYWNlXzEyMyJ9&order=desc&take=20
 * ```
 *
 * You can also filter spaces by specific criteria. For example, to find all
 * spaces associated with a particular contact:
 *
 * ```http
 * GET /api/v1/space/list?contactId=contact_abc123
 * ```
 *
 * The response includes an array of space objects containing their identifiers,
 * names, descriptions, associated contact IDs, metadata, and timestamps. This
 * comprehensive information enables you to build rich user interfaces for
 * space management and selection.
 *
 * **Performance Tip:** Use the `take` parameter to limit result set sizes
 * and improve response times, especially when implementing search or
 * autocomplete features.
 */
