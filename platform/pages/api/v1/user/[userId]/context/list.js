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
import { makeJsonSafe } from '@/lib/struct'
import { withChildUserSession } from '@/lib/user.handler'

/**
 * @swagger
 *
 * /user/{userId}/context/list:
 *   get:
 *     operationId: listUserContexts
 *     summary: List user contexts
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           description: The ID of the user
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
 *       - in: query
 *         name: blueprintId
 *         schema:
 *           type: string
 *       - in: query
 *         name: botId
 *         schema:
 *           type: string
 *       - in: query
 *         name: datasetId
 *         schema:
 *           type: string
 *       - in: query
 *         name: skillsetId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The list of contexts was retrieved successfully
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
 *                           blueprintId:
 *                             type: string
 *                           botId:
 *                             type: string
 *                           datasetId:
 *                             type: string
 *                           skillsetId:
 *                             type: string
 *                           contactId:
 *                             type: string
 *                           payload:
 *                             type: object
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
 *                       $ref: '#/paths/~1user~1{userId}~1context~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withChildUserSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const contexts = await prisma.context.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            ...getFieldQueryFilter(req, [
              'blueprintId',
              'botId',
              'datasetId',
              'skillsetId',
            ]),
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

          blueprintId: true,
          botId: true,
          datasetId: true,
          skillsetId: true,
          contactId: true,

          // resource specific

          payload: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(contexts),
      }
    })
  )
)

/**
 * @manual User Contexts
 * @index 20
 *
 * ## Listing User Contexts
 *
 * Retrieve a paginated list of all contexts that belong to a specific child
 * User. Results are returned in reverse chronological order by default and
 * support cursor-based pagination for large result sets.
 *
 * You can narrow results by providing one or more resource filter parameters
 * as query strings. For example, passing `botId=bot_abc123` will return only
 * contexts that reference that particular bot. Multiple filters can be
 * combined to find contexts linked to a specific combination of resources.
 *
 * ```http
 * GET /api/v1/user/{userId}/context/list?botId=bot_abc123&take=20
 * Authorization: Bearer YOUR_API_TOKEN
 * ```
 *
 * The response includes an `items` array of context objects and a `cursor`
 * value for fetching the next page. When `cursor` is an empty string, you
 * have reached the last page. Pass the returned cursor as the `cursor` query
 * parameter in the next request to continue pagination.
 *
 * Available filter parameters:
 *
 * - `blueprintId` - Filter contexts linked to a specific blueprint
 * - `botId` - Filter contexts linked to a specific bot
 * - `datasetId` - Filter contexts linked to a specific dataset
 * - `skillsetId` - Filter contexts linked to a specific skillset
 * - `meta` - Filter by metadata key-value pairs using deep object notation
 *
 * **Tip:** Use the `order=asc` parameter when you need to process contexts
 * in creation order, for example when synchronising context data with an
 * external system.
 */
