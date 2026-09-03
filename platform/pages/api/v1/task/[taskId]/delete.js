// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /task/{taskId}/delete:
 *   post:
 *     operationId: deleteTask
 *     summary: Delete task
 *     tags:
 *       - Task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           description: The ID of the task to delete
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
 *         description: The task was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted task
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
        },
      }
    )

    if (!task) {
      return notFound()
    }

    if (task.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.task.delete({
      where: {
        id: task.id,
      },
    })

    return ok({ id: task.id })
  })
)

/**
 * @manual Tasks
 * @index 40
 *
 * ## Deleting a Task
 *
 * Removing a task permanently deletes the automation workflow and stops all future
 * executions. This operation is irreversible and should be used when a task is no
 * longer needed or needs to be completely removed from your automation configuration.
 *
 * When a task is deleted, the system immediately stops scheduling it for future
 * execution. Any pending executions that haven't started yet will be cancelled.
 * However, if the task is currently executing at the time of deletion, that execution
 * will be allowed to complete before the task is fully removed.
 *
 * Deleting a task does not affect the associated bot or any conversations that were
 * created by the task. These resources remain intact and can continue to be used by
 * other tasks or directly through the API. Only the task automation configuration
 * itself is removed.
 *
 * To delete a task, send a POST request with an empty body:
 *
 * ```http
 * POST /api/v1/task/{taskId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * For example, to delete a task with ID "task_abc123":
 *
 * ```http
 * POST /api/v1/task/task_abc123/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The endpoint returns the ID of the deleted task in the response, confirming the
 * deletion was successful. After deletion, attempting to fetch, update, or trigger
 * the task will result in a "not found" error.
 *
 * **Warning:** This operation cannot be undone. If you need to preserve task
 * configuration for future reference, consider exporting your tasks before deletion
 * or temporarily disabling the task by setting its schedule to "never" instead of
 * deleting it entirely. Always verify you're deleting the correct task before
 * confirming the operation.
 */
