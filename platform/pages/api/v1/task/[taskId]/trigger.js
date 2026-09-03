// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { canUseTask } from '@/lib/task.access'

import { executeTask } from '@/pages/api/v1/task/[taskId]/workflow'

export const bodySchema = schema.object({})

/**
 * @swagger
 *
 * /task/{taskId}/trigger:
 *   post:
 *     operationId: triggerTask
 *     summary: Trigger a task
 *     description: |
 *       Manually trigger a task to execute immediately.
 *     tags:
 *       - Task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: The request body for triggering a task
 *             properties: {}
 *     responses:
 *       200:
 *         description: The task was triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the triggered task
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session) {
      const taskId = requiredUrlParam(req, 'taskId')

      const task = await prisma.task.findUniqueByIdentifier(
        session.user,
        taskId
      )

      if (!task) {
        return notFound()
      }

      if (!canUseTask(session.user.id, task)) {
        return notAuthorized()
      }

      await executeTask(task.id)

      return ok({
        id: task.id,

        // @todo should return the conversation ID for tracking the triggered task execution
      })
    })
  )
)

/**
 * @manual Tasks
 * @index 50
 *
 * ## Triggering a Task
 *
 * Manually triggering a task executes it immediately, bypassing the configured schedule.
 * This is valuable for running tasks on-demand in response to external events or
 * executing workflows outside their normal schedule without modifying the task
 * configuration.
 *
 * When you trigger a task, it queues for immediate execution while maintaining its
 * regular schedule for future automated runs. The trigger operation doesn't modify the
 * task's schedule or next run time - it simply creates an additional execution
 * instance that runs as soon as resources are available.
 *
 * Task triggering is asynchronous. The API endpoint queues the task for execution and
 * returns immediately, confirming that the trigger request was received. The actual
 * task execution happens in the background, creating a conversation with the configured
 * bot and processing the task's instructions.
 *
 * To trigger a task manually, send a POST request:
 *
 * ```http
 * POST /api/v1/task/{taskId}/trigger
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * For example, to trigger a task with ID "task_abc123":
 *
 * ```http
 * POST /api/v1/task/task_abc123/trigger
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The task executes with the same configuration and context as scheduled runs, including
 * the associated bot, contact, session duration, and any configured metadata. The
 * execution creates or reuses a conversation session according to the task's session
 * management settings.
 *
 * **Use Cases:** Manual triggering is ideal for responding to external events like
 * webhooks or user actions, running maintenance tasks on-demand, or executing tasks
 * that don't require a regular schedule. The `lastRunAt` timestamp is updated when
 * triggered executions complete.
 *
 * **Note:** Task triggering is subject to your account's conversation limits and
 * plan restrictions. Ensure you have sufficient quota before triggering tasks,
 * especially when triggering multiple tasks simultaneously.
 */
