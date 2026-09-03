// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
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
 * /blueprint/list:
 *   get:
 *     operationId: listBlueprints
 *     summary: Retrieve a list of blueprints
 *     tags:
 *       - Blueprint
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
 *         description: The list of blueprints was retrieved successfully
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
 *                       - type: object
 *                         properties:
 *                           visibility:
 *                             $ref: '#/components/schemas/BlueprintVisibility'
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
 *                       $ref: '#/paths/~1blueprint~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const blueprints = await prisma.blueprint.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),
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

          // resource specific

          visibility: true,

          config: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(blueprints),
      }
    })
  )
)

/**
 * @manual Blueprints
 * @index 10
 *
 * ## Listing Blueprints
 *
 * You can retrieve a list of all blueprints associated with your account using the list endpoint. This is useful for displaying available templates, browsing existing configurations, and managing your blueprint collection.
 *
 * The list operation supports pagination to efficiently handle large numbers of blueprints. You can control the number of items returned and navigate through results using cursor-based pagination:
 *
 * ```http
 * GET /api/v1/blueprint/list?take=10&order=desc
 * ```
 *
 * The response includes an array of blueprint items, each containing the blueprint's metadata and configuration details. This allows you to display blueprint information in your application or select a blueprint for further operations.
 *
 * ### Pagination Parameters
 *
 * - `cursor`: Continue pagination from a specific point (obtained from previous responses)
 * - `order`: Sort order for results - `asc` for ascending or `desc` for descending (default: `desc`)
 * - `take`: Number of items to retrieve per request (helps manage response size)
 *
 * The returned items include essential information such as the blueprint ID, name, description, visibility setting, and timestamps. You can use this data to present blueprint options to users or programmatically select blueprints based on specific criteria.
 *
 * **Note:** The list endpoint only returns blueprints owned by the authenticated user. To access shared or public blueprints, you'll need to use the fetch endpoint with a specific blueprint ID.
 */
