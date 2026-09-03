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
 * /task/export:
 *   get:
 *     operationId: exportTasks
 *     summary: Export tasks
 *     tags:
 *       - Task
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
 *         description: The list of tasks was retrieved successfully
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
 *                             description: The contact associated with the task
 *                           botId:
 *                             type: string
 *                             description: The bot associated with the task
 *                           schedule:
 *                             type: string
 *                             description: The schedule of the task
 *                           timezone:
 *                             type: string
 *                             nullable: true
 *                             description: The IANA timezone identifier used to evaluate the task schedule.
 *                           sessionDuration:
 *                             description: The session duration of the task execution (in milliseconds)
 *                             type: number
 *                             nullable: true
 *                           maxIterations:
 *                             description: The maximum number of iterations per task execution
 *                             type: number
 *                           maxTime:
 *                             description: The maximum time per task execution (in milliseconds)
 *                             type: number
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
 *                       $ref: '#/paths/~1task~1export/get/responses/200/content/application~1json/schema/properties/items/items'
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
      const tasks = await prisma.task.findMany({
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

          schedule: true,
          timezone: true,

          sessionDuration: true,

          // resource specific: options

          maxIterations: true,

          maxTime: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(tasks).map(({ meta, ...rest }) => {
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
 * @manual Tasks
 * @index 15
 *
 * ## Exporting Tasks
 *
 * The export endpoint provides a convenient way to extract your task configurations
 * in multiple formats, enabling backup, migration, or integration with external
 * systems. Unlike the list endpoint, export is specifically designed for bulk data
 * retrieval and format conversion.
 *
 * This endpoint supports multiple output formats including JSON, JSONL (JSON Lines),
 * and CSV, making it easy to integrate task data with spreadsheets, data processing
 * pipelines, or backup systems. The JSONL format is particularly useful for streaming
 * large datasets, while CSV provides compatibility with spreadsheet applications.
 *
 * To export your tasks in JSON format:
 *
 * ```http
 * GET /api/v1/task/export
 * Accept: application/json
 * ```
 *
 * For CSV export, which is ideal for spreadsheet applications:
 *
 * ```http
 * GET /api/v1/task/export
 * Accept: text/csv
 * ```
 *
 * The export endpoint includes the same pagination parameters as the list endpoint,
 * allowing you to export tasks in batches. However, exported data includes additional
 * formatting for the specified output type. For example, in CSV format, the `meta`
 * field is serialized as YAML for better readability and compatibility.

 * Exported task records preserve scheduling context including `schedule` and
 * `timezone`, so recurring automations can be recreated without losing local
 * schedule semantics.
 *
 * Pagination parameters work identically to the list endpoint, supporting `cursor`,
 * `order`, and `take` query parameters. This allows you to export large task collections
 * in manageable chunks or create incremental backups of your automation configurations.
 *
 * **Use Case:** Export is particularly valuable when migrating between environments,
 * creating backups of your automation workflows, or integrating task data with
 * external monitoring and reporting systems.
 */
