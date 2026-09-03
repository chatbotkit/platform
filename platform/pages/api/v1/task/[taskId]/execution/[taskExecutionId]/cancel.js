// @ts-check
import prisma from '@/prisma/client'
import { TaskOutcome, TaskStatus } from '@/prisma/types'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { getNext } from '@/lib/task.schedule'

const TASK_EXECUTION_CANCELED_SUMMARY = 'Task execution canceled'

/**
 * @swagger
 *
 * /task/{taskId}/execution/{taskExecutionId}/cancel:
 *   post:
 *     operationId: cancelTaskExecution
 *     summary: Cancel a task execution
 *     tags:
 *       - Task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           description: The ID of the task
 *           type: string
 *       - in: path
 *         name: taskExecutionId
 *         required: true
 *         schema:
 *           description: The ID of the task execution to cancel
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The task execution was canceled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the canceled task execution
 *                   type: string
 *                 taskId:
 *                   description: The ID of the parent task
 *                   type: string
 *               required:
 *                 - id
 *                 - taskId
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const taskId = requiredUrlParam(req, 'taskId')
    const taskExecutionId = requiredUrlParam(req, 'taskExecutionId')

    const task = await prisma.task.findUniqueByIdentifier(
      session.user,
      taskId,
      {
        select: {
          id: true,
          userId: true,
          schedule: true,
          timezone: true,
        },
      }
    )

    if (!task) {
      return notFound()
    }

    if (task.userId !== session.user.id) {
      return notAuthorized()
    }

    const taskExecution = await prisma.taskExecution.findUnique({
      where: {
        id: taskExecutionId,
      },
      select: {
        id: true,
        taskId: true,
        userId: true,
        status: true,
      },
    })

    if (
      !taskExecution ||
      taskExecution.taskId !== task.id ||
      taskExecution.userId !== session.user.id
    ) {
      return notFound()
    }

    const completedAt = new Date()
    const nextRunAt = task.schedule
      ? getNext(task.schedule, { timezone: task.timezone })
      : null

    if (taskExecution.status === TaskStatus.running) {
      await prisma.taskExecution.update({
        where: {
          id: taskExecution.id,
        },
        data: {
          status: TaskStatus.canceled,
          outcome: TaskOutcome.failure,
          completedAt,
          summary: TASK_EXECUTION_CANCELED_SUMMARY,
        },
      })

      await prisma.task.updateMany({
        where: {
          id: task.id,
          status: TaskStatus.running,
        },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          nextRunAt: nextRunAt && nextRunAt > new Date() ? nextRunAt : null,
        },
      })
    }

    return ok({
      id: taskExecution.id,
      taskId: task.id,
    })
  })
)

/**
 * @manual Tasks
 * @index 55
 *
 * ## Canceling a Specific Task Execution
 *
 * When a task spawns multiple executions or you need precise control over which
 * execution to stop, the execution cancel endpoint lets you target a specific
 * task execution by its ID rather than canceling all running executions for a
 * task at once. This is particularly useful when a task has a history of
 * executions and you need to cancel only the currently running one without
 * affecting the task configuration or scheduling.
 *
 * The endpoint cancels the specified execution if it is in a running state,
 * marking it with a `canceled` status and `failure` outcome. At the same time,
 * the parent task's status is updated to idle and its next scheduled run time
 * is recalculated if a schedule is configured. If the specified execution is
 * not currently running, the operation completes successfully with no changes.
 *
 * To cancel a specific task execution, send a POST request:
 *
 * ```http
 * POST /api/v1/task/{taskId}/execution/{taskExecutionId}/cancel
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * For example, to cancel execution "exec_xyz789" belonging to task "task_abc123":
 *
 * ```http
 * POST /api/v1/task/task_abc123/execution/exec_xyz789/cancel
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The response returns both the execution ID and the parent task ID:
 *
 * ```json
 * {
 *   "id": "exec_xyz789",
 *   "taskId": "task_abc123"
 * }
 * ```
 *
 * The endpoint validates that the execution belongs to the specified task and
 * that both resources are owned by the authenticated user. Attempting to cancel
 * an execution that belongs to a different task, or that was created by another
 * user, returns a not found error.
 *
 * **Difference from Task Cancel:**
 *
 * - `/task/{taskId}/cancel` - Cancels all running executions for the task
 * - `/task/{taskId}/execution/{taskExecutionId}/cancel` - Cancels only the
 *   specified execution, offering finer-grained control
 *
 * **Note:** Viewing the list of executions via
 * `GET /api/v1/task/{taskId}/execution/list` helps you identify the correct
 * execution ID to cancel, especially when a task has multiple execution records.
 */
