import { captureError } from '@/lib/error'
import { batchAsync } from '@/lib/it'

// ---
// ---
// ---

export type AbortableTask<T = unknown> = {
  abort: () => void
  promise: Promise<T>
  signal: AbortSignal
}

/**
 * Run a task with an AbortSignal and return an abort handle.
 *
 * @param fn - Function that receives the task abort signal
 * @returns Abort handle, task promise, and task signal
 */
export function runAbortableTask<T>(
  fn: (abortSignal: AbortSignal) => Promise<T>
): AbortableTask<T> {
  const abortController = new AbortController()

  let promise: Promise<T>

  try {
    promise = fn(abortController.signal)
  } catch (e) {
    promise = Promise.reject(e)
  }

  return {
    abort: () => abortController.abort(),
    promise,
    signal: abortController.signal,
  }
}

// ---
// ---
// ---

/**
 * Race an array of tasks in parallel and capture any errors.
 *
 * @param tasks - Array of promises or functions that return promises
 * @returns The result of the first resolved task, or undefined if empty
 */
export async function raceTasks<T>(
  tasks: (Promise<T> | ((..._args: unknown[]) => Promise<T>))[]
): Promise<T | undefined> {
  if (!tasks.length) {
    return
  }

  return await Promise.race(
    tasks.map((task) => {
      return typeof task === 'function' ? task() : task
    })
  )
}

/**
 * Run an array of tasks in parallel and capture any errors.
 *
 * @param tasks - Array of promises or functions that return promises
 * @returns True if all tasks succeeded, false if any failed
 */
export async function runTasks(
  tasks: (Promise<unknown> | ((..._args: unknown[]) => Promise<unknown>))[]
): Promise<boolean> {
  let success = true

  try {
    const results = await Promise.allSettled(
      tasks.map((task) => {
        return typeof task === 'function' ? task() : task
      })
    )

    await Promise.all(
      results.map(async (result) => {
        if (result.status === 'rejected') {
          success = false

          await captureError(result.reason)
        }
      })
    )
  } catch (e) {
    await captureError(e)

    success = false
  }

  return success
}

/**
 * Run an iterable of tasks in parallel and capture any errors.
 *
 * @param maxWorkers - Maximum number of concurrent workers
 * @param iterable - Iterable or async iterable to process
 * @param handler - Function to handle the iterable stream
 * @returns True if all tasks succeeded, false if any failed
 */
export async function runTasksIt<T>(
  maxWorkers: number,
  iterable: Iterable<T> | AsyncIterable<T>,
  handler: (it: AsyncIterable<T>) => Promise<void>
): Promise<boolean> {
  const it = async function* (): AsyncGenerator<T> {
    yield* iterable as AsyncIterable<T>
  }

  return await runTasks(Array(Math.max(maxWorkers, 1)).fill(it()).map(handler))
}

/**
 * Run an iterable of tasks in parallel and call a handler for each item.
 *
 * @param maxWorkers - Maximum number of concurrent workers
 * @param it - Iterable or async iterable to process
 * @param handler - Function to handle each item
 * @returns True if all tasks succeeded, false if any failed
 */
export async function runTasksEach<T>(
  maxWorkers: number,
  it: Iterable<T> | AsyncIterable<T>,
  handler: (item: T) => Promise<void>
): Promise<boolean> {
  return runTasksIt(maxWorkers, it, async (it) => {
    for await (const item of it) {
      await handler(item)
    }
  })
}

/**
 * Run an iterable of tasks in parallel and call a handler for each batch of items.
 *
 * @param maxWorkers - Maximum number of concurrent workers
 * @param it - Iterable or async iterable to process
 * @param handler - Function to handle each batch of items
 * @param size - Size of each batch (default: 100)
 * @returns True if all tasks succeeded, false if any failed
 */
export async function runTasksBatch<T>(
  maxWorkers: number,
  it: Iterable<T> | AsyncIterable<T>,
  handler: (items: T[]) => Promise<void>,
  size: number = 100
): Promise<boolean> {
  return runTasksIt(maxWorkers, it, async (it) => {
    for await (const items of batchAsync(it, size)) {
      await handler(items)
    }
  })
}

/**
 * Run an iterable of tasks in parallel, map each item to a new value, and return the mapped results in the original order.
 *
 * @param maxWorkers - Maximum number of concurrent workers
 * @param it - Iterable or async iterable to process
 * @param mapper - Function to map each item to a new value
 * @returns Array of mapped results, with undefined for any failed items
 */
export async function runTasksMap<T, U>(
  maxWorkers: number,
  it: Iterable<T> | AsyncIterable<T>,
  mapper: (item: T) => Promise<U>
): Promise<(U | undefined)[]> {
  const items: T[] = []

  for await (const item of it as AsyncIterable<T>) {
    items.push(item)
  }

  const results: (U | undefined)[] = Array(items.length)

  await runTasksEach(maxWorkers, items.entries(), async ([index, item]) => {
    results[index] = await mapper(item)
  })

  return results
}
