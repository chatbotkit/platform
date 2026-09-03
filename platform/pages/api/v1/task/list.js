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
 * /task/list:
 *   get:
 *     operationId: listTasks
 *     summary: List tasks
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
 *         name: blueprintId
 *         schema:
 *           description: Filter by associated blueprint
 *           type: string
 *       - in: query
 *         name: botId
 *         schema:
 *           description: Filter by associated bot
 *           type: string
 *       - in: query
 *         name: contactId
 *         schema:
 *           description: Filter by associated contact
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           description: Filter by task status
 *           type: string
 *           enum:
 *             - idle
 *             - running
 *             - canceled
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
 *                           blueprintId:
 *                             type: string
 *                             description: The blueprint associated with the task
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
 *                           status:
 *                             $ref: '#/components/schemas/TaskStatus'
 *                           outcome:
 *                             $ref: '#/components/schemas/TaskOutcome'
 *                           lastRunAt:
 *                             description: The timestamp (ms) of the last task execution
 *                             type: number
 *                             nullable: true
 *                           nextRunAt:
 *                             description: The timestamp (ms) of the next scheduled task execution
 *                             type: number
 *                             nullable: true
 *                           expiresAt:
 *                             description: The timestamp (ms) at which the task expires and is automatically deleted
 *                             type: number
 *                             nullable: true
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
 *                       $ref: '#/paths/~1task~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const tasks = await prisma.task.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            ...getBlueprintIdQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').Task>} */ (
              getFieldQueryFilter
            )(req, ['botId', 'contactId', 'status']),
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

          botId: true,

          // resource specific

          schedule: true,
          timezone: true,

          sessionDuration: true,

          // resource specific: options

          maxIterations: true,

          maxTime: true,

          // resource state

          status: true,
          outcome: true,

          lastRunAt: true,
          nextRunAt: true,

          expiresAt: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(tasks),
      }
    })
  )
)

/**
 * @manual Tasks
 * @index 10
 *
 * ## Listing Tasks
 *
 * Retrieving a list of your tasks allows you to view all automated workflows
 * configured in your account. The list endpoint provides pagination support and
 * filtering capabilities to help you manage large collections of tasks efficiently.
 *
 * The list endpoint returns tasks in reverse chronological order by default (most
 * recently created first), with support for cursor-based pagination to handle large
 * datasets. Each task in the response includes its configuration details, schedule
 * information, and associated resource identifiers.
 *
 * To retrieve your tasks, send a GET request:
 *
 * ```http
 * GET /api/v1/task/list
 * ```
 *
 * For paginated results, you can specify query parameters:
 *
 * ```http
 * GET /api/v1/task/list?take=50&order=asc&cursor=eyJpZCI6InRhc2tfYWJjMTIzIn0
 * ```
 *
 * The `take` parameter controls how many tasks to retrieve per page (default behavior
 * applies if not specified). The `order` parameter accepts `asc` or `desc` to control
 * sorting direction. The `cursor` parameter is used for pagination, allowing you to
 * fetch subsequent pages of results by providing the cursor from the previous response.
 *
 * ### Filtering by Bot or Status
 *
 * You can filter tasks by associated bot or by their status:
 *
 * ```http
 * GET /api/v1/task/list?botId=bot_abc123
 * GET /api/v1/task/list?status=running
 * GET /api/v1/task/list?botId=bot_abc123&status=running
 * ```
 *
 * Supported filter parameters include:
 *
 * - **botId**: Filter by associated bot
 * - **contactId**: Filter by associated contact
 * - **status**: Filter by task status (`idle`, `running`, or `canceled`)
 *
 * Each task object in the response includes essential fields like `id`, `name`,
 * `description`, `schedule`, `timezone`, `botId`, `contactId`, `sessionDuration`, `maxIterations`,
 * `maxTime`, `lastRunAt`, `nextRunAt`, and timestamps. You can use this
 * information to display task dashboards, monitor active automation workflows, or
 * build management interfaces for your task automation system.
 *
 * **Note:** Tasks are automatically filtered to show only those belonging to your
 * account. Pagination cursors are designed for forward traversal through your task
 * collection.
 */
