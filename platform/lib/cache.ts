import { runOncePerKey } from '@/lib/concurrency'
import debug, { createSpan } from '@/lib/debug'
import { defer } from '@/lib/defer'
import memcache from '@/lib/memcache'

/**
 * This function caches the result of a function for a specified duration. If
 * the value already exists, the function is not called and the value is
 * returned from the cache.
 */
export async function ttlCache<T>(
  key: string,
  durationInSeconds: number,
  fn: () => Promise<T>,
  skip: boolean = !!process.env.SKIP_FUNCTION_CACHE
): Promise<T> {
  debug(`ttl cache`, { key, durationInSeconds }).log('cache.ttlCache')

  const span = createSpan({ name: 'ttlCache' })

  try {
    return await runOncePerKey(`ttlCache:::${key}`, async () => {
      let value: T | null = skip ? null : await memcache.get(key)

      // @note check for null and undefined

      if (value == null) {
        value = await fn()

        if (durationInSeconds) {
          await defer(memcache.set(key, value, { ex: durationInSeconds }))
        }
      }

      return value
    })
  } finally {
    span.finish()
  }
}

/**
 * This function retrieves data from the cache and returns it immediately,
 * but also initiates an asynchronous process to revalidate the data if it
 * exists. If the cache is empty, it populates it first.
 */
export async function swrCache<T>(
  key: string,
  durationInSeconds: number,
  fn: () => Promise<T>,
  skip: boolean = !!process.env.SKIP_FUNCTION_CACHE
): Promise<T> {
  debug(`swr cache`, { key, durationInSeconds }).log('cache.swrCache')

  const span = createSpan({ name: 'swrCache' })

  try {
    return await runOncePerKey(`swrCache:::${key}`, async () => {
      const oldValuePromise: Promise<T | null> | null = skip
        ? null
        : memcache.get(key)

      const newValuePromise = fn()

      // @todo check if this is race is a problem

      let value: T | null = await Promise.race([
        oldValuePromise,
        newValuePromise,
      ])

      // @note check for null and undefined

      if (value == null) {
        value = await newValuePromise

        if (durationInSeconds) {
          await defer(memcache.set(key, value, { ex: durationInSeconds }))
        }
      } else {
        if (durationInSeconds) {
          await defer(
            newValuePromise.then((newValue) =>
              memcache.set(key, newValue, { ex: durationInSeconds })
            )
          )
        }
      }

      return value
    })
  } finally {
    span.finish()
  }
}

/**
 * This function is similar to ttlCache() but it also extends the expiration
 * time of the key if it already exists.
 */
export async function rollingCache<T>(
  key: string,
  durationInSeconds: number,
  fn: () => Promise<T>,
  skip: boolean = !!process.env.SKIP_FUNCTION_CACHE
): Promise<T> {
  debug(`rolling cache`, { key, durationInSeconds }).log('cache.rollingCache')

  const span = createSpan({ name: 'rollingCache' })

  try {
    return await runOncePerKey(`rollingCache:::${key}`, async () => {
      let value: T | null = skip ? null : await memcache.get(key)

      // @note check for null and undefined

      if (value == null) {
        value = await fn()

        if (durationInSeconds) {
          await defer(memcache.set(key, value, { ex: durationInSeconds }))
        }
      } else {
        await defer(memcache.expire(key, durationInSeconds))
      }

      return value
    })
  } finally {
    span.finish()
  }
}

/**
 * A function like all the others but it doesn't cache the result. It is mostly
 * useful for testing purposes.
 */
export async function bypassCache<T>(
  key: string,
  durationInSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  debug(`bypass cache`, { key, durationInSeconds }).log('cache.bypassCache')

  return await fn()
}

/**
 * Clears the cache for a specific key.
 */
export async function clearCache(key: string): Promise<void> {
  await memcache.del(key)
}
