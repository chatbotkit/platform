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
import yaml from '@/lib/yaml'

/**
 * @swagger
 *
 * /space/export:
 *   get:
 *     operationId: exportSpaces
 *     summary: Export spaces
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
 *                       $ref: '#/paths/~1space~1export/get/responses/200/content/application~1json/schema/properties/items/items'
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
      const spaces = await prisma.space.findMany({
        where: {
          AND: [
            {
              userId: session.user.id,
            },

            // @todo maybe restrict by date range

            ...getMetaQueryFilter(req),

            ...getBlueprintIdQueryFilter(req),
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
        items: makeJsonSafe(spaces).map(({ meta, ...rest }) => {
          return {
            ...rest,

            meta: new Proxy(meta || {}, {
              get: function (target, prop) {
                if (prop === 'toString') {
                  return function () {
                    return target ? yaml.stringify(target) : ''
                  }
                }

                return target[prop]
              },
            }),
          }
        }),
      }
    })
  )
)

/**
 * @manual Spaces
 * @index 50
 *
 * ## Exporting Spaces
 *
 * Exporting spaces enables bulk data retrieval in various formats, supporting
 * backup operations, data migration workflows, and integration with external
 * systems. The export endpoint provides flexible output formats including JSON,
 * JSONL (JSON Lines), and CSV, making it easy to work with space data in
 * different contexts.
 *
 * The export operation supports the same pagination and filtering capabilities
 * as the list endpoint, but with enhanced format support for large-scale data
 * operations. This flexibility allows you to export complete space collections
 * or filtered subsets based on your specific requirements.
 *
 * To export spaces in JSON format (default):
 *
 * ```http
 * GET /api/v1/space/export
 * Accept: application/json
 * ```
 *
 * For streaming exports using JSONL format, which is ideal for processing
 * large datasets line-by-line:
 *
 * ```http
 * GET /api/v1/space/export
 * Accept: application/jsonl
 * ```
 *
 * To export as CSV for spreadsheet applications or data analysis tools:
 *
 * ```http
 * GET /api/v1/space/export
 * Accept: text/csv
 * ```
 *
 * The export operation supports pagination to handle large space collections
 * efficiently:
 *
 * ```http
 * GET /api/v1/space/export?order=desc&take=100
 * ```
 *
 * **Format Details:**
 *
 * - **JSON:** Returns a structured object with an `items` array containing all
 *   space records. Best for programmatic processing and API integrations.
 *
 * - **JSONL:** Returns newline-delimited JSON objects, with each line containing
 *   a single space record. Ideal for streaming processing and ETL pipelines.
 *
 * - **CSV:** Returns comma-separated values with headers, compatible with
 *   spreadsheet applications. Metadata fields are serialized as YAML strings
 *   for readability.
 *
 * **Use Cases:**
 *
 * - **Backup and Recovery:** Regular exports ensure you have offline copies
 *   of your space configurations for disaster recovery scenarios.
 *
 * - **Data Migration:** Export spaces when moving between environments or
 *   transitioning to different systems.
 *
 * - **Analytics and Reporting:** Export to CSV for analysis in spreadsheet
 *   applications or business intelligence tools.
 *
 * - **System Integration:** Use JSONL format for efficient integration with
 *   data processing pipelines and external systems.
 */
