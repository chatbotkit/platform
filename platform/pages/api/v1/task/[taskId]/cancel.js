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
 * /task/{taskId}/cancel:
 *   post:
 *     operationId: cancelTask
 *     summary: Cancel a running task
 *     tags:
 *       - Task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           description: The ID of the task to cancel
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
 *         description: The task was canceled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the canceled task
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const task = await prisma.task.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'taskId'),
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

    const completedAt = new Date()
    const nextRunAt = task.schedule
      ? getNext(task.schedule, { timezone: task.timezone })
      : null

    await prisma.taskExecution.updateMany({
      where: {
        taskId: task.id,
        userId: session.user.id,
        status: TaskStatus.running,
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

    return ok({ id: task.id })
  })
)

/**
 * @manual Tasks
 * @index 45
 *
 * ## Canceling a Running Task
 *
 * When a task is currently executing and you need to stop it immediately, the
 * cancel endpoint provides a way to halt the running execution and return the task
 * to an idle state. This is useful for stopping long-running tasks, correcting
 * mistakes, or responding to changing requirements without waiting for the task
 * to complete naturally.
 *
 * Canceling a task marks all currently running executions for that task as
 * canceled with a failure outcome. The task itself transitions back to an idle
 * status, and if the task has a schedule configured, the next scheduled run time
 * is recalculated and set appropriately so the task will continue its regular
 * schedule going forward. If the task has a `timezone` configured, that
 * timezone is reused when calculating the next scheduled run.
 *
 * To cancel a running task, send a POST request with an empty body:
 *
 * ```http
 * POST /api/v1/task/{taskId}/cancel
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * For example, to cancel a task with ID "task_abc123":
 *
 * ```http
 * POST /api/v1/task/task_abc123/cancel
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The response returns the ID of the task that was canceled:
 *
 * ```json
 * {
 *   "id": "task_abc123"
 * }
 * ```
 *
 * If the task is not currently running (already idle or in another non-running
 * state), the cancel operation completes successfully without making changes.
 * This makes the endpoint safe to call even when you are unsure whether the
 * task is actually running.
 *
 * **Use Cases:**
 *
 * - Stopping a task that is taking longer than expected
 * - Interrupting a task that was triggered with incorrect configuration
 * - Responding to errors or rate limits that require immediate task termination
 * - Cleaning up state before making configuration changes to a task
 *
 * **Note:** Canceling a task does not delete it. The task remains in your
 * configuration and will continue running on its schedule if one is configured.
 * Canceled executions are recorded in the execution history with a `canceled`
 * status and `failure` outcome for auditing purposes.
 */
