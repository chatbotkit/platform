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
 * /integration/extract/list:
 *   get:
 *     operationId: listExtractIntegrations
 *     summary: List Extract integrations
 *     tags:
 *       - Extract Integration
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
 *         description: The list of Extract integrations was retrieved successfully
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
 *                           botId:
 *                             description: The ID of the Bot to use
 *                             type: string
 *                           schema:
 *                             description: The configured extraction schema
 *                             type: object
 *                             additionalProperties: true
 *                           request:
 *                             description: Optional webhook to receive the extracted data
 *                             type: string
 *                           model:
 *                             description: The language model to use for data extraction
 *                             type: string
 *                         required:
 *                           - botId
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
 *                       $ref: '#/paths/~1integration~1extract~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const extractIntegrations = await prisma.extractIntegration.findMany({
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

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          blueprintId: true,

          botId: true,

          // resource specific

          schema: true,

          request: true,

          model: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(extractIntegrations),
      }
    })
  )
)

/**
 * @manual Extract Integration
 *
 * ## Listing Extract Integrations
 *
 * Retrieving a list of your extract integrations allows you to manage and monitor
 * all your data extraction configurations in one place. This is particularly useful
 * when you have multiple extraction schemas for different use cases or bots.
 *
 * The list endpoint supports pagination and filtering capabilities, enabling you to
 * efficiently navigate through large numbers of integrations. You can filter by
 * blueprint or use metadata queries to find specific integrations.
 *
 * ```http
 * GET /api/v1/integration/extract/list
 * ```
 *
 * ### Pagination
 *
 * Use the `cursor` parameter to paginate through results. The response includes
 * cursor information that you can use to fetch the next page of results. The `take`
 * parameter controls how many items to retrieve per page.
 *
 * ### Filtering Options
 *
 * - **By Blueprint**: Use the `blueprintId` query parameter to retrieve only integrations associated with a specific blueprint
 * - **By Metadata**: Use metadata query filters to find integrations with specific metadata properties
 * - **Order**: Control the sort order using the `order` parameter (asc or desc)
 *
 * Each integration in the response includes the complete schema definition, webhook
 * configuration, and associated bot information, allowing you to review and manage
 * your extraction configurations effectively.
 */
