/**
 * @fileoverview Experimental workflow queue handler for long-running operations.
 *
 * This module provides a queue handler that breaks work into smaller steps,
 * re-queuing after each step. This allows operations to exceed Vercel's timeout
 * limits by distributing work across multiple invocations.
 *
 * @example
 * ```ts
 * // With maxRuns limit
 * const handler = withWorkflowQueueHandler({
 *   route: '/api/v1/my/queue',
 *   stateSchema: z.object({
 *     cursor: z.string().optional(),
 *     processed: z.number(),
 *   }),
 *   maxRuns: 100,
 *   onMaxRunsExceeded: 'stop', // required when maxRuns is set
 *   handler: async (state, context) => {
 *     const batch = await fetchBatch(state.cursor)
 *     if (!batch.length) return null // done
 *     await processBatch(batch)
 *     return {
 *       state: { ...state, cursor: batch.at(-1).id, processed: state.processed + batch.length },
 *     }
 *   },
 * })
 *
 * // With maxTimeMs limit
 * const handlerWithTime = withWorkflowQueueHandler({
 *   route: '/api/v1/my/queue',
 *   stateSchema: z.object({ processed: z.number() }),
 *   maxTimeMs: 30 * 60 * 1000, // 30 minutes
 *   onMaxTimeExceeded: 'error', // required when maxTimeMs is set
 *   handler: async (state, context) => {
 *     // context.remainingTimeMs tells you how much time is left
 *     if (state.processed >= 1000) return null
 *     await processNext()
 *     return { state: { processed: state.processed + 1 } }
 *   },
 * })
 *
 * // With dynamic per-step delay
 * const handlerWithDynamicDelay = withWorkflowQueueHandler({
 *   route: '/api/v1/my/queue',
 *   stateSchema: z.object({ retries: z.number() }),
 *   maxRuns: 10,
 *   onMaxRunsExceeded: 'stop',
 *   handler: async (state, context) => {
 *     const success = await tryOperation()
 *     if (success) return null
 *     // Exponential backoff: delay increases with each retry
 *     return {
 *       state: { retries: state.retries + 1 },
 *       delaySeconds: state.retries * 5,
 *     }
 *   },
 * })
 * ```
 */
import debug from '@/lib/debug'
import { withStreamContinuity } from '@/lib/stream'
import { captureObservation } from '@/lib/error'
import queue, { withQueue } from '@/lib/queue'
import { parseRequestJson } from '@/lib/request'
import { captureUnknownException, throwBadRequest } from '@/lib/response'

import { type ZodType, z } from 'zod'

const WORKFLOW_EVENT_TYPE = 'step'

const MAX_SET_TIMEOUT_MS = 2_147_483_647

type WorkflowStepMetricStatus =
  | 'started'
  | 'completed'
  | 'continued'
  | 'aborted'
  | 'failed'
  | 'max_runs_exceeded'
  | 'max_time_exceeded'

interface WorkflowStepMetric {
  route: WorkflowConfigBase<unknown>['route']
  status: WorkflowStepMetricStatus
  count: 1
  runCount: number
  elapsedTimeMs: number
  workflowId?: string
  durationMs?: number
  totalRuns?: number
  totalTimeMs?: number
  remainingTimeMs?: number
  remainingRuns?: number
  nextRun?: number
  delaySeconds?: number
}

function recordWorkflowStepMetric(metric: WorkflowStepMetric): void {
  debug(`recording workflow step`, metric).log('metric.workflow')
}

/**
 * Error thrown when workflow handler reaches max runs limit.
 */
export class MaxRunsExceededError extends Error {
  public readonly maxRuns: number
  public readonly currentRun: number

  constructor(maxRuns: number, currentRun: number) {
    super(`Max runs exceeded: ${currentRun} >= ${maxRuns}`)
    this.name = 'MaxRunsExceededError'
    this.maxRuns = maxRuns
    this.currentRun = currentRun
  }
}

/**
 * Error thrown when workflow handler exceeds max time limit.
 */
export class MaxTimeExceededError extends Error {
  public readonly maxTimeMs: number
  public readonly elapsedTimeMs: number

  constructor(maxTimeMs: number, elapsedTimeMs: number) {
    super(
      `Max time exceeded: ${elapsedTimeMs}ms >= ${maxTimeMs}ms (${Math.round(elapsedTimeMs / 1000 / 60)} minutes)`
    )
    this.name = 'MaxTimeExceededError'
    this.maxTimeMs = maxTimeMs
    this.elapsedTimeMs = elapsedTimeMs
  }
}

/**
 * Error thrown to abort workflow processing without re-queuing.
 */
export class WorkflowAbortError extends Error {
  constructor(message = 'Workflow processing aborted') {
    super(message)
    this.name = 'WorkflowAbortError'
  }
}

const ABORT_ERROR_NAME = 'AbortError'

/**
 * Check if an error is an abort error (either WorkflowAbortError or standard AbortError).
 */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof WorkflowAbortError ||
    (error != null &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === ABORT_ERROR_NAME)
  )
}

/**
 * Internal metadata tracked across workflow invocations.
 */
const WorkflowMetaSchema = z.object({
  /** Number of times the handler has been invoked */
  runCount: z.number().int().min(0),
  /** Timestamp (ms) when the first invocation started */
  startedAt: z.number().int(),
  /** Timestamp (ms) of the last invocation */
  lastRunAt: z.number().int(),
  /**
   * Stable identity of this workflow instance, set once by sendWorkflowEvent and
   * preserved across re-queues. Drives the per-step deduplicationId
   * (`${workflowId}-${nextRun}`) and is the default flowKey. Required - every
   * event carries one, so there is no timestamp-derived fallback to collide on.
   */
  workflowId: z.string(),
  /**
   * Flow-control grouping key for `parallel: 1` serialization. Decoupled from
   * `workflowId` so callers can serialize *across* workflow instances that share
   * a resource (e.g. all messaging turns of one conversation) while keeping each
   * instance's step-dedup root unique. Defaults to `workflowId` when unset, so
   * existing single-instance workflows (tasks) are unaffected.
   */
  flowKey: z.string().optional(),
})

type WorkflowMeta = z.infer<typeof WorkflowMetaSchema>

/**
 * Handler context passed to workflow handlers.
 */
export interface WorkflowHandlerContext {
  /** Abort signal that fires on timeout */
  signal: AbortSignal
  /** Current run count (1-indexed) */
  runCount: number
  /** Remaining runs before maxRuns is exceeded, or Infinity if no maxRuns */
  remainingRuns: number
  /** Total elapsed time since first invocation (ms) */
  elapsedTimeMs: number
  /** Time remaining before maxTime is exceeded (ms), or Infinity if no maxTime */
  remainingTimeMs: number
}

/**
 * Result returned by a workflow handler.
 * - Return an object with `state` (and optional `delaySeconds`) to continue
 * - Return null/undefined to stop (completed successfully)
 */
export interface WorkflowHandlerResult<TState> {
  /** The new state to continue processing */
  state: TState
  /** Optional delay in seconds before the next invocation (overrides config) */
  delaySeconds?: number
}

/**
 * Callback type for when a limit is exceeded.
 */
type LimitExceededCallback<TState> =
  | 'error'
  | 'stop'
  | ((state: TState, meta: WorkflowMeta) => Promise<void>)

/**
 * Base configuration shared by all workflow handler configs.
 */
interface WorkflowConfigBase<TState> {
  /**
   * The queue route to re-queue to
   */
  route: `/api/v1/${string}` | `/api/system/${string}`
  /**
   * Zod schema for the state (input and output are the same type)
   */
  stateSchema: ZodType<TState>
  /**
   * Delay in seconds before next queue invocation
   */
  delaySeconds?: number
  /**
   * Optional callback invoked when the handler aborts. Fires for both
   * step-budget timeouts (default `WorkflowAbortError` message) and
   * explicit `WorkflowAbortError` throws from inside the handler - the
   * caller inspects `error.message` to differentiate.
   *
   * Not invoked for aborts originating from `onMaxRunsExceeded` /
   * `onMaxTimeExceeded` callbacks (those are already abort hooks for
   * their cases). Errors thrown from `onAbort` are captured but never
   * propagated.
   */
  onAbort?: (state: TState, meta: WorkflowMeta, error: Error) => Promise<void>
  /**
   * The handler function that processes a single workflow step
   */
  handler: (
    state: TState,
    context: WorkflowHandlerContext
  ) => Promise<WorkflowHandlerResult<TState> | null | undefined>
}

/**
 * Configuration with maxRuns limit only.
 * Requires onMaxRunsExceeded to be specified.
 */
interface WorkflowConfigWithMaxRunsOnly<TState>
  extends WorkflowConfigBase<TState> {
  /** Maximum number of handler invocations */
  maxRuns: number
  /** Callback when max runs is exceeded (required when maxRuns is set) */
  onMaxRunsExceeded: LimitExceededCallback<TState>
  /** Maximum total execution time is not set */
  maxTimeMs?: never
  /** Not applicable when maxTimeMs is not set */
  onMaxTimeExceeded?: never
}

/**
 * Configuration with maxTimeMs limit only.
 * Requires onMaxTimeExceeded to be specified.
 */
interface WorkflowConfigWithMaxTimeOnly<TState>
  extends WorkflowConfigBase<TState> {
  /** Maximum number of handler invocations is not set */
  maxRuns?: never
  /** Not applicable when maxRuns is not set */
  onMaxRunsExceeded?: never
  /** Maximum total execution time in milliseconds */
  maxTimeMs: number
  /** Callback when max time is exceeded (required when maxTimeMs is set) */
  onMaxTimeExceeded: LimitExceededCallback<TState>
}

/**
 * Configuration with both maxRuns and maxTimeMs limits.
 * Requires both callbacks to be specified.
 */
interface WorkflowConfigWithBothLimits<TState>
  extends WorkflowConfigBase<TState> {
  /** Maximum number of handler invocations */
  maxRuns: number
  /** Callback when max runs is exceeded (required when maxRuns is set) */
  onMaxRunsExceeded: LimitExceededCallback<TState>
  /** Maximum total execution time in milliseconds */
  maxTimeMs: number
  /** Callback when max time is exceeded (required when maxTimeMs is set) */
  onMaxTimeExceeded: LimitExceededCallback<TState>
}

type WorkflowConfig<TState> =
  | WorkflowConfigWithMaxRunsOnly<TState>
  | WorkflowConfigWithMaxTimeOnly<TState>
  | WorkflowConfigWithBothLimits<TState>

/**
 * Parsed envelope type for workflow messages.
 */
interface WorkflowEnvelope<TState> {
  type: typeof WORKFLOW_EVENT_TYPE
  payload: {
    state: TState
    meta: WorkflowMeta
  }
}

/**
 * Creates a workflow queue handler that processes work in steps, re-queuing
 * after each step to avoid timeout limits.
 *
 * Either `maxRuns` or `maxTimeMs` must be provided to prevent infinite loops.
 * Both limits, when provided, must be positive integers.
 *
 * `maxTimeMs` is a total budget across all workflow executions (tracked from
 * `meta.startedAt`), not a per-invocation budget.
 * When a limit is provided, its corresponding callback is required.
 *
 * @param config - Configuration for the workflow handler
 * @returns A Next.js API handler
 * @throws Error if neither `maxRuns` nor `maxTimeMs` is provided
 * @throws Error if `maxRuns` is provided but is not a positive integer
 * @throws Error if `maxTimeMs` is provided but is not a positive integer
 * @throws MaxRunsExceededError if maxRuns is exceeded and onMaxRunsExceeded is 'error'
 * @throws MaxTimeExceededError if maxTimeMs is exceeded and onMaxTimeExceeded is 'error'
 */
export function withWorkflowHandler<TState>(config: WorkflowConfig<TState>) {
  const {
    route,
    stateSchema,
    maxRuns,
    maxTimeMs,
    delaySeconds = 0,
    onMaxRunsExceeded,
    onMaxTimeExceeded,
    onAbort,
    handler,
  } = config

  if (maxRuns === undefined && maxTimeMs === undefined) {
    throw new Error('Either maxRuns or maxTimeMs must be provided')
  }

  if (maxRuns !== undefined && (!Number.isInteger(maxRuns) || maxRuns <= 0)) {
    throw new Error('maxRuns must be a positive integer')
  }

  if (
    maxTimeMs !== undefined &&
    (!Number.isInteger(maxTimeMs) || maxTimeMs <= 0)
  ) {
    throw new Error('maxTimeMs must be a positive integer')
  }

  const envelopeSchema = z.object({
    type: z.literal(WORKFLOW_EVENT_TYPE),
    payload: z.object({
      state: stateSchema,
      meta: WorkflowMetaSchema,
    }),
  })

  return withQueue(
    withStreamContinuity(async function (req, stream) {
      const body = await parseRequestJson(req)

      debug(`received workflow payload`, { body }).log(
        'lib.workflow.withWorkflowHandler'
      )

      // Parse and validate the envelope

      const parseResult = envelopeSchema.safeParse(body)

      if (!parseResult.success) {
        throwBadRequest(
          `Invalid workflow queue payload: ${parseResult.error.message}`
        )
      }

      const envelope = parseResult.data as WorkflowEnvelope<TState>
      const { state, meta } = envelope.payload

      const now = Date.now()
      const elapsedTimeMs = Math.max(0, now - meta.startedAt)
      const currentRun = meta.runCount + 1

      // Check max runs limit

      if (maxRuns !== undefined && currentRun > maxRuns) {
        debug(`max runs exceeded`, { maxRuns, currentRun }).log(
          'lib.workflow.withWorkflowHandler'
        )

        recordWorkflowStepMetric({
          route,
          status: 'max_runs_exceeded',
          count: 1,
          runCount: currentRun,
          elapsedTimeMs,
          workflowId: meta.workflowId,
        })

        const exceededMeta: WorkflowMeta = {
          ...meta,
          runCount: currentRun,
          lastRunAt: Date.now(),
        }

        if (onMaxRunsExceeded === 'error') {
          // Capture-and-signal: alert telemetry and tear down the stream,
          // then return cleanly so QStash doesn't retry-storm the same
          // already-exceeded payload.

          const err = new MaxRunsExceededError(maxRuns, currentRun)

          try {
            await captureUnknownException(err)
          } catch {
            // capture failure must not prevent stream teardown
          }

          await stream.error(err)

          return
        } else if (onMaxRunsExceeded === 'stop') {
          return
        }

        try {
          await onMaxRunsExceeded(state, exceededMeta)
        } catch (callbackError) {
          if (isAbortError(callbackError)) {
            return
          }

          try {
            await captureUnknownException(callbackError)
          } catch {
            // capture failure must not prevent stream teardown
          }

          await stream.error(callbackError as Error)
        }

        return
      }

      // Check max time limit

      if (maxTimeMs !== undefined && elapsedTimeMs >= maxTimeMs) {
        debug(`max time exceeded`, { maxTimeMs, elapsedTimeMs }).log(
          'lib.workflow.withWorkflowHandler'
        )

        recordWorkflowStepMetric({
          route,
          status: 'max_time_exceeded',
          count: 1,
          runCount: currentRun,
          elapsedTimeMs,
          workflowId: meta.workflowId,
        })

        const exceededMeta: WorkflowMeta = {
          ...meta,
          runCount: currentRun,
          lastRunAt: Date.now(),
        }

        if (onMaxTimeExceeded === 'error') {
          // Capture-and-signal: alert telemetry and tear down the stream,
          // then return cleanly so QStash doesn't retry-storm the same
          // already-exceeded payload.

          const err = new MaxTimeExceededError(maxTimeMs, elapsedTimeMs)

          try {
            await captureUnknownException(err)
          } catch {
            // capture failure must not prevent stream teardown
          }

          await stream.error(err)

          return
        } else if (onMaxTimeExceeded === 'stop') {
          return
        }

        try {
          await onMaxTimeExceeded(state, exceededMeta)
        } catch (callbackError) {
          if (isAbortError(callbackError)) {
            return
          }

          try {
            await captureUnknownException(callbackError)
          } catch {
            // capture failure must not prevent stream teardown
          }

          await stream.error(callbackError as Error)
        }

        return
      }

      // Set up abort controller for timeout

      const abortController = new AbortController()

      // Calculate remaining time (use a conservative buffer)

      const remainingTimeMs =
        maxTimeMs !== undefined
          ? Math.max(0, maxTimeMs - elapsedTimeMs)
          : Infinity

      // Calculate remaining runs

      const remainingRuns =
        maxRuns !== undefined ? maxRuns - currentRun : Infinity

      let abortTimeoutId: ReturnType<typeof setTimeout> | undefined

      if (Number.isFinite(remainingTimeMs)) {
        const timeoutDelayMs = Math.min(
          Math.max(0, remainingTimeMs),
          MAX_SET_TIMEOUT_MS
        )

        abortTimeoutId = setTimeout(() => {
          abortController.abort()
        }, timeoutDelayMs)
      }

      const context: WorkflowHandlerContext = {
        signal: abortController.signal,
        runCount: currentRun,
        remainingRuns,
        elapsedTimeMs,
        remainingTimeMs,
      }

      const abortPromise = new Promise<never>((_resolve, reject) => {
        abortController.signal.addEventListener(
          'abort',
          () => reject(new WorkflowAbortError()),
          { once: true }
        )
      })

      let stepStartedAt = 0

      try {
        debug(`executing workflow handler`, {
          runCount: currentRun,
          elapsedTimeMs,
          remainingTimeMs,
        }).log('lib.workflow.withWorkflowHandler')

        stepStartedAt = Date.now()

        recordWorkflowStepMetric({
          route,
          status: 'started',
          count: 1,
          runCount: currentRun,
          elapsedTimeMs,
          remainingTimeMs,
          remainingRuns,
          workflowId: meta.workflowId,
        })

        const result = await Promise.race([
          handler(state, context),
          abortPromise,
        ])

        // Handler produced a result: stop the abort timer so the post-handler
        // work (state validation, re-queue) can't trip a spurious abort.

        if (abortTimeoutId !== undefined) {
          clearTimeout(abortTimeoutId)
          abortTimeoutId = undefined
        }

        // If handler returns null/undefined, we're done

        if (result === null || result === undefined) {
          const totalTimeMs = Date.now() - meta.startedAt

          debug(`workflow handler completed`, {
            totalRuns: currentRun,
            totalTimeMs,
          }).log('lib.workflow.withWorkflowHandler')

          recordWorkflowStepMetric({
            route,
            status: 'completed',
            count: 1,
            runCount: currentRun,
            totalRuns: currentRun,
            elapsedTimeMs,
            totalTimeMs,
            durationMs: Date.now() - stepStartedAt,
            workflowId: meta.workflowId,
          })

          return
        }

        // Extract state and per-step delay from handler result

        const effectiveDelay = result.delaySeconds ?? delaySeconds

        // Validate the new state

        const validatedState = stateSchema.parse(result.state)

        // Update metadata

        const newMeta: WorkflowMeta = {
          runCount: currentRun,
          startedAt: meta.startedAt,
          lastRunAt: Date.now(),
          workflowId: meta.workflowId,
          flowKey: meta.flowKey,
        }

        // Re-queue for next step. The deduplicationId is stable per
        // (workflow instance, next-step number), so QStash redeliveries
        // of the same step collide while legitimate next steps don't.

        const instanceId = meta.workflowId
        const nextRun = currentRun + 1
        const deduplicationId = `${instanceId}-${nextRun}`

        // Serialize on `flowKey` if provided (e.g. per-conversation across
        // instances); otherwise default to this instance's own identity.
        const flowKey = meta.flowKey ?? instanceId

        debug(`re-queuing workflow handler`, {
          nextRun,
          delaySeconds: effectiveDelay,
          deduplicationId,
        }).log('lib.workflow.withWorkflowHandler')

        await queue(
          route,
          {
            type: WORKFLOW_EVENT_TYPE,
            payload: {
              state: validatedState,
              meta: newMeta,
            },
          },
          {
            delayInSeconds: effectiveDelay > 0 ? effectiveDelay : undefined,
            deduplicationId,
            flow: {
              key: flowKey,
              parallel: 1,
            },
          }
        )

        recordWorkflowStepMetric({
          route,
          status: 'continued',
          count: 1,
          runCount: currentRun,
          elapsedTimeMs,
          durationMs: Date.now() - stepStartedAt,
          nextRun,
          delaySeconds: effectiveDelay,
          workflowId: meta.workflowId,
        })
      } catch (e) {
        // Don't re-queue on abort errors

        if (isAbortError(e)) {
          const durationMs =
            stepStartedAt > 0 ? Date.now() - stepStartedAt : undefined

          debug(`workflow handler aborted`, { error: e }).log(
            'lib.workflow.withWorkflowHandler'
          )

          recordWorkflowStepMetric({
            route,
            status: 'aborted',
            count: 1,
            runCount: currentRun,
            elapsedTimeMs: Date.now() - meta.startedAt,
            durationMs,
            workflowId: meta.workflowId,
          })

          try {
            await captureObservation(
              `Workflow handler aborted: ${e instanceof Error ? e.message : String(e)}`,
              {
                route,
                runCount: currentRun,
                elapsedTimeMs: Date.now() - meta.startedAt,
              }
            )
          } catch {
            // observation failure must not propagate
          }

          // Only fire onAbort for handler-originated aborts. If our own
          // step-timeout AbortController fired, the signal will be aborted -
          // skip the callback in that case (the step-budget metric and
          // captureObservation above already record it).

          if (onAbort && !abortController.signal.aborted) {
            const abortMeta: WorkflowMeta = {
              ...meta,
              runCount: currentRun,
              lastRunAt: Date.now(),
            }

            try {
              await onAbort(state, abortMeta, e as Error)
            } catch (callbackError) {
              if (!isAbortError(callbackError)) {
                try {
                  await captureUnknownException(callbackError)
                } catch {
                  // capture failure must not propagate
                }
              }
            }
          }

          return
        }

        try {
          await captureUnknownException(e)
        } catch {
          // captureUnknownException failure must not prevent stream teardown
        }

        const durationMs =
          stepStartedAt > 0 ? Date.now() - stepStartedAt : undefined

        recordWorkflowStepMetric({
          route,
          status: 'failed',
          count: 1,
          runCount: currentRun,
          elapsedTimeMs: Date.now() - meta.startedAt,
          durationMs,
          workflowId: meta.workflowId,
        })

        await stream.error(e as Error)
      } finally {
        if (abortTimeoutId !== undefined) {
          clearTimeout(abortTimeoutId)
          abortTimeoutId = undefined
        }
      }
    })
  )
}

/**
 * Send an initial event to start a workflow queue operation.
 *
 * @param route - The queue route
 * @param initialState - The initial state to start with
 * @param options - Optional queue options
 */
export async function sendWorkflowEvent<TState>(
  route: `/api/v1/${string}` | `/api/system/${string}`,
  initialState: TState,
  options: {
    /**
     * Required, explicit identity of this workflow instance. It dedups the
     * initial queue delivery AND seeds every step's dedup id
     * (`${workflowId}-${nextRun}`). Make it unique per instance you want to run
     * - per task execution, per inbound message - so distinct instances don't
     * collide on their steps.
     */
    workflowId: string
    /**
     * Flow-control grouping key for `parallel: 1`. Defaults to `workflowId`.
     * Pass a shared resource id - e.g. a conversation/session - to serialize
     * across distinct instances that touch it, while each keeps its own unique
     * `workflowId` (and thus its own step-dedup root).
     */
    flowKey?: string
    /**
     * The delay in seconds before the first queue invocation. Defaults to 0.
     * This is a per-instance delay, not a per-step delay. Each step can override
     * it with its own `delaySeconds` in the handler result.
     */
    delayInSeconds?: number
  }
): Promise<void> {
  const now = Date.now()

  const { workflowId, flowKey = workflowId, delayInSeconds } = options

  const meta: WorkflowMeta = {
    runCount: 0,
    startedAt: now,
    lastRunAt: now,
    workflowId: workflowId,
    flowKey: flowKey,
  }

  await queue(
    route,
    {
      type: WORKFLOW_EVENT_TYPE,
      payload: {
        state: initialState,
        meta: meta,
      },
    },
    {
      delayInSeconds: delayInSeconds,

      // initial-delivery dedup on the instance identity
      deduplicationId: workflowId,

      flow: {
        key: flowKey,
        parallel: 1,
      },
    }
  )
}
