import debug from '@/lib/debug'
import { captureObservation, captureUnexpectedState } from '@/lib/error'

// @note debug namespace for all log lines emitted by this module
const LOG = 'lib.timeout.monitor'

// @todo make configurable

export const DEFAULT_QUEUE_TIMEOUT_MS = 750_000 // @note 750s default, 50s buffer before Vercel's 800s limit

// @note fractions of the timeout budget at which we fire a mark signal before
// the handler actually aborts at 100%. These give us visibility into how far a
// slow/stuck handler got before it timed out, instead of only learning about it
// at the very end.
export const QUEUE_TIMEOUT_MARKS = [0.2, 0.5, 0.8] as const

/**
 * Where a handler is on its timeout clock when a mark fires. This is wall-clock
 * elapsed time, not work done - it advances even for a stuck handler. Carried as
 * the `reason` of each mark signal returned by {@link createTimeoutMonitor}.
 */
export interface QueueTimeoutMark {
  /** Fraction of the timeout budget elapsed (one of {@link QUEUE_TIMEOUT_MARKS}). */
  mark: number
  /** Milliseconds elapsed since the handler started. */
  elapsedMs: number
  /**
   * True only for the last mark - the early warning that the handler is about to
   * hit the hard timeout. Consumers can react more strongly to this one (e.g. the
   * engine surfaces it to the model) without re-deriving lastness from
   * {@link QUEUE_TIMEOUT_MARKS}.
   */
  final: boolean
}

/**
 * Sets up a timeout monitor for a long-running handler. In addition to the hard
 * abort at {@link DEFAULT_QUEUE_TIMEOUT_MS}, it emits a non-aborting observation
 * and fires a dedicated `markSignal` at each of {@link QUEUE_TIMEOUT_MARKS}, so a
 * consumer can see a handler approaching its deadline rather than only the final
 * timeout.
 *
 * The mark signals reuse `AbortSignal` purely as a fire-once event primitive -
 * each carries a {@link QueueTimeoutMark} as its `reason`. They are NOT
 * cancellation signals and must never be merged into {@link createTimeoutMonitor}'s
 * returned `signal`.
 *
 * Used by the queue handler wrappers (see `@/lib/queue2`), but kept free of any
 * queue dependency so non-queue streaming routes (e.g. the conversation complete
 * endpoints) that run the engine inline can give it the same `timeoutMarks`
 * driving signals without being wrapped by a queue. Such callers should merge
 * the returned `signal` into their own cancellation path (e.g. the request abort
 * signal) and pass `markSignals` straight through to the engine.
 *
 * @returns the (cancellation) abort signal to pass to the handler, the per-mark
 *   signals, and a `dispose` to clear all pending timers (call it in a `finally`).
 */
export function createTimeoutMonitor({
  context,
  label = 'Queue handler',
}: {
  /** Identifying fields included on every notice (e.g. `type`, the bound param). */
  context: Record<string, unknown>
  /** Human-readable subject of the timeout notices (e.g. `Queue handler`). */
  label?: string
}): {
  signal: AbortSignal
  markSignals: AbortSignal[]
  dispose: () => void
} {
  const startTime = Date.now()

  const abortController = new AbortController()

  const timers: ReturnType<typeof setTimeout>[] = []

  const markControllers = QUEUE_TIMEOUT_MARKS.map(() => new AbortController())

  QUEUE_TIMEOUT_MARKS.forEach((mark, index) => {
    const percent = Math.round(mark * 100)

    const isLastMark = index === QUEUE_TIMEOUT_MARKS.length - 1

    const timer = setTimeout(() => {
      const elapsedMs = Date.now() - startTime

      debug(`${label} reached ${percent}% of timeout budget`, {
        ...context,
        elapsedMs,
      }).log(LOG)

      // @note the marks exist to drive the engine via markSignals (below); they
      // are not something we track. Only the final mark is reported to Sentry,
      // as an early warning that this handler is about to hit the hard timeout.
      if (isLastMark) {
        void captureObservation(
          `${label} reached ${percent}% of timeout budget`,
          {
            ...context,
            mark,
            elapsedMs,
            timeoutMs: DEFAULT_QUEUE_TIMEOUT_MS,
          },
          { sentry: true, level: 'warning' }
        )
      }

      // @note fire the mark signal so opted-in consumers (e.g. the engine) can
      // react. The reason carries the mark payload; listeners isolate their own
      // failures.
      const markController = markControllers[index]

      if (!markController.signal.aborted) {
        markController.abort(
          /** @type {QueueTimeoutMark} */ { mark, elapsedMs, final: isLastMark }
        )
      }
    }, DEFAULT_QUEUE_TIMEOUT_MS * mark)

    timers.push(timer)
  })

  const timeoutId = setTimeout(() => {
    debug('aborting request due to timeout', context).log(LOG)

    abortController.abort()

    void captureUnexpectedState(`${label} timed out`, {
      ...context,
      timeoutMs: DEFAULT_QUEUE_TIMEOUT_MS,
    })
  }, DEFAULT_QUEUE_TIMEOUT_MS)

  timers.push(timeoutId)

  return {
    signal: abortController.signal,
    markSignals: markControllers.map((controller) => controller.signal),
    dispose: () => {
      for (const timer of timers) {
        clearTimeout(timer)
      }
    },
  }
}
