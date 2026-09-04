/* global globalThis */
import debug, { createSpan, warn } from '@/lib/debug'
import { captureError, captureException } from '@/lib/error'

import { AsyncLocalStorage } from 'async_hooks'

// @note vercel is recommending to use after from next/server but for some
// reason we don't get any type definitions for it, so we are using the
// beforeClose function instead.
//
// @see https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package

/**
 * Keeps a promise alive past the response on runtimes that would otherwise
 * freeze the function once the response is sent.
 *
 * @note this is the whole of `@vercel/functions`' `waitUntil`: the runtime
 * publishes a request context under a well-known global symbol, and if it
 * carries a `waitUntil` the promise is handed to it. Anywhere else - a
 * long-running Node process, a container, tests - the process simply keeps
 * running and the promise finishes on its own, so nothing needs doing. Kept
 * in-tree so a deployment that never runs on Vercel does not carry the
 * vendor package for one optional chained call.
 */
function getWaitUntil(): ((p: Promise<unknown>) => void) | undefined {
  const context = (
    globalThis as {
      [key: symbol]: {
        get?: () => { waitUntil?: (p: Promise<unknown>) => void }
      }
    }
  )[Symbol.for('@vercel/request-context')]

  return context?.get?.()?.waitUntil
}

function waitUntil(promise: Promise<unknown>): void {
  getWaitUntil()?.(promise)
}

interface Store {
  deferred: Promise<unknown>[]
}

async function beforeClose(
  response: Response,
  callback: () => Promise<void>
): Promise<Response> {
  const body = response.body

  if (body instanceof ReadableStream) {
    return new Response(
      new ReadableStream({
        async start(controller) {
          const reader = body.getReader()

          try {
            while (true) {
              const { done, value } = await reader.read()

              if (done) {
                await callback()

                break
              }

              controller.enqueue(value)
            }
          } catch (e) {
            await captureException(e)

            controller.error(e)
          } finally {
            reader.releaseLock()

            controller.close()
          }
        },
      }),
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }
    )
  } else {
    await callback()

    return response
  }
}

const als = new AsyncLocalStorage<Store>()

/**
 * Awaits all deferred promises.
 */
export async function awaitDeferred(): Promise<void> {
  const span = createSpan({ name: 'awaitDeferred' })

  try {
    const store = als.getStore()

    if (store) {
      const deferredPromises = store.deferred || []

      let awaitedCount = 0

      // @note Typically, we would clear the deferred promises in this function
      // in order to ensure that future calls do not re-await the same promises.
      // However, doing so would introduce a risk in the current implementation
      // where the deferred promises are awaiting but the main function has
      // returned. This means that the deferred promises could get lost. This is
      // why we are deliberately not clearing the deferred promises here and let
      // the main function handle it. This is a trade-off between safety and
      // performance. See all the other notes in the code for more information.

      // store.deferred = [] // @note deliberately disabled

      if (deferredPromises.length > 0) {
        while (awaitedCount < deferredPromises.length) {
          const batch = deferredPromises.slice(awaitedCount)

          awaitedCount = deferredPromises.length

          debug(`awaiting ${batch.length} deferred promises`)

          await Promise.all(batch)
        }

        debug(`all deferred promises resolved`)
      }
    }
  } finally {
    span.finish()
  }
}

/**
 * Runs a function with deferred promises.
 */
export function runInDeferred<T>(
  fn: (...args: unknown[]) => Promise<T>
): (...args: unknown[]) => Promise<T> {
  return async function (...args: unknown[]): Promise<T> {
    return await als.run({ deferred: [] }, async () => {
      let result = await fn(...args)

      waitUntil(awaitDeferred())

      if (result instanceof Response) {
        result = (await beforeClose(result, awaitDeferred)) as Awaited<T>
      } else {
        await awaitDeferred()
      }

      return result
    })
  }
}

/**
 * Get the current store from the async local storage.
 */
function getStore(): Store | undefined {
  const store = als.getStore()

  if (!store) {
    warn('getStore() must be called within a runWithDeferred() context')
  }

  return store
}

/**
 * Adds a promise to the list of deferred promises. This function should always
 * be awaited to handle situations where the function is not called within a
 * runWithDeferred() context.
 */
export async function defer(
  fn: Promise<unknown> | (() => Promise<unknown>)
): Promise<void> {
  const promise = typeof fn === 'function' ? fn() : fn

  const store = getStore()

  if (store) {
    // @note add the promise to the list of deferred promises

    store.deferred = store.deferred || []

    store.deferred.push(promise.catch(captureError))
  } else {
    // @note await the promise if not in a runWithDeferred() context

    await promise.catch(captureError)
  }
}

/**
 * Runs work after the response is sent rather than before it. `defer` holds a
 * plain (non-streaming) response until its promises settle - see `beforeClose`
 * - so a webhook that must ack within a deadline cannot put its publish there.
 * When the runtime cannot keep the function alive past the response the work
 * is awaited in place, exactly as `defer` would do.
 */
export async function deferPastResponse(
  fn: () => Promise<unknown>
): Promise<void> {
  const keepAlive = getWaitUntil()

  if (!keepAlive) {
    await defer(async () => {
      await fn()
    })

    return
  }

  // @note a fresh store, so anything `fn` itself defers settles on this promise
  // and not on the request store, whose `beforeClose` would hold the response

  keepAlive(
    als
      .run({ deferred: [] }, async () => {
        await fn()

        await awaitDeferred()
      })
      .catch(captureError)
  )
}

export default defer
