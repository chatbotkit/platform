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
 * /skillset/list:
 *   get:
 *     operationId: listSkillsets
 *     summary: Retrieve a list of skillsets
 *     tags:
 *       - Skillset
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
 *         description: The list of skillsets was retrieved successfully
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
 *                           visibility:
 *                             $ref: '#/components/schemas/SkillsetVisibility'
 *                           state:
 *                             $ref: '#/components/schemas/ResourceState'
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
 *                       $ref: '#/paths/~1skillset~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const skillsets = await prisma.skillset.findMany({
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

          visibility: true,

          // lifecycle

          state: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(skillsets),
      }
    })
  )
)

/**
 * @manual Skillsets
 *
 * ## Listing Your Skillsets
 *
 * Retrieving a list of all your skillsets provides an overview of the
 * capabilities available across your account. This is essential for building
 * management interfaces, selecting skillsets to attach to agents, or auditing
 * your account's configuration. The list endpoint returns summary information
 * about each skillset, making it efficient for displaying large collections.
 *
 * The list operation supports pagination through cursor-based navigation,
 * allowing you to retrieve skillsets in manageable batches. You can control the
 * order of results (ascending or descending by creation date) and the number of
 * items returned per request. This flexibility is important when dealing with
 * accounts that have many skillsets, as it enables you to build responsive user
 * interfaces that don't load excessive data at once.
 *
 * ```http
 * GET /api/v1/skillset/list?take=20&order=desc
 * ```
 *
 * Each skillset in the response includes key information such as the ID, name,
 * description, visibility settings, and timestamps. You can use the blueprint
 * filter to retrieve only skillsets associated with a specific project, or the
 * metadata filter to find skillsets with particular custom properties. The
 * response does not include the abilities within each skillset - those must be
 * retrieved separately for the specific skillsets you're interested in.
 *
 * **Query Parameters:**
 *
 * - `cursor` - Pagination cursor from a previous response to fetch the next page
 * - `order` - Sort order for results, either "asc" or "desc" (default: "desc")
 * - `take` - Number of skillsets to return per request (default: 20)
 * - `blueprintId` - Filter skillsets by blueprint association
 * - `meta` - Filter skillsets by custom metadata properties
 *
 * **Use Cases:**
 *
 * - Building skillset selection interfaces for agent configuration
 * - Displaying management dashboards with skillset inventory
 * - Implementing search and filtering functionality
 * - Exporting skillset metadata for analysis or backup
 * - Auditing skillset usage across your organization
 */
