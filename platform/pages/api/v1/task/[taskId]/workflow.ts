import { clamp } from '@chatbotkit-dev/math'
import { template as t } from '@chatbotkit-dev/template'
import {
  FIVE_MINUTE_IN_SECONDS,
  ONE_HOUR_IN_MILLISECONDS,
  getShortDateTime,
  getTimezone,
  roundToNearestNMinutes,
} from '@chatbotkit-dev/time'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils'

import { DEFAULT_LIMITS, PLATFORM_LIMITS } from '@/config/execution'

import prisma from '@/prisma/client'
import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'
import { TaskOutcome, TaskStatus } from '@/prisma/types'

import { withPeriodicAbortCheck } from '@/lib/abort'
import { makeActivityMessagePair } from '@/lib/activity'
import { getBotBlock } from '@/lib/bot.block'
import { getConversationDetails } from '@/lib/bot.conversation'
import { setContextUser } from '@/lib/context.store'
import { createConversation } from '@/lib/conversation.create'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import type { Feature } from '@/lib/conversation.features'
import { hasConversation } from '@/lib/conversation.find'
import { stringToDbString } from '@/lib/db.string'
import debug from '@/lib/debug'
import { captureError } from '@/lib/error'
import { extractData } from '@/lib/extract.data'
import { setupFrontendHostContext } from '@/lib/integration.context'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import { updateSessionStore } from '@/lib/session.context'
import { resolveSessionDuration } from '@/lib/session.duration'
import { getNext } from '@/lib/task.schedule'
import { createTaskWorkflowOperationSink } from '@/lib/task.workflow.channel'
import { userToSessionUser } from '@/lib/user.session'
import {
  WorkflowAbortError,
  type WorkflowHandlerContext,
  type WorkflowHandlerResult,
  sendWorkflowEvent,
  withWorkflowHandler,
} from '@/lib/workflow'
import { z } from '@/lib/zod.schema'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const ROUTE = '/api/v1/task/-/workflow' as const

const MAX_SUMMARY_MESSAGE_TAKE = 100

const MAX_DELAY_SECONDS = FIVE_MINUTE_IN_SECONDS

const MAX_ITERATIONS_PER_STEP = 1

const TASK_RUN_PROGRESS_THRESHOLDS = [50, 80, 90] as const

const TASK_EXECUTION_CANCEL_CHECK_INTERVAL_MS = 5000

const GET_TASK_DETAILS_ACTIVITY = '_getTaskDetails'

const CHECK_TASK_RUN_STATUS_ACTIVITY = '_checkTaskRunStatus'

// @note when we wait out a usage-policy bot block, resume a few seconds *after*
// the block's TTL so the resumed step doesn't race the block's expiry.
const BLOCK_RESUME_BUFFER_SECONDS = 5

// @note liveness grace window. Each work step pushes the execution's
// `keepAliveUntil` deadline this far into the future (and a pause adds the pause
// duration on top), so the reaper only reaps a run once it has blown past its
// own deadline - i.e. the workflow stopped touching it. Kept at one hour to
// match the reaper's own legacy fallback window.
const KEEP_ALIVE_GRACE_MS = ONE_HOUR_IN_MILLISECONDS

// -----------------------------------------------------------------------------
// State Schema
// -----------------------------------------------------------------------------

const BeginStateSchema = z.object({
  stage: z.literal('begin'),
  taskId: z.string(),
})

const WorkStateSchema = z.object({
  stage: z.literal('work'),
  taskId: z.string(),
  taskExecutionId: z.string(),
  conversationId: z.string(),
  startMessageId: z.string().nullable(),
  maxIterations: z.number().nullable().optional(),
  maxTime: z.number().nullable().optional(),
  maxCalls: z.number().nullable().optional(),
  callCount: z.number().optional(),
  iterationCount: z.number().optional(),
  startedAt: z.number().optional(),
  notifiedThresholds: z.array(z.number()).optional(),
})

const EndStateSchema = z.object({
  stage: z.literal('end'),
  taskId: z.string(),
  taskExecutionId: z.string(),
  conversationId: z.string(),
  startMessageId: z.string().nullable(),
  endMessageId: z.string().nullable(),
})

const FailureStateSchema = z.object({
  stage: z.literal('failure'),
  taskId: z.string(),
  taskExecutionId: z.string().nullable(),
  conversationId: z.string().nullable(),
  startMessageId: z.string().nullable(),
  endMessageId: z.string().nullable(),
  errorMessage: z.string().optional(),
})

const StateSchema = z.discriminatedUnion('stage', [
  BeginStateSchema,
  WorkStateSchema,
  EndStateSchema,
  FailureStateSchema,
])

type BeginState = z.infer<typeof BeginStateSchema>
type WorkState = z.infer<typeof WorkStateSchema>
type EndState = z.infer<typeof EndStateSchema>
type FailureState = z.infer<typeof FailureStateSchema>
type State = z.infer<typeof StateSchema>

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getTaskRunFeatures(): Feature[] {
  return [
    // @note `settle` makes the engine treat a turn that ends without the agent
    // calling `_success` / `_failure` as an unsettled continuation: it nudges
    // the agent and surfaces the turn as an `iteration`, which the work loop
    // below drives onward, bounded by the task's maxIterations / maxTime.

    { name: 'batch', options: { settle: true } },

    {
      name: 'notes',
      options: {
        notes: [
          `This task conversation can contain multiple independent task runs. Each run is a fresh turn that begins with the latest ${GET_TASK_DETAILS_ACTIVITY} activity and ends when a ${CHECK_TASK_RUN_STATUS_ACTIVITY} checkpoint records a terminal status; a single turn can contain several ${CHECK_TASK_RUN_STATUS_ACTIVITY} progress checkpoints along the way. Checkpoints with complete, limit_exceeded, or aborted status close previous turns. A checkpoint with a paused status means the run was deliberately paused for the stated number of seconds and has since resumed, so account for that elapsed wall-clock time and continue the current turn. Treat earlier turns and their results as historical context only: even when a previous turn already completed the same task, you must still execute the current turn that begins at the latest ${GET_TASK_DETAILS_ACTIVITY} activity rather than assuming the work is already done.`,

          `Follow the instructions in the ${GET_TASK_DETAILS_ACTIVITY} activity. Do not make assumptions about the task.`,
        ],
      },
    },
  ]
}

async function isTaskExecutionCanceled(
  taskExecutionId: string | null
): Promise<boolean> {
  if (!taskExecutionId) {
    return false
  }

  const taskExecution = await prisma.taskExecution.findUnique({
    where: { id: taskExecutionId },
    select: { status: true },
  })

  return taskExecution?.status === TaskStatus.canceled
}

async function abortIfTaskExecutionCanceled(
  taskExecutionId: string | null
): Promise<void> {
  if (await isTaskExecutionCanceled(taskExecutionId)) {
    throw new WorkflowAbortError('Task execution canceled')
  }
}

function normalizeExecutionLimit(
  value: number | null | undefined,
  defaultValue: number,
  minValue: number,
  maxValue: number
): number {
  if (value == null || value < minValue) {
    return defaultValue
  }

  return clamp(value, minValue, maxValue)
}

function getProgressRatio(current: number, max: number): number {
  if (max <= 0) {
    return 0
  }

  return clamp(current / max, 0, 1)
}

function getNewTaskRunProgressThresholds({
  currentIteration,
  maxIterations,
  elapsedTimeMs,
  maxTimeMs,
  notifiedThresholds,
}: {
  currentIteration: number
  maxIterations: number
  elapsedTimeMs: number
  maxTimeMs: number
  notifiedThresholds: number[]
}): Array<(typeof TASK_RUN_PROGRESS_THRESHOLDS)[number]> {
  const iterationProgress = getProgressRatio(currentIteration, maxIterations)
  const timeProgress = getProgressRatio(elapsedTimeMs, maxTimeMs)

  return TASK_RUN_PROGRESS_THRESHOLDS.filter((threshold) => {
    if (notifiedThresholds.includes(threshold)) {
      return false
    }

    const progressThreshold = threshold / 100

    return (
      iterationProgress >= progressThreshold ||
      timeProgress >= progressThreshold
    )
  })
}

function getTaskSessionKey(task: {
  id: string
  bot?: { id: string } | null
}): string {
  return `task-session-${task.id}-${task.bot?.id || 'default'}`
}

/**
 * How many seconds the task's conversation session is still good for, i.e. the
 * live TTL of its session→conversation mapping. `0` when there is no session
 * (sessionDuration === 0) or the mapping has already expired. Used to decide
 * whether a bot block will lift while the conversation context still exists.
 */
async function getRemainingSessionSeconds(task: {
  id: string
  sessionDuration: number | null
  bot?: { id: string } | null
}): Promise<number> {
  const { persist } = resolveSessionDuration(task.sessionDuration)

  if (!persist) {
    return 0
  }

  const ttl = await memcache.ttl(getTaskSessionKey(task))

  return ttl > 0 ? ttl : 0
}

export async function getSessionConversationId(task: {
  id: string
  userId: string
  name: string
  description: string | null
  sessionDuration: number | null
  contactId: string | null
  meta: unknown
  bot?: {
    id: string
  } | null
}): Promise<string> {
  const sessionKey = getTaskSessionKey(task)

  const { persist, ttlSecs } = resolveSessionDuration(task.sessionDuration)

  // @note when `persist` is false (sessionDuration === 0, "no session") we
  // never look up or store the mapping, so every run starts a fresh
  // conversation.
  let conversationId = persist
    ? ((await memcache.get(sessionKey)) as string | null)
    : null

  if (!conversationId || !(await hasConversation(conversationId))) {
    const { id: cid } = await createConversation(task.userId, {
      name: task.name,
      description: task.description,

      contactId: task.contactId ?? undefined,
      taskId: task.id,
      botId: task.bot?.id,

      ...getConversationDetails(task),

      meta: {
        app: 'task',
        taskId: task.id,
        // @ts-ignore meta is JsonValue
        namespace: task.meta?.namespace,
      },
    })

    conversationId = cid

    if (persist) {
      await memcache.set(sessionKey, conversationId, {
        ex: ttlSecs,
      })
    }

    return conversationId
  }

  if (task.bot) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    })

    if (conversation?.botId !== task.bot.id) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { botId: task.bot.id },
      })
    }
  }

  return conversationId
}

// -----------------------------------------------------------------------------
// Pause Activity
// -----------------------------------------------------------------------------

/**
 * Record a `paused` checkpoint in the task conversation so a resumed run can see
 * that execution was deliberately paused, and for how long, instead of facing an
 * unexplained wall-clock gap. Opens its own short-lived engine because some
 * pause points (a usage-policy bot block) sit outside the per-step engine block.
 *
 * Best-effort: an injection failure must not block the pause itself.
 */
async function addTaskRunPausedActivity({
  conversationId,
  userId,
  seconds,
  source,
  reason,
}: {
  conversationId: string
  userId: string
  seconds: number
  source: string
  reason?: string
}): Promise<void> {
  try {
    const engine = await getStatefulConversationEngine({
      conversationId,
      options: {
        userId,
        features: getTaskRunFeatures(),
      },
    })

    try {
      await engine.addMessages(
        makeActivityMessagePair(
          CHECK_TASK_RUN_STATUS_ACTIVITY,
          {},
          reason
            ? { status: 'paused', source, seconds, reason }
            : { status: 'paused', source, seconds }
        )
      )
    } finally {
      await engine.dispose()
    }
  } catch (e) {
    await captureError(e)
  }
}

// -----------------------------------------------------------------------------
// Stalled Heartbeat
// -----------------------------------------------------------------------------

/**
 * Push the execution's `keepAliveUntil` deadline forward so the stalled reaper
 * can tell an actively-progressing (or deliberately paused) run apart from a
 * genuinely stuck one. Called on every work step with the base grace window, and
 * with the pause duration added on top whenever we re-queue a delayed step so
 * the wait does not itself look like a stall.
 *
 * The same call maintains the API-facing `resumeAt`: `extraDelayMs > 0` means we
 * are pausing, so it records when the run is expected to resume (`now + delay`);
 * a plain step (`extraDelayMs === 0`) clears it, so `resumeAt` is non-null only
 * while a run is actually paused.
 *
 * Best-effort: a heartbeat failure must not break the step. If it silently
 * fails the worst case is the reaper's normal window applies, i.e. we regress to
 * the prior behaviour rather than break the run.
 */
async function heartbeatTaskExecution(
  taskExecutionId: string,
  extraDelayMs = 0
): Promise<void> {
  try {
    const now = Date.now()

    await prisma.taskExecution.update({
      where: { id: taskExecutionId },
      data: {
        resumeAt: extraDelayMs > 0 ? new Date(now + extraDelayMs) : null,
        keepAliveUntil: new Date(now + extraDelayMs + KEEP_ALIVE_GRACE_MS),
      },
    })
  } catch (e) {
    await captureError(e)
  }
}

// -----------------------------------------------------------------------------
// Stage Handlers
// -----------------------------------------------------------------------------

async function handleBegin(
  state: BeginState,
  _context: WorkflowHandlerContext
): Promise<WorkflowHandlerResult<WorkState | FailureState>> {
  debug(`begin`, { taskId: state.taskId }).log(
    'task.workflow.execute.handleBegin'
  )

  const task = await prisma.task.findUnique({
    where: { id: state.taskId },
    include: {
      user: true,
      bot: true,
    },
  })

  if (!task) {
    throw new WorkflowAbortError(`Task not found: ${state.taskId}`)
  }

  if (!task.bot) {
    await logEvent({
      name: 'Task interact aborted',
      description: 'No bot configured for task',
      user: { id: task.userId },
      type: 'task.interact.aborted',
      relations: {
        taskId: task.id,
      },
    })

    throw new WorkflowAbortError(`No bot configured for task: ${state.taskId}`)
  }

  // @note early exit optimization - the atomic updateMany below is the
  // authoritative check

  if (task.status === TaskStatus.running) {
    await logEvent({
      name: 'Task interact skipped',
      description: 'Task is already running',
      user: { id: task.userId },
      type: 'task.interact.skipped',
      relations: {
        blueprintId: task.bot?.blueprintId,
        botId: task.bot?.id,
        taskId: task.id,
      },
    })

    throw new WorkflowAbortError(
      `Task already running or was modified: ${state.taskId}`
    )
  }

  // Set context user

  {
    updateSessionStore({ user: userToSessionUser(task.user) })
    setContextUser(userToSessionUser(task.user))

    await setupFrontendHostContext(task.user)
  }

  // Check limits

  if (!(await accountConversationalLimitsOk(task.user))) {
    throw new WorkflowAbortError(`Limits exceeded for user: ${task.userId}`)
  }

  // Atomically update task status to running
  // @note we use updateMany with status check to prevent race conditions
  // If another process already set the task to running, this will update 0 rows

  const updateResult = await prisma.task.updateMany({
    where: {
      id: state.taskId,
      status: { not: TaskStatus.running },
    },
    data: {
      lastRunAt: new Date(),
      status: TaskStatus.running,
      outcome: TaskOutcome.pending,
    },
  })

  // Check if we successfully claimed the task

  if (updateResult.count === 0) {
    await logEvent({
      name: 'Task interact skipped',
      description: 'Task is already running',
      user: { id: task.userId },
      type: 'task.interact.skipped',
      relations: {
        blueprintId: task.bot?.blueprintId,
        botId: task.bot?.id,
        taskId: task.id,
      },
    })

    throw new WorkflowAbortError(
      `Task already running or was modified: ${state.taskId}`
    )
  }

  let conversationId: string | null = null
  let startMessageId: string | null = null
  let taskExecutionId: string | null = null

  try {
    conversationId = await getSessionConversationId(task)

    // Get conversation engine to inject task context

    const engine = await getStatefulConversationEngine({
      conversationId,

      options: {
        userId: task.userId,

        features: getTaskRunFeatures(),
      },
    })

    try {
      // Inject the task context to open a fresh turn.

      // @note we inject on *every* run, not just an empty conversation, so each
      // run is a clearly delineated turn - mirroring the trigger integration,
      // which injects its incoming-event / details activities on every event.
      // Runs after the first reuse the same conversation (a persisted
      // sessionDuration keeps the session->conversation mapping alive), so
      // without an unconditional injection a resumed run would open with no turn
      // marker and the model would treat the previous run's completed transcript
      // as the current turn - declaring the task already done and doing no real
      // work.

      {
        // Get last execution for context

        const lastExecution = await prisma.taskExecution.findFirst({
          where: {
            taskId: task.id,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })

        // @note only surface the previous execution's summary when it lived in a
        // different conversation. When the session is reused the previous run's
        // messages are already visible in this transcript, so re-injecting its
        // summary would be redundant.

        const relevantExecution =
          lastExecution?.conversationId !== conversationId
            ? lastExecution
            : null

        // @note surface when this run actually executed, formatted in the
        // task's own timezone and including the timezone itself, so the model
        // reasons about the run in the user's local time rather than UTC

        const timezone = getTimezone(task.timezone)

        const ranAt = getShortDateTime(new Date(), {
          timeZone: timezone,
          timeZoneName: 'short',
        })

        const newMessages = await engine.addMessages([
          {
            type: 'instruction',
            text: 'A new turn starts now. Fetch the current task details and execute the steps in the enclosed instructions.',
          },

          ...makeActivityMessagePair(
            GET_TASK_DETAILS_ACTIVITY,
            {},
            {
              name: task.name,
              description: task.description,
              meta: task.meta,

              ranAt: ranAt,
              timezone: timezone,

              lastExecution: relevantExecution
                ? {
                    id: relevantExecution.id,
                    taskId: relevantExecution.taskId,
                    name: relevantExecution.name,
                    description: relevantExecution.description,
                    status: relevantExecution.status,
                    outcome: relevantExecution.outcome,
                    summary: relevantExecution.summary,
                    completedAt: relevantExecution.completedAt?.toUTCString(),
                    meta: relevantExecution.meta,
                    createdAt: relevantExecution.createdAt.toUTCString(),
                  }
                : undefined,
            }
          ),
        ])

        startMessageId = newMessages[0]?.id || null
      }

      // Create execution record

      const taskExecution = await prisma.taskExecution.create({
        data: {
          userId: task.userId,
          taskId: task.id,

          name: task.name,
          description: task.description,

          status: TaskStatus.running,
          outcome: TaskOutcome.pending,

          summary: 'Task execution started',

          conversationId,

          meta: task.meta
            ? {
                // @ts-ignore meta is JsonValue
                namespace: task.meta.namespace,
              }
            : undefined,
        },
      })

      taskExecutionId = taskExecution.id

      await logEvent({
        name: 'Task interact started',
        description: 'Task interact started.',
        user: { id: task.userId },
        type: 'task.interact',
        relations: {
          blueprintId: task.bot?.blueprintId,
          botId: task.bot?.id,
          taskId: task.id,
          taskExecutionId: taskExecution.id,
        },
      })

      return {
        state: {
          stage: 'work',

          taskId: state.taskId,
          taskExecutionId: taskExecution.id,

          conversationId: conversationId,
          startMessageId: startMessageId,

          maxIterations: normalizeExecutionLimit(
            task.maxIterations,
            DEFAULT_LIMITS.maxIterations,
            PLATFORM_LIMITS.minIterations,
            PLATFORM_LIMITS.maxIterations
          ),
          maxTime: normalizeExecutionLimit(
            task.maxTime,
            DEFAULT_LIMITS.maxTime,
            PLATFORM_LIMITS.minTime,
            PLATFORM_LIMITS.maxTime
          ),
          maxCalls: normalizeExecutionLimit(
            task.maxCalls,
            DEFAULT_LIMITS.maxCalls,
            PLATFORM_LIMITS.minCalls,
            PLATFORM_LIMITS.maxCalls
          ),

          iterationCount: 0,
          callCount: 0,

          startedAt: Date.now(),

          notifiedThresholds: [],
        },
      }
    } finally {
      await engine.dispose()
    }
  } catch (error) {
    debug(`begin failed`, {
      taskId: state.taskId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }).log('task.workflow.execute.handleBegin')

    await captureError(error)

    // Transition to failure state - task is already running so we need cleanup

    return {
      state: {
        stage: 'failure',
        taskId: state.taskId,
        taskExecutionId,
        conversationId,
        startMessageId,
        endMessageId: null,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }
}

async function handleWork(
  state: WorkState,
  context: WorkflowHandlerContext
): Promise<WorkflowHandlerResult<WorkState | EndState | FailureState>> {
  debug(`work`, { taskId: state.taskId }).log(
    'task.workflow.execute.handleWork'
  )

  await abortIfTaskExecutionCanceled(state.taskExecutionId)

  const task = await prisma.task.findUnique({
    where: { id: state.taskId },
    include: {
      user: true,
      bot: true,
    },
  })

  if (!task) {
    // task was deleted mid-execution - transition to failure to clean up
    // execution record

    return {
      state: {
        stage: 'failure',
        taskId: state.taskId,
        taskExecutionId: state.taskExecutionId,
        conversationId: state.conversationId,
        startMessageId: state.startMessageId,
        endMessageId: null,
        errorMessage: 'Task was deleted during execution',
      },
    }
  }

  if (!task.bot) {
    await logEvent({
      name: 'Task interact aborted',
      description: 'No bot configured for task',
      user: { id: task.userId },
      type: 'task.interact.aborted',
      relations: {
        taskId: task.id,
      },
    })

    return {
      state: {
        stage: 'failure',
        taskId: state.taskId,
        taskExecutionId: state.taskExecutionId,
        conversationId: state.conversationId,
        startMessageId: state.startMessageId,
        endMessageId: null,
        errorMessage: 'Bot was removed during execution',
      },
    }
  }

  // Set context user

  {
    updateSessionStore({ user: userToSessionUser(task.user) })
    setContextUser(userToSessionUser(task.user))

    await setupFrontendHostContext(task.user)
  }

  // Check limits

  if (!(await accountConversationalLimitsOk(task.user))) {
    return {
      state: {
        stage: 'failure',
        taskId: state.taskId,
        taskExecutionId: state.taskExecutionId,
        conversationId: state.conversationId,
        startMessageId: state.startMessageId,
        endMessageId: null,
        errorMessage: 'Limits exceeded for user',
      },
    }
  }

  // Heartbeat the stalled-reaper deadline before doing any real work, so an
  // actively-progressing run (however many steps it takes) is never mistaken for
  // a stuck one. Pauses below extend this further.

  await heartbeatTaskExecution(state.taskExecutionId)

  // Track iteration count

  const currentIteration = (state.iterationCount || 0) + 1
  const startedAt = state.startedAt || Date.now()
  const elapsedTimeMs = Date.now() - startedAt

  // Check configured limits

  const effectiveMaxIterations =
    state.maxIterations ?? DEFAULT_LIMITS.maxIterations
  const effectiveMaxTimeMs = state.maxTime ?? DEFAULT_LIMITS.maxTime
  const effectiveMaxCalls = state.maxCalls ?? DEFAULT_LIMITS.maxCalls

  const notifiedThresholds = state.notifiedThresholds || []

  // @note maxCalls is a whole-task budget accumulated in state across chunks.
  // The per-step engine also enforces it natively (seeded below) so a single
  // step never overshoots; this check ends the task cleanly once the running
  // total reaches the budget instead of letting settle mode keep nudging an
  // already-exhausted run.
  const currentCallCount = state.callCount ?? 0

  const maxIterationsExceeded = currentIteration > effectiveMaxIterations
  const maxTimeExceeded = elapsedTimeMs >= effectiveMaxTimeMs
  const maxCallsExceeded = currentCallCount >= effectiveMaxCalls

  if (maxIterationsExceeded || maxTimeExceeded || maxCallsExceeded) {
    const limitReason = maxIterationsExceeded
      ? 'maxIterations'
      : maxTimeExceeded
        ? 'maxTime'
        : 'maxCalls'

    debug(`limits exceeded`, {
      taskId: state.taskId,
      currentIteration,
      effectiveMaxIterations,
      elapsedTimeMs,
      effectiveMaxTimeMs,
      currentCallCount,
      effectiveMaxCalls,
      maxIterationsExceeded,
      maxTimeExceeded,
      maxCallsExceeded,
    }).log('task.workflow.execute.handleWork')

    // Inject an activity message so the agent knows why execution stopped.
    // Wrap in try/catch - activity injection failure is non-fatal and must
    // not prevent the graceful transition to 'end'.

    let limitEndMessageId: string | null = null

    try {
      const limitEngine = await getStatefulConversationEngine({
        conversationId: state.conversationId,
        options: {
          userId: task.userId,
          features: getTaskRunFeatures(),
        },
      })

      try {
        const limitMessages = await limitEngine.addMessages([
          ...makeActivityMessagePair(
            CHECK_TASK_RUN_STATUS_ACTIVITY,
            {},
            {
              status: 'limit_exceeded',
              reason: limitReason,
            }
          ),
        ])

        limitEndMessageId =
          limitMessages.length > 0 &&
          'id' in limitMessages[limitMessages.length - 1]
            ? (limitMessages[limitMessages.length - 1].id as string)
            : null
      } finally {
        await limitEngine.dispose()
      }
    } catch (e) {
      await captureError(e)
    }

    return {
      state: {
        stage: 'end',
        taskId: state.taskId,
        taskExecutionId: state.taskExecutionId,
        conversationId: state.conversationId,
        startMessageId: state.startMessageId,
        endMessageId: limitEndMessageId,
      },
    }
  }

  // Handle a usage-policy bot block. The block is a finite Redis TTL, so
  // `ttl` is the exact seconds until it lifts. If it will lift while the
  // conversation session is still alive (and the wait fits the workflow's
  // remaining time budget), pause and resume the same run where it left off;
  // otherwise the context would be gone by the time we could resume, so fail.

  const botBlock = await getBotBlock(task.bot.id)

  if (botBlock && botBlock.ttl > 0) {
    const resumeDelaySeconds = botBlock.ttl + BLOCK_RESUME_BUFFER_SECONDS
    const resumeDelayMs = resumeDelaySeconds * 1000

    const remainingSessionSeconds = await getRemainingSessionSeconds(task)

    const fitsSession = botBlock.ttl < remainingSessionSeconds
    const fitsTimeBudget = resumeDelayMs < context.remainingTimeMs

    if (fitsSession && fitsTimeBudget) {
      debug(`bot blocked, pausing task until block lifts`, {
        taskId: state.taskId,
        ttl: botBlock.ttl,
        resumeDelaySeconds,
        remainingSessionSeconds,
      }).log('task.workflow.execute.handleWork')

      // Surface the pause to the agent as a checkpoint carrying the wait
      // duration, so the resumed run can account for the gap rather than see an
      // unexplained jump in wall-clock time.

      await addTaskRunPausedActivity({
        conversationId: state.conversationId,
        userId: task.userId,
        seconds: resumeDelaySeconds,
        source: 'usage_policy',
        reason: botBlock.reason,
      })

      // Extend the stalled-reaper deadline over the whole pause so the reaper
      // does not reap the run while it is legitimately waiting for the block to
      // lift.

      await heartbeatTaskExecution(state.taskExecutionId, resumeDelayMs)

      // Re-queue the SAME work state, delayed until just after the block lifts.
      // The pause is involuntary, so it must not consume an iteration / call
      // from the task budget (we carry the counts forward unchanged via
      // `...state`), and we advance `startedAt` by the pause so the wait does
      // not eat the per-task maxTime budget either.

      return {
        state: {
          ...state,
          startedAt: (state.startedAt ?? Date.now()) + resumeDelayMs,
        },

        delaySeconds: resumeDelaySeconds,
      }
    }

    debug(`bot blocked beyond session, failing task`, {
      taskId: state.taskId,
      ttl: botBlock.ttl,
      remainingSessionSeconds,
      fitsTimeBudget,
    }).log('task.workflow.execute.handleWork')

    return {
      state: {
        stage: 'failure',
        taskId: state.taskId,
        taskExecutionId: state.taskExecutionId,
        conversationId: state.conversationId,
        startMessageId: state.startMessageId,
        endMessageId: null,
        errorMessage: botBlock.reason,
      },
    }
  }

  // Track delay requests from the agent

  let delaySeconds: number | undefined

  const abortCheck = withPeriodicAbortCheck({
    signal: context.signal,
    intervalMs: TASK_EXECUTION_CANCEL_CHECK_INTERVAL_MS,
    reason: new WorkflowAbortError('Task execution canceled'),
    shouldAbort: () => isTaskExecutionCanceled(state.taskExecutionId),
    onError: captureError,
  })

  let engine:
    | Awaited<ReturnType<typeof getStatefulConversationEngine>>
    | undefined

  try {
    // Get conversation engine with maxIterations=1 for single-step mode

    // @note seed the per-step engine with the running tool-call total so the
    // conv function enforces the whole-task budget natively and never overshoots
    // mid-step. The conv mutates this object in place, so we read the updated
    // total back after the run and carry it in state.
    //
    // @todo only `calls` is carried across chunks, not `budgetWarned`, so the
    // engine's "approaching call limit" heads-up (meant to fire once per run)
    // can re-fire once per chunk near the whole-task limit. Persist budgetWarned
    // in WorkState if this proves noisy. Review later.
    const callStats = { calls: currentCallCount }

    engine = await getStatefulConversationEngine({
      conversationId: state.conversationId,

      options: {
        userId: task.userId,

        features: getTaskRunFeatures(),

        internalFunctions: [
          {
            name: '_delay',
            description: t`
              Delay the conversation for the specified number of seconds. Use
              this when you need to wait before continuing, for example when
              polling for an external result or giving a process time to
              complete. The maximum delay is ${MAX_DELAY_SECONDS} seconds.
            `,

            parameters: {
              type: 'object',
              properties: {
                seconds: {
                  type: 'number',
                  description: t`
                    The number of seconds to delay (1 to ${MAX_DELAY_SECONDS})
                  `,
                  min: 1,
                  max: MAX_DELAY_SECONDS,
                },
              },
              required: ['seconds'],
            },

            handler({ seconds }: { seconds: number }) {
              const clamped = Math.min(
                Math.max(Math.round(seconds), 1),
                MAX_DELAY_SECONDS
              )

              delaySeconds = clamped

              return { delayed: true, seconds: clamped }
            },
          },
        ],

        maxIterations: MAX_ITERATIONS_PER_STEP,

        maxCalls: effectiveMaxCalls,

        callStats,

        signal: abortCheck.signal,

        sink: createTaskWorkflowOperationSink({
          userId: task.userId,
          taskId: task.id,
        }),
      },
    })

    // Run single iteration

    const response = await engine.complete()

    // @note the conv function mutated the seeded stats in place; read the new
    // running total back so the next chunk resumes the whole-task budget.
    const nextCallCount = callStats.calls

    debug(`iteration complete`, {
      taskId: state.taskId,
      iteration: currentIteration,
      reason: response.reason,
      callCount: nextCallCount,
    }).log('task.workflow.execute.handleWork.iterationComplete')

    await abortIfTaskExecutionCanceled(state.taskExecutionId)

    // Handle error completion

    if (response.reason === 'error') {
      debug(`engine error`, {
        taskId: state.taskId,
        error: response.error,
      }).log('task.workflow.execute.handleWork')

      // Capture last message for error context

      const lastMessage = engine.messages.slice(-1)[0]

      const endMessageId =
        lastMessage && 'id' in lastMessage ? (lastMessage.id as string) : null

      // @note deliberately generic. `errorMessage` is not an internal field: it
      // is fed back into the conversation as the `_checkTaskRunStatus` activity
      // `reason` (so it enters the agent's own context) and surfaces as the task
      // execution `summary` in the UI. A raw provider string ("Service
      // temporarily unavailable ... (503)") would leak infrastructure detail to
      // the user and to the model. The real cause is logged above and captured
      // in Sentry, which is where an operator should read it.

      return {
        state: {
          stage: 'failure',
          taskId: state.taskId,
          taskExecutionId: state.taskExecutionId,
          conversationId: state.conversationId,
          startMessageId: state.startMessageId,
          endMessageId,
          errorMessage: 'Conversation engine returned error',
        },
      }
    }

    // Check if we should continue or complete

    if (response.reason === 'iteration') {
      debug(`iteration complete`, {
        taskId: state.taskId,
        iteration: currentIteration,
      }).log('task.workflow.execute.handleWork')

      const newThresholds = getNewTaskRunProgressThresholds({
        currentIteration,
        maxIterations: effectiveMaxIterations,
        elapsedTimeMs,
        maxTimeMs: effectiveMaxTimeMs,
        notifiedThresholds,
      })

      let nextNotifiedThresholds = notifiedThresholds

      if (newThresholds.length > 0) {
        const nextThreshold = newThresholds[0]
        const iterationProgress = getProgressRatio(
          currentIteration,
          effectiveMaxIterations
        )

        const timeProgress = getProgressRatio(elapsedTimeMs, effectiveMaxTimeMs)

        try {
          const progressThreshold = nextThreshold / 100
          const reasons: Array<'maxIterations' | 'maxTime'> = []

          if (iterationProgress >= progressThreshold) {
            reasons.push('maxIterations')
          }

          if (timeProgress >= progressThreshold) {
            reasons.push('maxTime')
          }

          await engine.addMessages(
            makeActivityMessagePair(
              CHECK_TASK_RUN_STATUS_ACTIVITY,
              {},
              {
                status: 'progress_threshold',
                threshold: nextThreshold,
                reasons,
                iterationProgress,
                timeProgress,
              }
            )
          )

          nextNotifiedThresholds = [...notifiedThresholds, nextThreshold]
        } catch (e) {
          await captureError(e)
        }
      }

      // If the agent asked to wait via `_delay`, record it as a paused
      // checkpoint too so the resumed step can account for the elapsed wait
      // instead of a silent gap. Best-effort - reuse the open per-step engine.

      if (delaySeconds != null) {
        try {
          await engine.addMessages(
            makeActivityMessagePair(
              CHECK_TASK_RUN_STATUS_ACTIVITY,
              {},
              {
                status: 'paused',
                source: 'requested',
                seconds: delaySeconds,
              }
            )
          )
        } catch (e) {
          await captureError(e)
        }

        // Extend the stalled-reaper deadline over the requested wait so the
        // reaper does not reap the run while it is delayed.

        await heartbeatTaskExecution(state.taskExecutionId, delaySeconds * 1000)
      }

      // More work to do - continue in work stage

      return {
        state: {
          stage: 'work',
          taskId: state.taskId,
          taskExecutionId: state.taskExecutionId,
          conversationId: state.conversationId,
          startMessageId: state.startMessageId,
          maxIterations: state.maxIterations,
          maxTime: state.maxTime,
          maxCalls: state.maxCalls,
          callCount: nextCallCount,
          iterationCount: currentIteration,
          startedAt: startedAt,
          notifiedThresholds: nextNotifiedThresholds,
        },

        delaySeconds,
      }
    }

    if (response.reason === 'abort') {
      debug(`execution aborted`, {
        taskId: state.taskId,
        totalIterations: currentIteration,
        elapsedTimeMs,
      }).log('task.workflow.execute.handleWork')
    } else {
      debug(`execution complete`, {
        taskId: state.taskId,
        totalIterations: currentIteration,
        elapsedTimeMs,
        reason: response.reason,
      }).log('task.workflow.execute.handleWork')
    }

    // Add task run status check activity

    const statusMessages = await engine.addMessages([
      ...makeActivityMessagePair(
        CHECK_TASK_RUN_STATUS_ACTIVITY,
        {},
        {
          status: 'complete',
          reason: response.reason,
        }
      ),
    ])

    // Get end message ID

    const endMessageId =
      statusMessages.length > 0 &&
      'id' in statusMessages[statusMessages.length - 1]
        ? (statusMessages[statusMessages.length - 1].id as string)
        : null

    // Completed - move to end stage

    return {
      state: {
        stage: 'end',
        taskId: state.taskId,
        taskExecutionId: state.taskExecutionId,
        conversationId: state.conversationId,
        startMessageId: state.startMessageId,
        endMessageId,
      },
    }
  } catch (error) {
    if (error instanceof WorkflowAbortError) {
      throw error
    }

    await captureError(error)

    // Transition to failure state

    const lastMessage = engine?.messages.slice(-1)[0]
    const endMessageId =
      lastMessage && 'id' in lastMessage ? (lastMessage.id as string) : null

    return {
      state: {
        stage: 'failure',
        taskId: state.taskId,
        taskExecutionId: state.taskExecutionId,
        conversationId: state.conversationId,
        startMessageId: state.startMessageId,
        endMessageId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  } finally {
    await engine?.dispose()

    abortCheck.dispose()
  }
}

async function handleEnd(
  state: EndState,
  _context: WorkflowHandlerContext
): Promise<null> {
  debug(`end`, { taskId: state.taskId }).log('task.workflow.execute.handleEnd')

  if (await isTaskExecutionCanceled(state.taskExecutionId)) {
    return null
  }

  const task = await prisma.task.findUnique({
    where: { id: state.taskId },
    include: {
      user: true,
      bot: true,
    },
  })

  if (!task) {
    // Task was deleted, nothing to finalize

    return null
  }

  // Set context user

  {
    updateSessionStore({ user: userToSessionUser(task.user) })
    setContextUser(userToSessionUser(task.user))

    await setupFrontendHostContext(task.user)
  }

  const completedAt = new Date()

  // Get conversation engine to extract summary

  const engine = await getStatefulConversationEngine({
    conversationId: state.conversationId,

    options: {
      userId: task.userId,
      features: getTaskRunFeatures(),
    },
  })

  // Extract execution summary

  let taskName: string | undefined
  let taskDescription: string | undefined
  let taskSummary: string | undefined

  try {
    const extractResult = await extractData(
      engine.messages.slice(-MAX_SUMMARY_MESSAGE_TAKE),
      {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: t`The name of the task execution`,
          },
          description: {
            type: 'string',
            description: t`A concise description of the overall task execution`,
          },
          summary: {
            type: 'string',
            description: t`
              A detailed summary of the task execution including:

              1) Key steps taken and actions performed
              2) Important outcomes and results achieved
              3) Any data retrieved or generated
              4) Decisions made and reasoning behind them
              5) Any issues encountered and how they were resolved
              6) Current state and context for next execution.

              Be specific and concrete with examples where relevant.
            `,
          },
        },
      },
      {
        user: task.user,
        functionName: '_extractTaskExecutionSummary',
      }
    )

    taskName = (extractResult.data?.name as string)
      ? stringToDbString(extractResult.data?.name as string)
      : undefined

    taskDescription = (extractResult.data?.description as string)
      ? stringToDbString(
          extractResult.data?.description as string,
          MAX_DB_TEXT_BYTES_LENGTH
        )
      : undefined

    taskSummary = (extractResult.data?.summary as string)
      ? stringToDbString(
          extractResult.data?.summary as string,
          MAX_DB_TEXT_BYTES_LENGTH
        )
      : undefined
  } catch (e) {
    await captureError(e)
  } finally {
    await engine.dispose()
  }

  // Update task execution record.
  // Wrapped in try/catch so a DB failure here does not prevent the
  // subsequent task status reset (which releases the 'running' lock).

  try {
    await prisma.taskExecution.update({
      where: { id: state.taskExecutionId },
      data: {
        name: taskName,
        description: taskDescription,

        status: TaskStatus.idle,
        outcome: TaskOutcome.success,

        completedAt,

        startMessageId: state.startMessageId,
        endMessageId: state.endMessageId,

        summary: taskSummary || 'Task completed successfully',
      },
    })
  } catch (e) {
    await captureError(e)
  }

  // Relabel the conversation with the extracted execution name/description so it
  // reflects what the run actually did rather than the static task name. Guarded
  // on the extraction succeeding (`undefined` on a miss) so a failed extract
  // never blanks out the task-derived label the conversation got at creation.
  // Best-effort: a DB failure here must not block the task status reset below.

  if (taskName || taskDescription) {
    try {
      await prisma.conversation.update({
        where: { id: state.conversationId },
        data: {
          name: taskName,
          description: taskDescription,
        },
      })
    } catch (e) {
      await captureError(e)
    }
  }

  // Update task status

  const nextRunAt = task.schedule
    ? getNext(task.schedule, { timezone: task.timezone })
    : null

  await prisma.task.update({
    where: { id: state.taskId },
    data: {
      status: TaskStatus.idle,
      outcome: TaskOutcome.success,
      nextRunAt: nextRunAt && nextRunAt > new Date() ? nextRunAt : null,
    },
  })

  await logEvent({
    name: 'Task interact completed',
    description: 'Task interact completed successfully.',
    user: { id: task.userId },
    type: 'task.interact.completed',
    relations: {
      blueprintId: task.bot?.blueprintId,
      botId: task.bot?.id,
      taskId: task.id,
      taskExecutionId: state.taskExecutionId,
    },
  })

  debug(`task complete`, { taskId: state.taskId }).log(
    'task.workflow.execute.handleEnd'
  )

  return null
}

async function handleFailure(
  state: FailureState,
  _context: WorkflowHandlerContext
): Promise<null> {
  debug(`failure`, { taskId: state.taskId, error: state.errorMessage }).log(
    'task.workflow.execute.handleFailure'
  )

  if (await isTaskExecutionCanceled(state.taskExecutionId)) {
    return null
  }

  const task = await prisma.task.findUnique({
    where: { id: state.taskId },
    include: {
      user: true,
      bot: true,
    },
  })

  if (!task) {
    // Task was deleted, nothing to finalize

    return null
  }

  // Set context user

  {
    updateSessionStore({ user: userToSessionUser(task.user) })
    setContextUser(userToSessionUser(task.user))

    await setupFrontendHostContext(task.user)
  }

  const completedAt = new Date()

  // Close the conversation transcript with a terminal resolution marker so a
  // failed run ends with a status (like the end / abort / limit paths) instead
  // of dead-ending on whatever the last message happened to be. Best-effort: an
  // injection failure must not block the execution / task status reset below.

  let endMessageId = state.endMessageId

  if (state.conversationId) {
    try {
      const engine = await getStatefulConversationEngine({
        conversationId: state.conversationId,
        options: {
          userId: task.userId,
          features: getTaskRunFeatures(),
        },
      })

      try {
        const statusMessages = await engine.addMessages([
          ...makeActivityMessagePair(
            CHECK_TASK_RUN_STATUS_ACTIVITY,
            {},
            {
              status: 'failed',
              reason: state.errorMessage || 'Task execution failed',
            }
          ),
        ])

        const lastMessage = statusMessages[statusMessages.length - 1]

        if (lastMessage && 'id' in lastMessage) {
          endMessageId = lastMessage.id as string
        }
      } finally {
        await engine.dispose()
      }
    } catch (e) {
      await captureError(e)
    }
  }

  // Update task execution record if it exists.
  // Wrapped in try/catch so a DB failure here does not prevent the
  // subsequent task status reset (which releases the 'running' lock).

  if (state.taskExecutionId) {
    try {
      await prisma.taskExecution.update({
        where: { id: state.taskExecutionId },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,

          completedAt,

          startMessageId: state.startMessageId,
          endMessageId: endMessageId,

          summary: state.errorMessage || 'Task execution failed',
        },
      })
    } catch (e) {
      await captureError(e)
    }
  }

  // Update task status

  const nextRunAt = task.schedule
    ? getNext(task.schedule, { timezone: task.timezone })
    : null

  await prisma.task.update({
    where: { id: state.taskId },
    data: {
      status: TaskStatus.idle,
      outcome: TaskOutcome.failure,
      nextRunAt: nextRunAt && nextRunAt > new Date() ? nextRunAt : null,
    },
  })

  await logEvent({
    name: 'Task interact completed',
    description: 'Task interact completed with failure.',
    user: { id: task.userId },
    type: 'task.interact.completed',
    relations: {
      blueprintId: task.bot?.blueprintId,
      botId: task.bot?.id,
      taskId: task.id,
      taskExecutionId: state.taskExecutionId ?? undefined,
    },
  })

  debug(`task failed`, { taskId: state.taskId }).log(
    'task.workflow.execute.handleFailure'
  )

  return null
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

async function handler(
  state: State,
  context: WorkflowHandlerContext
): Promise<WorkflowHandlerResult<State> | null> {
  switch (state.stage) {
    case 'begin': {
      return handleBegin(state, context)
    }

    case 'work': {
      return handleWork(state, context)
    }

    case 'end': {
      return handleEnd(state, context)
    }

    case 'failure': {
      return handleFailure(state, context)
    }

    default: {
      assertUnreachable(state)
    }
  }
}

// -----------------------------------------------------------------------------
// Platform Limit Handler
// -----------------------------------------------------------------------------

async function handlePlatformLimitExceeded(
  state: State,
  reason: 'maxRuns' | 'maxTime'
): Promise<void> {
  debug(`platform limit exceeded`, { taskId: state.taskId, reason }).log(
    'task.workflow.execute.handlePlatformLimitExceeded'
  )

  const taskId = state.taskId
  const taskExecutionId = state.stage !== 'begin' ? state.taskExecutionId : null
  const conversationId = state.stage !== 'begin' ? state.conversationId : null

  // Inject activity message so the agent knows why execution stopped

  if (conversationId) {
    try {
      const taskForEngine = await prisma.task.findUnique({
        where: { id: taskId },
        select: { userId: true },
      })

      if (taskForEngine) {
        const engine = await getStatefulConversationEngine({
          conversationId,
          options: {
            userId: taskForEngine.userId,
            features: getTaskRunFeatures(),
          },
        })

        try {
          await engine.addMessages([
            ...makeActivityMessagePair(
              CHECK_TASK_RUN_STATUS_ACTIVITY,
              {},
              {
                status: 'limit_exceeded',
                reason: reason,
              }
            ),
          ])
        } finally {
          await engine.dispose()
        }
      }
    } catch (e) {
      await captureError(e)
    }
  }

  // Update execution record

  if (taskExecutionId) {
    try {
      await prisma.taskExecution.update({
        where: { id: taskExecutionId },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          completedAt: new Date(),
          summary:
            reason === 'maxRuns'
              ? 'Task stopped: exceeded maximum iteration limit'
              : 'Task stopped: exceeded maximum time limit',
        },
      })
    } catch (e) {
      await captureError(e)
    }
  }

  // Update task status and schedule next run

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        userId: true,
        schedule: true,
        timezone: true,
        bot: { select: { id: true, blueprintId: true } },
      },
    })

    const nextRunAt = task?.schedule
      ? getNext(task.schedule, { timezone: task.timezone })
      : null

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.idle,
        outcome: TaskOutcome.failure,
        nextRunAt: nextRunAt && nextRunAt > new Date() ? nextRunAt : null,
      },
    })

    if (task) {
      await logEvent({
        name: 'Task interact completed',
        description:
          reason === 'maxRuns'
            ? 'Task stopped: exceeded maximum iteration limit.'
            : 'Task stopped: exceeded maximum time limit.',
        user: { id: task.userId },
        type: 'task.interact.completed',
        relations: {
          blueprintId: task.bot?.blueprintId,
          botId: task.bot?.id,
          taskId,
          taskExecutionId: taskExecutionId ?? undefined,
        },
      })
    }
  } catch (e) {
    await captureError(e)
  }
}

// -----------------------------------------------------------------------------
// Abort Handler
// -----------------------------------------------------------------------------

async function handleAbort(state: State, error: Error): Promise<void> {
  debug(`workflow aborted`, {
    taskId: state.taskId,
    reason: error.message,
  }).log('task.workflow.execute.handleAbort')

  const taskId = state.taskId
  const taskExecutionId = state.stage !== 'begin' ? state.taskExecutionId : null
  const conversationId = state.stage !== 'begin' ? state.conversationId : null

  const task = await prisma.task
    .findUnique({
      where: { id: taskId },
      select: {
        userId: true,
        schedule: true,
        timezone: true,
        bot: { select: { id: true, blueprintId: true } },
      },
    })
    .catch(async (e) => {
      await captureError(e)

      return null
    })

  // Inject activity message so the agent sees the abort on resume / next run

  if (conversationId && task) {
    try {
      const engine = await getStatefulConversationEngine({
        conversationId,
        options: {
          userId: task.userId,
          features: getTaskRunFeatures(),
        },
      })

      try {
        await engine.addMessages([
          ...makeActivityMessagePair(
            CHECK_TASK_RUN_STATUS_ACTIVITY,
            {},
            {
              status: 'aborted',
              reason: error.message,
            }
          ),
        ])
      } finally {
        await engine.dispose()
      }
    } catch (e) {
      await captureError(e)
    }
  }

  // Reset execution record out of running state

  if (taskExecutionId) {
    try {
      await prisma.taskExecution.update({
        where: { id: taskExecutionId },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          completedAt: new Date(),
          summary: `Task aborted: ${error.message}`,
        },
      })
    } catch (e) {
      await captureError(e)
    }
  }

  // Reset task status and schedule next run

  if (task) {
    try {
      const nextRunAt = task.schedule
        ? getNext(task.schedule, { timezone: task.timezone })
        : null

      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          nextRunAt: nextRunAt && nextRunAt > new Date() ? nextRunAt : null,
        },
      })

      await logEvent({
        name: 'Task interact aborted',
        description: error.message,
        user: { id: task.userId },
        type: 'task.interact.aborted',
        relations: {
          blueprintId: task.bot?.blueprintId,
          botId: task.bot?.id,
          taskId,
          taskExecutionId: taskExecutionId ?? undefined,
        },
      })
    } catch (e) {
      await captureError(e)
    }
  }
}

// -----------------------------------------------------------------------------
// Queue Handler
// -----------------------------------------------------------------------------

export default withWorkflowHandler({
  route: ROUTE,
  stateSchema: StateSchema,

  maxRuns: PLATFORM_LIMITS.maxIterations,
  onMaxRunsExceeded: async (state: State) => {
    await handlePlatformLimitExceeded(state, 'maxRuns')
  },

  maxTimeMs: PLATFORM_LIMITS.maxTime,
  onMaxTimeExceeded: async (state: State) => {
    await handlePlatformLimitExceeded(state, 'maxTime')
  },

  onAbort: async (state: State, _meta, error) => {
    await handleAbort(state, error)
  },

  handler,
})

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export async function executeTask(
  taskId: string,
  options?: { delayInSeconds?: number }
): Promise<void> {
  const initialState: BeginState = { stage: 'begin', taskId }

  // @note the per-minute-bucketed workflowId dedups duplicate executions within
  // a 1 minute window (and serializes them, since flowKey defaults to it)

  const workflowId = `task-${taskId}-execute-${roundToNearestNMinutes(
    1
  ).getTime()}`

  await sendWorkflowEvent(ROUTE, initialState, {
    ...options,

    workflowId,
  })
}

/**
 * @manual Task Execution
 * @category Objects/Tasks
 * @index 60
 *
 * ## Task Execution Behavior
 *
 * Understanding how tasks execute is essential for building reliable automation
 * workflows. When a task runs, whether triggered manually or by its schedule, the
 * platform orchestrates a sophisticated execution process that manages conversations,
 * tracks progress, and generates detailed execution summaries.
 *
 * ### Execution Lifecycle
 *
 * Each task execution follows a well-defined lifecycle that ensures reliable
 * operation and comprehensive tracking:
 *
 * 1. **Initialization**: The system validates the task exists and checks that your
 *    account has sufficient conversation quota. If the task is already running, the
 *    new execution request is gracefully ignored to prevent duplicate runs.
 *
 * 2. **Session Management**: The platform either creates a new conversation or reuses
 *    an existing session based on the task's `sessionDuration` configuration. Sessions
 *    are cached and reused within the configured duration, allowing multi-step workflows
 *    to maintain context across executions.
 *
 * 3. **Context Injection**: Before the bot begins processing, the system injects
 *    current task details and information about the previous execution (if any) into
 *    the conversation. This provides the bot with essential context including the task
 *    name, description, metadata, and a summary of what happened in the last run.
 *
 * 4. **Bot Processing**: The associated bot receives the task instructions and executes
 *    its configured workflow. The bot has access to all its abilities, skillsets, and
 *    integrations during this phase.
 *
 * 5. **Completion and Summary**: After the bot finishes processing, the system
 *    automatically generates a detailed execution summary capturing key actions taken,
 *    outcomes achieved, and relevant context for future executions.
 *
 * ### Session Persistence
 *
 * Task sessions provide continuity between executions, enabling sophisticated
 * multi-step workflows:
 *
 * - **Session Duration**: Controlled by the `sessionDuration` parameter (in milliseconds),
 *   this determines how long a conversation session remains active between executions.
 *   Sessions lasting at least 60 seconds are cached for reuse.
 *
 * - **Session Reuse**: When a task executes within an active session window, it continues
 *   the existing conversation rather than starting fresh. This allows the bot to reference
 *   previous messages and maintain workflow state.
 *
 * - **New Sessions**: When the session expires or doesn't exist, a new conversation is
 *   created with the task's name and description. The conversation is automatically
 *   associated with the task and any configured contact.
 *
 * ### Execution Context
 *
 * Each execution receives rich context to enable intelligent processing:
 *
 * - **Task Details**: The bot receives the task's name, description, and any custom
 *   metadata you've configured. This allows you to pass dynamic parameters or
 *   configuration to your automation workflows.
 *
 * - **Previous Execution Summary**: If the task has run before, the bot receives a
 *   summary of the last execution including its outcome, completion time, and a
 *   detailed summary of actions taken. This enables workflows that build upon
 *   previous results or handle incremental processing.
 *
 * - **Execution Tracking**: Every execution creates a record that
 *   captures the start time, completion time, outcome (success or failure), and
 *   a generated summary. These records provide a complete audit trail of your
 *   automation activity.
 *
 * ### Execution Outcomes
 *
 * Task executions result in one of the following outcomes:
 *
 * - **Success**: The bot completed its workflow without errors. The execution summary
 *   captures what was accomplished, and the task status returns to idle.
 *
 * - **Failure**: An error occurred during execution. The system captures the failure,
 *   updates the execution record, and returns the task to idle status. Failed
 *   executions don't prevent future scheduled runs.
 *
 * - **Skipped**: If the task is already running when a new execution is requested,
 *   the duplicate request is silently ignored. This prevents overlapping executions
 *   that could cause conflicts or resource contention.
 *
 * ### Automatic Summary Generation
 *
 * After each successful execution, the platform automatically generates a comprehensive
 * summary that includes:
 *
 * - Key steps taken and actions performed during the execution
 * - Important outcomes and results achieved
 * - Any data retrieved or generated by the bot
 * - Decisions made and the reasoning behind them
 * - Issues encountered and how they were resolved
 * - Current state and context relevant for the next execution
 *
 * These summaries are stored with the execution record and provided to subsequent
 * executions, enabling workflows that maintain awareness of their history and can
 * make informed decisions based on past results.
 *
 * ### Concurrency and Rate Limiting
 *
 * The task execution system includes built-in protections:
 *
 * - **Single Execution**: Only one instance of a task can run at a time. Concurrent
 *   trigger requests for the same task are deduplicated within a one-minute window.
 *
 * - **Account Limits**: Executions are subject to your account's conversation limits.
 *   If limits are exceeded, the execution will not proceed and an appropriate error
 *   is returned.
 *
 * - **Graceful Handling**: The system handles edge cases like missing bots, expired
 *   sessions, and transient errors without corrupting task state.
 *
 * ### Best Practices
 *
 * To build reliable task automations:
 *
 * - **Configure Appropriate Session Duration**: Use longer sessions for multi-step
 *   workflows that need context continuity, and shorter sessions for independent
 *   operations that should start fresh each time.
 *
 * - **Design for Idempotency**: Since tasks may occasionally be triggered multiple
 *   times (e.g., manual trigger during scheduled run), design your bot workflows
 *   to handle duplicate executions gracefully.
 *
 * - **Leverage Previous Execution Context**: Use the previous execution summary to
 *   implement incremental processing, avoid repeating completed work, or handle
 *   recovery from previous failures.
 *
 * - **Monitor Execution Records**: Review task execution history to identify patterns,
 *   troubleshoot failures, and optimize your automation workflows based on actual
 *   performance data.
 */
