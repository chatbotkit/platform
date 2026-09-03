export type DebouncedAction = ReturnType<typeof createDebouncedAction>

/**
 * Generic leading-edge debounced action (a.k.a. simple leading throttle).
 *
 * Terminology:
 *  - We name it "debounced" here because the user intent is usually: "I don't
 *    want this to run more than once every N ms when spammed". Technically this
 *    is a leading throttle (executes immediately, then suppresses until the
 *    interval passes). To avoid ambiguity we also export an alias
 *    {@link createThrottledAction}.
 *
 * Behavior:
 *  - First call executes immediately (leading edge)
 *  - Calls within the interval are ignored
 *  - First call after the interval executes again
 *
 * Provided helpers:
 *  - force(): always execute immediately (and resets the window)
 *  - remaining(): ms left until next natural execution (0 if ready)
 *  - reset(): clears the window so next trigger() will execute
 *
 * Scope & State:
 *  - Purely in-memory per returned instance; no cross-process coordination.
 */
export function createDebouncedAction(options: {
  action: () => void | Promise<void>
  intervalMs?: number
}) {
  const { action, intervalMs = 10_000 } = options

  let lastAt = 0

  /**
   * Triggers the action immediately if outside the debounce window; otherwise
   * it's skipped silently.
   */
  async function trigger(): Promise<void> {
    const now = Date.now()

    if (now - lastAt < intervalMs) {
      return
    }

    lastAt = now

    await action()
  }

  /**
   * Forces the action to run regardless of the debounce window and resets the window.
   */
  async function force(): Promise<void> {
    lastAt = Date.now()

    await action()
  }

  /**
   * Returns milliseconds remaining until the next natural trigger would fire.
   */
  function remaining(): number {
    const diff = Date.now() - lastAt

    return diff >= intervalMs ? 0 : intervalMs - diff
  }

  /**
   * Clears the internal timer so the next trigger() calls executes immediately.
   */
  function reset(): void {
    lastAt = 0
  }

  return { trigger, force, remaining, reset, intervalMs }
}

/**
 * Alias that semantically emphasizes throttling. Identical implementation to
 *
 * {@link createDebouncedAction}.
 */
export const createThrottledAction = createDebouncedAction
