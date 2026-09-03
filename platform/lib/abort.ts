export type PeriodicAbortCheckOptions = {
  signal?: AbortSignal | null
  intervalMs?: number
  reason?: unknown
  onError?: (error: unknown) => void | Promise<void>
  shouldAbort: () => boolean | Promise<boolean>
}

export type PeriodicAbortCheck = {
  signal: AbortSignal
  dispose: () => void
}

const DEFAULT_ABORT_CHECK_INTERVAL_MS = 5000

/**
 * Wraps an existing AbortSignal with a periodic async abort check.
 */
export function withPeriodicAbortCheck({
  signal,
  intervalMs = DEFAULT_ABORT_CHECK_INTERVAL_MS,
  reason,
  onError,
  shouldAbort,
}: PeriodicAbortCheckOptions): PeriodicAbortCheck {
  const controller = new AbortController()

  let disposed = false
  let checking = false
  let intervalId: ReturnType<typeof setInterval> | undefined
  let parentAbortHandler: (() => void) | undefined

  const dispose = () => {
    disposed = true

    if (intervalId) {
      clearInterval(intervalId)
      intervalId = undefined
    }

    if (signal && parentAbortHandler) {
      signal.removeEventListener('abort', parentAbortHandler)
      parentAbortHandler = undefined
    }
  }

  const abort = (abortReason: unknown) => {
    if (!controller.signal.aborted) {
      controller.abort(abortReason)
    }

    dispose()
  }

  const check = async () => {
    if (disposed || checking || controller.signal.aborted) {
      return
    }

    checking = true

    try {
      if (await shouldAbort()) {
        abort(reason)
      }
    } catch (error) {
      if (onError) {
        try {
          await onError(error)
        } catch {
          // ignore abort-check error handling failures
        }
      }
    } finally {
      checking = false
    }
  }

  if (signal?.aborted) {
    abort(signal.reason)
  } else if (signal) {
    parentAbortHandler = () => abort(signal.reason)

    signal.addEventListener('abort', parentAbortHandler)
  }

  if (!controller.signal.aborted) {
    intervalId = setInterval(() => {
      void check()
    }, intervalMs)

    ;(intervalId as { unref?: () => void }).unref?.()
  }

  return {
    signal: controller.signal,
    dispose,
  }
}
