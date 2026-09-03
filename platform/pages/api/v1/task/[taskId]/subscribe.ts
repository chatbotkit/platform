import prisma from '@/prisma/client'

import { withStream } from '@/lib/stream'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { canUseTask } from '@/lib/task.access'
import {
  TASK_WORKFLOW_CHANNEL_HISTORY_LENGTH,
  type TaskWorkflowEvent,
  pipeTaskWorkflowEventsToStream,
} from '@/lib/task.workflow.channel'

// --- Body Schema ---

export const bodySchema = schema.object({
  historyLength: schema
    .number()
    .integer()
    .min(0)
    .max(TASK_WORKFLOW_CHANNEL_HISTORY_LENGTH)
    .optional(),
})

// --- Types & Interfaces ---

type SubscribeTaskWorkflowEventsStreamEvent = {
  type: TaskWorkflowEvent['type']
  data: TaskWorkflowEvent['data']
  createdAt: TaskWorkflowEvent['createdAt']
}

type SubscribeTaskWorkflowEventsPipe = (
  userId: string,
  taskId: string,
  stream: {
    push: (event: SubscribeTaskWorkflowEventsStreamEvent) => Promise<void>
    abortSignal: AbortSignal
  },
  options?: {
    historyLength?: number
  }
) => Promise<void>

const pipeSubscribeTaskWorkflowEvents =
  pipeTaskWorkflowEventsToStream satisfies SubscribeTaskWorkflowEventsPipe

// --- API Route Handler ---

/**
 * @swagger
 *
 * /task/{taskId}/subscribe:
 *   post:
 *     operationId: subscribeTaskWorkflowEvents
 *     summary: Subscribe to task workflow events
 *     description: |
 *       Subscribe to real-time task workflow events. The stream currently
 *       includes operation begin, operation end, and error events emitted by
 *       the task's conversation engine while a task execution is running. The
 *       response uses the same streaming envelope shape as conversation
 *       completion endpoints: each line is an event with a `type`, `createdAt`,
 *       and `data`.
 *     tags:
 *       - Task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           description: The ID of the task
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               historyLength:
 *                 description: Number of recent workflow events to replay before live events.
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 1000
 *     responses:
 *       200:
 *         description: Successfully subscribed to task workflow events
 *         content:
 *           application/jsonl:
 *             schema:
 *               $ref: '#/components/schemas/TaskWorkflowStreamingResponseItem'
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(
      bodySchema,
      withStream(async function (req, stream, session, body) {
        const taskId = requiredUrlParam(req, 'taskId')

        const task = await prisma.task.findUniqueByIdentifier(
          session.user,
          taskId,
          {
            select: {
              id: true,
              userId: true,
            },
          }
        )

        if (!task) {
          throwNotFound()
        }

        if (!canUseTask(session.user.id, task)) {
          throwNotAuthorized()
        }

        await pipeSubscribeTaskWorkflowEvents(
          session.user.id,
          task.id,
          stream,
          {
            historyLength: body.historyLength,
          }
        )
      })
    )
  )
)

/**
 * @manual Tasks
 * @index 60
 *
 * ## Subscribing to Task Workflow Events
 *
 * The task workflow subscription endpoint provides a real-time stream of
 * events emitted while a task is executing. This allows you to observe the
 * progress of a running task execution as it moves through its workflow steps,
 * enabling live status displays, progress indicators, and reactive dashboards
 * without polling.
 *
 * Each event in the stream follows the same newline-delimited JSON envelope
 * used by conversation completion endpoints. Every line is a self-contained
 * JSON object with a `type` field identifying the event, a `createdAt`
 * timestamp, and a `data` field carrying the event payload. The stream remains
 * open for the duration of the subscription and closes automatically when the
 * client disconnects.
 *
 * ```http
 * POST /api/v1/task/{taskId}/subscribe
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * ### Event Types
 *
 * The stream emits event types that correspond to steps within the task's
 * conversation engine:
 *
 * - **`operationBegin`** - Emitted when the conversation engine starts a new
 *   operation step, such as calling a tool, running an ability, or making a
 *   model request. The `data` object contains details about the operation that
 *   is beginning.
 * - **`operationEnd`** - Emitted when an operation step completes, whether
 *   successfully or with an error. The `data` object contains the result or
 *   error information for the completed step.
 * - **`error`** - Emitted when the task conversation engine reports an error.
 *   The `data` object matches the conversation completion error event data.
 *
 * Pairing `operationBegin` and `operationEnd` events lets you build accurate
 * progress indicators that show exactly which step is in flight and how long
 * each step takes to complete.
 *
 * ### Replaying Recent History
 *
 * By default the subscription only delivers live events from the moment you
 * connect. If you want to catch up on events that occurred before your
 * connection was established - for example when reconnecting after a brief
 * network interruption - you can request a history replay by including
 * `historyLength` in the request body:
 *
 * ```http
 * POST /api/v1/task/{taskId}/subscribe
 * Content-Type: application/json
 *
 * { "historyLength": 50 }
 * ```
 *
 * The server will replay up to the requested number of recent workflow events
 * before switching to the live stream. The maximum accepted value is 1000.
 * Setting `historyLength` to `0` is equivalent to the default behavior of
 * delivering only live events.
 *
 * ### Reading the Event Stream
 *
 * Because the response uses newline-delimited JSON (JSONL), you should read it
 * line by line. Each complete line is a valid JSON object that can be parsed
 * independently:
 *
 * ```http
 * POST /api/v1/task/{taskId}/subscribe
 * Accept: application/jsonl
 * Content-Type: application/json
 *
 * { "historyLength": 10 }
 * ```
 *
 * An example sequence of events in the stream might look like:
 *
 * ```jsonl
 * {"type":"operationBegin","createdAt":1710000000000,"data":{"id":"op_1","action":{"id":"act_1","kind":"function","name":"web_search","input":{"query":"current weather"}}}}
 * {"type":"operationEnd","createdAt":1710000000843,"data":{"id":"op_1","action":{"id":"act_1","kind":"function","name":"web_search"}}}
 * {"type":"error","createdAt":1710000000900,"data":{"code":"TOOL_FAILED","message":"Tool failed"}}
 * {"type":"operationBegin","createdAt":1710000001200,"data":{"id":"op_2","action":{"id":"act_2","name":"modelRequest"}}}
 * {"type":"operationEnd","createdAt":1710000002404,"data":{"id":"op_2","action":{"id":"act_2","name":"modelRequest"}}}
 * ```
 *
 * ### Access Control
 *
 * Only authenticated users who own the task may subscribe to its workflow
 * events. Attempting to subscribe to a task that belongs to another user
 * returns a 401 Unauthorized response. Tasks that do not exist return a
 * 404 Not Found response.
 *
 * **Note:** The subscription stream reflects events from the task's active
 * execution. If the task is not currently running when you connect, the stream
 * will remain open and deliver events as soon as a new execution begins. This
 * allows you to connect proactively before triggering the task and receive the
 * full event sequence from the start of execution.
 */
