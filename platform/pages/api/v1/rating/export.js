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
 * -@swagger
 *
 * /rating/export:
 *   get:
 *     operationId: exportRatings
 *     summary: Export ratings
 *     tags:
 *       - Rating
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
 *         description: The list of ratings was retrieved successfully
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
 *                             description: The contact id assigned to this rating
 *                             type: string
 *                           botId:
 *                             description: The bot id assigned to this rating
 *                             type: string
 *                           conversationId:
 *                             description: The conversation id assigned to this rating
 *                             type: string
 *                           messageId:
 *                             description: The message id assigned to this rating
 *                             type: string
 *                           value:
 *                             description: The rating value
 *                             type: number
 *                           reason:
 *                             description: The rating reason
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
 *                       $ref: '#/paths/~1rating~1export/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *           text/csv:
 *             schema:
 *               type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const ratings = await prisma.rating.findMany({
        where: {
          AND: [
            {
              userId: session.user.id,
            },

            // @todo maybe restrict by date range

            ...getMetaQueryFilter(req),
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

          conversationId: true,

          messageId: true,

          // resource specific

          value: true,

          reason: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(ratings),
      }
    })
  )
)

/**
 * @manual Ratings
 * @index 100
 *
 * ## Exporting Ratings
 *
 * Export your rating data in bulk for comprehensive analysis, reporting, or
 * archival purposes. The export operation provides access to your complete
 * rating history with the same powerful filtering capabilities available in
 * the list operation, but optimized for large-scale data retrieval.
 *
 * ```http
 * GET /api/v1/rating/export
 * ```
 *
 * Exports include all rating fields such as value, reason, timestamps, and
 * associated resource identifiers (contact, bot, conversation, message). The
 * operation returns data in a format suitable for import into spreadsheet
 * applications, business intelligence tools, or custom analytics platforms.
 *
 * ### Filtering Export Data
 *
 * Apply the same filtering capabilities available in the list operation to
 * control which ratings are included in your export. This enables targeted
 * analysis such as exporting all negative ratings for a specific time period,
 * all ratings for a particular bot, or ratings matching specific metadata
 * criteria:
 *
 * ```http
 * GET /api/v1/rating/export?botId=bot_abc123&meta[severity]=high
 * ```
 *
 * Common export scenarios include generating monthly feedback reports,
 * analyzing rating trends over time, identifying patterns in negative
 * feedback, comparing performance across different bots, and creating
 * compliance or audit documentation.
 *
 * ### Metadata in Exports
 *
 * Metadata fields are included in exports and can be used for filtering,
 * enabling rich categorization and analysis of exported data. Structure your
 * metadata consistently to facilitate automated processing and reporting of
 * exported rating data:
 *
 * ```http
 * GET /api/v1/rating/export?meta[exported]=false
 * ```
 *
 * Consider using metadata flags like `exported`, `processed`, or `reviewed`
 * to track which ratings have been included in previous exports or analysis
 * cycles. This helps maintain data integrity and prevents duplicate processing
 * in recurring export workflows.
 *
 * **Performance Note:** Export operations may take longer than list operations
 * when retrieving large volumes of rating data. For optimal performance, use
 * filtering parameters to limit exports to specific time periods or resources
 * rather than exporting entire rating histories unnecessarily.
 */
