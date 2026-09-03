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
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /task/{taskId}/execution/list:
 *   get:
 *     operationId: listTaskExecutions
 *     summary: List task executions
 *     tags:
 *       - Task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           description: The ID of the task
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
 *         name: status
 *         schema:
 *           description: Filter by execution status
 *           type: string
 *           enum:
 *             - idle
 *             - running
 *             - canceled
 *       - in: query
 *         name: meta
 *         schema:
 *           description: Key-value pairs to filter by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
 *     responses:
 *       200:
 *         description: The list of task executions was retrieved successfully
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
 *                           taskId:
 *                             type: string
 *                             description: The task this execution belongs to
 *                           conversationId:
 *                             type: string
 *                             description: The conversation associated with this execution
 *                           status:
 *                             $ref: '#/components/schemas/TaskStatus'
 *                           outcome:
 *                             $ref: '#/components/schemas/TaskOutcome'
 *                           summary:
 *                             type: string
 *                             description: A summary of the execution result
 *                           completedAt:
 *                             type: string
 *                             format: date-time
 *                             description: When the execution completed
 *                           resumeAt:
 *                             type: string
 *                             format: date-time
 *                             description: When a paused run is expected to resume; null while actively running
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
 *                       $ref: '#/paths/~1task~1{taskId}~1execution~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const taskId = requiredUrlParam(req, 'taskId')

      const task = await prisma.task.findUniqueByIdentifier(
        session.user,
        taskId,
        { select: { id: true, userId: true } }
      )

      if (!task) {
        return throwNotFound()
      }

      if (task.userId !== session.user.id) {
        return throwNotAuthorized()
      }

      const executions = await prisma.taskExecution.findMany({
        where: {
          AND: [
            { taskId: task.id },
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').TaskExecution>} */ (
              getFieldQueryFilter
            )(req, ['status']),
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

          taskId: true,

          conversationId: true,

          // resource specific

          status: true,
          outcome: true,

          summary: true,

          completedAt: true,

          resumeAt: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(executions),
      }
    })
  )
)

/**
 * @manual Tasks
 * @index 50
 *
 * ## Listing Task Executions
 *
 * Each time a task runs it produces a task execution record that captures the
 * outcome, timing, and any summary produced by the agent. Listing executions
 * for a task gives you a full history of every run, making it straightforward
 * to audit automation activity, debug failures, or display a run log in your
 * application.
 *
 * To retrieve executions for a task, send a GET request:
 *
 * ```http
 * GET /api/v1/task/{taskId}/execution/list
 * ```
 *
 * The response supports the same cursor-based pagination as other list endpoints:
 *
 * ```http
 * GET /api/v1/task/{taskId}/execution/list?take=50&order=desc&cursor=<cursor>
 * ```
 *
 * You can filter by execution status:
 *
 * ```http
 * GET /api/v1/task/{taskId}/execution/list?status=running
 * ```
 *
 * Each execution record includes:
 *
 * - **`id`**: Unique execution identifier
 * - **`taskId`**: The parent task
 * - **`conversationId`**: The conversation created for this run (if any)
 * - **`status`**: Current status (`idle`, `running`, or `canceled`)
 * - **`outcome`**: Final outcome (`pending`, `success`, or `failure`)
 * - **`summary`**: Agent-generated summary of what happened during the run
 * - **`completedAt`**: Timestamp when the execution finished
 * - **`resumeAt`**: When a paused run is expected to resume, or `null` while it is
 *   actively running. A `running` execution with a `resumeAt` in the future is
 *   paused (waiting out a usage-policy block or an agent-requested delay) - poll
 *   again after that time rather than treating the run as stuck.
 */
