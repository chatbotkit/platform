/**
 * Passes through an iterable without modification.
 *
 * @param it - The iterable to pass through
 * @returns An iterable that yields the same values
 */
export function* it<T>(it: Iterable<T>): Iterable<T> {
  for (const i of it) {
    yield i
  }
}

/**
 * Passes through an async iterable without modification.
 *
 * @param it - The async iterable to pass through
 * @returns An async iterable that yields the same values
 */
export async function* itAsync<T>(it: AsyncIterable<T>): AsyncIterable<T> {
  for await (const i of it) {
    yield i
  }
}

// ---
// ---
// ---

/**
 * Maps each element of an iterable through a transformation function.
 *
 * @param it - The iterable to map over
 * @param fn - The transformation function
 * @returns A generator that yields transformed values
 */
export function* map<T, U>(it: Iterable<T>, fn: (value: T) => U): Generator<U> {
  for (const i of it) {
    yield fn(i)
  }
}

/**
 * Maps each element of an async iterable through a transformation function.
 *
 * @param it - The async iterable to map over
 * @param fn - The transformation function
 * @returns An async generator that yields transformed values
 */
export async function* mapAsync<T, U>(
  it: AsyncIterable<T>,
  fn: (value: T) => U
): AsyncGenerator<U> {
  for await (const i of it) {
    yield fn(i)
  }
}

// ---
// ---
// ---

/**
 * Converts an iterable to an array.
 *
 * @param it - The iterable to convert
 * @returns An array containing all elements from the iterable
 */
export function toa<T>(it: Iterable<T>): T[] {
  const array: T[] = []

  for (const i of it) {
    array.push(i)
  }

  return array
}

/**
 * Converts an async iterable to an array.
 *
 * @param it - The async iterable to convert
 * @returns A promise that resolves to an array containing all elements
 */
export async function toaAsync<T>(it: AsyncIterable<T>): Promise<T[]> {
  const array: T[] = []

  for await (const i of it) {
    array.push(i)
  }

  return array
}

// ---
// ---
// ---

/**
 * Groups elements of an iterable into batches of a specified size.
 *
 * @param it - The iterable to batch
 * @param size - The size of each batch
 * @returns A generator that yields arrays of the specified size
 */
export function* batch<T>(it: Iterable<T>, size: number): Generator<T[]> {
  let batch: T[] = []

  for (const i of it) {
    batch.push(i)

    if (batch.length === size) {
      yield batch

      batch = []
    }
  }

  if (batch.length) {
    yield batch
  }
}

/**
 * Groups elements of an async iterable into batches of a specified size.
 *
 * @param it - The async iterable to batch
 * @param size - The size of each batch
 * @returns An async generator that yields arrays of the specified size
 */
export async function* batchAsync<T>(
  it: AsyncIterable<T>,
  size: number
): AsyncGenerator<T[]> {
  let batch: T[] = []

  for await (const i of it) {
    batch.push(i)

    if (batch.length === size) {
      yield batch

      batch = []
    }
  }

  if (batch.length) {
    yield batch
  }
}

// ---
// ---
// ---

/**
 * Combines multiple iterables into a single iterable sequence.
 *
 * @param its - The iterables to combine
 * @returns A generator that yields values from all iterables in order
 */
export function* combine<T>(...its: Iterable<T>[]): Generator<T> {
  for (const it of its) {
    for (const i of it) {
      yield i
    }
  }
}

/**
 * Combines multiple async iterables into a single async iterable sequence.
 *
 * @param its - The async iterables to combine
 * @returns An async generator that yields values from all iterables in order
 */
export async function* combineAsync<T>(
  ...its: AsyncIterable<T>[]
): AsyncGenerator<T> {
  for await (const it of its) {
    for await (const i of it) {
      yield i
    }
  }
}

// ---
// ---
// ---

/**
 * Creates an async iterable from an event-based function using a push queue.
 *
 * @param fn - A function that receives a push callback to emit events
 * @returns An async generator that yields events as they are pushed
 */
export async function* events<T>(
  fn: (push: (event: T) => void) => Promise<void> | void
): AsyncGenerator<T> {
  const queue: T[] = []

  let resolve: ((value?: unknown) => void) | undefined

  let done = false

  let error: Error | null = null

  const push = (event: T): void => {
    queue.push(event)

    if (resolve) {
      resolve()

      resolve = undefined
    }
  }

  void (async () => {
    try {
      await fn(push)
    } catch (e) {
      error = e as Error
    } finally {
      done = true

      if (resolve) {
        resolve()

        resolve = undefined
      }
    }
  })()

  while (!done || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise((res) => {
        resolve = res
      })
    }

    if (queue.length > 0) {
      const event = queue.shift()

      yield event as T
    }

    if (done && error) {
      throw error
    }
  }

  if (error) {
    throw error
  }
}

// ---
// ---
// ---

/**
 * Wraps an async generator so iteration can be stopped by an AbortSignal.
 *
 * @param sourceGenerator - The async generator to wrap
 * @param signal - The signal that stops iteration when aborted
 * @returns An async generator that completes when the signal is aborted
 */
export async function* cancelable<T>(
  sourceGenerator: AsyncGenerator<T>,
  signal: AbortSignal
): AsyncGenerator<T> {
  let resolveAbort: (result: IteratorResult<T>) => void = () => {}

  const abortPromise = new Promise<IteratorResult<T>>((resolve) => {
    resolveAbort = resolve
  })

  const abort = () => {
    resolveAbort({ done: true, value: undefined })
  }

  let sourceDone = false

  if (signal.aborted) {
    abort()
  } else {
    signal.addEventListener('abort', abort, { once: true })
  }

  try {
    while (!signal.aborted) {
      const result = await Promise.race([sourceGenerator.next(), abortPromise])

      if (result.done || signal.aborted) {
        sourceDone = result.done ?? false

        break
      }

      yield result.value
    }
  } finally {
    signal.removeEventListener('abort', abort)

    if (!sourceDone && sourceGenerator.return) {
      const returnPromise = sourceGenerator.return(undefined)

      if (signal.aborted) {
        void returnPromise.catch(() => {})
      } else {
        await returnPromise
      }
    }
  }
}

// ---
// ---
// ---

/**
 * Yields results from an array of promises as they resolve in parallel.
 *
 * @param promises - An array of promises to race
 * @returns An async generator that yields resolved values in completion order
 */
export async function* promises<T>(promises: Promise<T>[]): AsyncGenerator<T> {
  const activePromises = new Map(
    promises.map((promise, index) => [
      index,
      promise.then((result) => ({ result, index })),
    ])
  )

  while (activePromises.size > 0) {
    const promiseRace = Promise.race(activePromises.values())

    const { result, index } = await promiseRace

    yield result

    activePromises.delete(index)
  }
}

// ---
// ---
// ---

/**
 * Throttles an iterable to yield items at a minimum interval.
 *
 * @param it - The iterable or async iterable to throttle
 * @param ms - The minimum milliseconds between yielded items
 * @returns An async generator that yields items with throttling applied
 */
export async function* throttle<T>(
  it: AsyncIterable<T> | Iterable<T>,
  ms: number
): AsyncGenerator<T> {
  let lastTime = Date.now()

  for await (const i of it as AsyncIterable<T>) {
    const now = Date.now()
    const elapsed = now - lastTime

    if (elapsed < ms) {
      await new Promise((res) => setTimeout(res, ms - elapsed))
    }

    lastTime = Date.now()

    yield i
  }
}

/**
 * Throttles an iterable with randomized delays for more natural timing.
 *
 * @param it - The iterable or async iterable to throttle
 * @param baseMs - The base delay in milliseconds
 * @param variability - The range of random variation in milliseconds
 * @returns An async generator that yields items with variable throttling
 */
export async function* throttleWithVariability<T>(
  it: AsyncIterable<T> | Iterable<T>,
  baseMs: number,
  variability: number
): AsyncGenerator<T> {
  let lastTime = Date.now()

  for await (const i of it as AsyncIterable<T>) {
    const now = Date.now()
    const elapsed = now - lastTime

    const variableDelay = Math.random() * variability - variability / 2
    const delay = Math.max(0, baseMs + variableDelay)

    if (elapsed < delay) {
      await new Promise((res) => setTimeout(res, delay - elapsed))
    }

    lastTime = Date.now()

    yield i
  }
}

// ---
// ---
// ---

/**
 * Rate limit options for controlling message flow.
 */
export interface RateLimitOptions {
  /**
   * Rate limit in messages per second.
   */
  messagesPerSecond?: number

  /**
   * Maximum number of messages to process at once.
   */
  burstSize?: number

  /**
   * Distribute messages evenly across the time window.
   */
  smoothing?: boolean
}

/**
 * Creates a rate-limited wrapper around an async generator.
 *
 * @param sourceGenerator - The source async generator to consume
 * @param options - Configuration options for rate limiting
 * @returns An async generator that yields items with rate limiting applied
 */
export async function* rateLimit<T>(
  sourceGenerator: AsyncGenerator<T>,
  options: RateLimitOptions = {}
): AsyncGenerator<T> {
  const { messagesPerSecond = 10, burstSize = 1, smoothing = true } = options

  // calculate delay between messages in milliseconds

  const minDelay = 1000 / messagesPerSecond

  // token bucket implementation

  let tokens = burstSize
  let lastRefillTime = Date.now()

  for await (const item of sourceGenerator) {
    // refill tokens based on elapsed time

    const now = Date.now()
    const elapsedMs = now - lastRefillTime
    const newTokens = (elapsedMs / minDelay) * (smoothing ? 1 : burstSize)

    tokens = Math.min(burstSize, tokens + newTokens)
    lastRefillTime = now

    // if we don't have a full token, wait until we do

    if (tokens < 1) {
      const waitTime = minDelay * (1 - tokens)

      await new Promise((resolve) => setTimeout(resolve, waitTime))

      tokens = 1 // now we have one full token
    }

    // consume a token

    tokens -= 1

    // yield the item

    yield item
  }
}

/**
 * Creates a conditionally rate-limited wrapper around an async generator.
 *
 * @param sourceGenerator - The source async generator to consume
 * @param shouldRateLimit - Function that returns true if a message should trigger rate limiting
 * @param rateLimitOptions - Options to pass to the rateLimit function
 * @returns An async generator that applies rate limiting conditionally
 */
export async function* rateLimitWithCondition<T>(
  sourceGenerator: AsyncGenerator<T>,
  shouldRateLimit: (item: T) => boolean,
  rateLimitOptions: RateLimitOptions = {}
): AsyncGenerator<T> {
  let buffer: T[] = []

  let generator: AsyncGenerator<T> = sourceGenerator

  let isRateLimited = false

  while (true) {
    // get next item using the current generator strategy

    const { value: item, done } = await generator.next()

    if (done) {
      break
    }

    const needsRateLimit = shouldRateLimit(item)

    if (needsRateLimit && !isRateLimited) {
      // switch to rate-limited mode

      isRateLimited = true
      buffer = [item] // start buffer with current item

      // create new generator pipeline and restart iteration

      const bufferGen = createBufferGenerator(buffer, sourceGenerator)

      generator = rateLimit(bufferGen, rateLimitOptions)

      continue
    } else if (!needsRateLimit && isRateLimited) {
      // switch to direct mode

      isRateLimited = false

      buffer = [item] // start buffer with current item

      // create new generator pipeline and restart iteration

      generator = createBufferGenerator(buffer, sourceGenerator)

      continue
    }

    yield item
  }

  // helper function

  async function* createBufferGenerator(
    buffer: T[],
    source: AsyncGenerator<T>
  ): AsyncGenerator<T> {
    for (const item of buffer) {
      yield item
    }

    yield* source
  }
}

// ---
// ---
// ---

/**
 * Generator or function that returns a generator.
 */
export type GeneratorOrFunction<T> =
  | AsyncGenerator<T>
  | Generator<T>
  | (() => AsyncGenerator<T> | Generator<T>)

/**
 * This function takes and array of async generators or generator functions and yields their values sequentially.
 *
 * @param generators - Array of generators or generator functions to process
 * @returns An async generator that yields all values in sequence
 */
export async function* yieldSequentiallyFromParallel<T>(
  generators: GeneratorOrFunction<T>[]
): AsyncGenerator<T> {
  const results = await Promise.all(
    generators.map(async (generator) => {
      const it = typeof generator === 'function' ? generator() : generator

      let first: IteratorResult<T> | undefined
      let error: Error | undefined

      try {
        first = await it.next()

        if (first.done) {
          return null
        }
      } catch (e) {
        error = e as Error
      }

      return events<T>(async (push) => {
        if (error) {
          throw error
        }

        if (first && !first.done) {
          await push(first.value)
        }

        for await (const value of it as AsyncIterable<T>) {
          await push(value)
        }
      })
    })
  )

  const filtered = results.filter((r) => r !== null) as AsyncIterable<T>[]

  // @note eagerly start all event generators by pulling their first value so
  // that their background work (handlers) begins concurrently, then yield all
  // values in sequential order per generator

  const iterators = filtered.map((it) => {
    const iter = it[Symbol.asyncIterator]()

    return { iter, first: iter.next() }
  })

  for (const { iter, first } of iterators) {
    const firstResult = await first

    if (!firstResult.done) {
      yield firstResult.value

      for (;;) {
        const next = await iter.next()

        if (next.done) {
          break
        }

        yield next.value
      }
    }
  }
}

// ---
// ---
// ---

export default it
