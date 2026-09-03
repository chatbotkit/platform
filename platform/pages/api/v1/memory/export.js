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
import yaml from '@/lib/yaml'

/**
 * @swagger
 *
 * /memory/export:
 *   get:
 *     operationId: exportMemories
 *     summary: Export memories
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
 *                       $ref: '#/paths/~1memory~1export/get/responses/200/content/application~1json/schema/properties/items/items'
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
      const memories = await prisma.memory.findMany({
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

          // resource specific

          text: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(memories).map(({ meta, ...rest }) => {
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
 * @manual Memories
 * @index 60
 *
 * ## Exporting Memories
 *
 * Exporting memories allows you to retrieve your entire memory collection in
 * various formats suitable for backup, data migration, or integration with
 * external systems. The export endpoint supports multiple output formats
 * including JSON, JSONL (JSON Lines), and CSV, providing flexibility for
 * different use cases and downstream processing requirements.
 *
 * Unlike the standard list endpoint, the export operation is optimized for
 * bulk data retrieval and includes special handling for metadata serialization,
 * making it ideal for creating complete backups or transferring data between
 * systems. The endpoint supports the same pagination and filtering capabilities
 * as the list operation, allowing you to export specific subsets of your
 * memory collection.
 *
 * ```http
 * GET /api/v1/memory/export?take=1000&order=desc
 * Accept: application/json
 * ```
 *
 * To export memories in different formats, specify the appropriate Accept header:
 *
 * **JSON Format** (default):
 * ```http
 * GET /api/v1/memory/export
 * Accept: application/json
 * ```
 *
 * **JSONL Format** (one memory per line):
 * ```http
 * GET /api/v1/memory/export
 * Accept: application/jsonl
 * ```
 *
 * **CSV Format** (spreadsheet compatible):
 * ```http
 * GET /api/v1/memory/export
 * Accept: text/csv
 * ```
 *
 * The export includes all memory fields with proper formatting for each output
 * type. Metadata is serialized to YAML format when exported to CSV for better
 * readability, while JSON and JSONL formats preserve the native JSON structure.
 *
 * **Export Parameters:**
 *
 * - `take` - Number of memories per page (for pagination)
 * - `order` - Sort order: `asc` or `desc`
 * - `cursor` - Pagination cursor for fetching subsequent pages
 *
 * **Use Cases:**
 *
 * - Creating regular backups of your memory collection
 * - Migrating data between ChatBotKit accounts
 * - Integrating with external data processing systems
 * - Generating reports from memory data
 * - Archiving historical information
 *
 * For large memory collections, use pagination to retrieve data in manageable
 * chunks, which helps prevent timeouts and reduces memory usage during export
 * operations.
 */
