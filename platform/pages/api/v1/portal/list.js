// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /portal/list:
 *   get:
 *     operationId: listPortals
 *     summary: Retrieve a list of portals
 *     tags:
 *       - Portal
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
 *         description: The list of portals was retrieved successfully
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
 *                           slug:
 *                             description: The slug of the portal
 *                             type: string
 *                           config:
 *                             description: The config of the portal
 *                             type: object
 *                             additionalProperties: true
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
 *                       $ref: '#/paths/~1portal~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const portals = await prisma.portal.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            ...getBlueprintIdQueryFilter(req),
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

          // resource specific

          slug: true,

          config: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(portals),
      }
    })
  )
)

/**
 * @manual Portals
 * @index 10
 *
 * ## Listing Portals
 *
 * Retrieving a list of your portals allows you to manage and monitor all
 * access points you've created. The list endpoint supports pagination and
 * filtering capabilities, enabling you to efficiently work with large numbers
 * of portals and locate specific configurations quickly.
 *
 * The list operation returns all portals owned by the authenticated user,
 * including their configuration details, associated blueprints, and metadata.
 * This comprehensive view helps you understand your portal ecosystem and
 * identify which resources are accessible through each portal.
 *
 * ```http
 * GET /api/v1/portal/list
 * Content-Type: application/json
 * ```
 *
 * The response includes an array of portal objects, each containing the
 * portal's identifier, slug, configuration, and timestamps. You can use
 * pagination parameters to control the number of results returned and
 * navigate through large portal collections efficiently.
 *
 * **Pagination Parameters:**
 * - `cursor`: Pagination cursor for retrieving the next page of results
 * - `order`: Sort order for results (asc or desc, defaults to desc)
 * - `take`: Number of items to retrieve per page
 *
 * **Metadata Filtering:** The list endpoint supports filtering based on
 * metadata properties. You can use the `meta` query parameter to filter
 * portals by custom metadata fields you've set during creation or updates.
 * This is particularly useful for organizing portals by client, project,
 * or environment.
 *
 * **Performance Considerations:** When working with many portals, use
 * pagination to avoid performance issues. The default ordering by creation
 * date (descending) ensures you see your most recent portals first, which
 * is typically the most common access pattern.
 */
