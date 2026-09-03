// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /task/{taskId}/fetch:
 *   get:
 *     operationId: fetchTask
 *     summary: Fetch task
 *     tags:
 *       - Task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           description: The ID of the task to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The task was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - type: object
 *                   properties:
 *                     blueprintId:
 *                       type: string
 *                       description: The blueprint associated with the task
 *                     contactId:
 *                       type: string
 *                       description: The contact associated with the task
 *                     botId:
 *                       type: string
 *                       description: The bot associated with the task
 *                     schedule:
 *                       type: string
 *                       description: The schedule of the task
 *                     timezone:
 *                       type: string
 *                       nullable: true
 *                       description: The IANA timezone identifier used to evaluate the task schedule.
 *                     sessionDuration:
 *                       description: The session duration of the task execution (in milliseconds)
 *                       type: number
 *                       nullable: true
 *                     maxIterations:
 *                       description: The maximum number of iterations per task execution
 *                       type: number
 *                     maxTime:
 *                       description: The maximum time per task execution (in milliseconds)
 *                       type: number
 *                     status:
 *                       $ref: '#/components/schemas/TaskStatus'
 *                     outcome:
 *                       $ref: '#/components/schemas/TaskOutcome'
 *                     lastRunAt:
 *                       description: The timestamp (ms) of the last task execution
 *                       type: number
 *                       nullable: true
 *                     nextRunAt:
 *                       description: The timestamp (ms) of the next scheduled task execution
 *                       type: number
 *                       nullable: true
 *                     expiresAt:
 *                       description: The timestamp (ms) at which the task expires and is automatically deleted
 *                       type: number
 *                       nullable: true
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const task = await prisma.task.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'taskId'),
      {
        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          userId: true,

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
      }
    )

    if (!task) {
      return notFound()
    }

    if (task.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (task).userId)

    return ok(makeJsonSafe(task))
  })
)

/**
 * @manual Tasks
 * @index 20
 *
 * ## Fetching a Task
 *
 * Retrieving a specific task by its ID allows you to inspect the complete configuration
 * and current state of an automated workflow. This is essential for monitoring task
 * execution, debugging scheduling issues, or displaying task details in user interfaces.
 *
 * The fetch endpoint returns comprehensive information about a single task, including
 * all configuration parameters, schedule settings, associated resources (bot and contact
 * IDs), and metadata. This detailed view enables you to verify task configuration,
 * check execution status, and ensure your automation workflows are properly configured.
 *
 * To retrieve a specific task, use its unique identifier:
 *
 * ```http
 * GET /api/v1/task/{taskId}/fetch
 * ```
 *
 * For example, to fetch a task with ID "task_abc123":
 *
 * ```http
 * GET /api/v1/task/task_abc123/fetch
 * ```
 *
 * The response includes all task properties such as `name`, `description`, `schedule`,
 * `timezone`, `botId`, `contactId`, `status`, `outcome`, `sessionDuration`, `maxIterations`,
 * `maxTime`, `lastRunAt`, `nextRunAt`, and `meta`, along with timestamps indicating
 * when the task was created and last updated.
 *
 * This endpoint is particularly useful when you need to display task details in a
 * management interface, verify task configuration before making updates, or retrieve
 * task metadata for monitoring and logging purposes. The returned data provides
 * everything needed to understand and manage the automated workflow.
 */
