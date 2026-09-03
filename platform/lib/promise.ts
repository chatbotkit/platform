import { captureError } from '@/lib/error'

/**
 * This function is used to sleep for a given number of milliseconds.
 */
export async function sleep(delay: number): Promise<null> {
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve(null)
    }, delay)
  )
}

/**
 * This function will wait until aborted.
 */
export async function wait(abortSignal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (abortSignal.aborted) {
      resolve()

      return
    }

    const onAbort = () => {
      abortSignal.removeEventListener('abort', onAbort)

      resolve()
    }

    abortSignal.addEventListener('abort', onAbort)
  })
}

/**
 * This function will return true if all promises resolve to a truthy value.
 */
export async function allTrue(promises: Promise<unknown>[]): Promise<boolean> {
  return await Promise.all(promises).then((results) => results.every(Boolean))
}

/**
 * This function will return true if any promise resolves to a truthy value.
 */
export async function anyTrue(promises: Promise<unknown>[]): Promise<boolean> {
  return await Promise.all(promises).then((results) => results.some(Boolean))
}

/**
 * This function will return true if all promises resolve to a falsy value.
 */
export async function neitherTrue(
  promises: Promise<unknown>[]
): Promise<boolean> {
  return await Promise.all(promises).then((results) => !results.some(Boolean))
}

/**
 * This function will return the result of the promise, or a default value if
 * the promise rejects.
 */
export async function fallbackOnFailure<T>(
  promise: Promise<T>,
  defaultValue: T
): Promise<T> {
  return await promise.catch(async (e) => {
    await captureError(e)

    return defaultValue
  })
}

// @note private identity marker for a bypassed await; never leaks to callers.
const BYPASSED = Symbol('promise-bypassed')

/**
 * Awaits `promise`, but stops waiting for it once `signal` has aborted plus a
 * `graceMs` grace period, resolving with `onBypass()` instead. The grace gives a
 * cooperative operation - one that observes the signal - a moment to settle on
 * its own before it is bypassed.
 *
 * The underlying promise is NOT cancelled (a Promise cannot be); it keeps running
 * after a bypass, and a later rejection is swallowed so it does not surface as an
 * unhandled rejection. A rejection that arrives while we are still waiting is
 * propagated normally. With no signal - or as long as the signal has not aborted
 * - this is a plain await of `promise`.
 */
export async function awaitWithAbortGrace<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  graceMs: number,
  onBypass: () => T
): Promise<T> {
  if (!signal) {
    return await promise
  }

  // @note swallow a rejection that arrives after a bypass; one that arrives
  // while we are still waiting is delivered through the race below.
  promise.catch(() => {})

  let graceTimer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined

  const bypassPromise = new Promise<typeof BYPASSED>((resolve) => {
    const arm = () => {
      graceTimer = setTimeout(() => resolve(BYPASSED), graceMs)
    }

    if (signal.aborted) {
      arm()
    } else {
      onAbort = arm

      signal.addEventListener('abort', arm, { once: true })
    }
  })

  try {
    const outcome = await Promise.race([promise, bypassPromise])

    return outcome === BYPASSED ? onBypass() : outcome
  } finally {
    if (graceTimer) {
      clearTimeout(graceTimer)
    }

    if (onAbort) {
      signal.removeEventListener('abort', onAbort)
    }
  }
}
