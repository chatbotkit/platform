/* eslint-disable import/extensions, @typescript-eslint/no-explicit-any */
import memcache from '@/lib/memcache'

import { Prisma } from '@prisma/client/extension'
import type { Types } from '@prisma/client/runtime/client'
import type PrismaDefault from '@prisma/client/scripts/default-index.js'
import { type Prisma as PrismaNamespace } from '@prisma/client/scripts/default-index.js'

import { createHash } from 'crypto'

/**
 * Cache strategy options similar to Prisma Accelerate.
 *
 * @note ttl - Time-to-live in seconds. The cached result is considered fresh
 * for this duration.
 *
 * @note swr - Stale-while-revalidate in seconds. After ttl expires, the cached
 * result can still be served for this additional duration while a background
 * revalidation occurs.
 *
 * @note tags - Optional cache tags for manual invalidation.
 */
export type CacheStrategy = {
  ttl: number
  swr?: number
  tags?: string[]
}

/**
 * Type extension for adding cacheStrategy to Prisma query args.
 * Follows the same pattern as `@prisma/extension-accelerate`.
 */
export interface PrismaCacheStrategy {
  readonly cacheStrategy?: CacheStrategy
}

type CacheEntry<T> = {
  data: T
  createdAt: number
  ttl: number
  swr: number
  tags?: string[]
}

const CACHE_PREFIX = 'prisma:cache:'

const READ_OPERATIONS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
] as const

type ReadOperation = (typeof READ_OPERATIONS)[number]

/**
 * Generates a deterministic cache key from query parameters.
 */
function generateCacheKey(
  model: string,
  operation: string,
  args: unknown
): string {
  const payload = JSON.stringify({ model, operation, args })
  const hash = createHash('sha256').update(payload).digest('hex').slice(0, 16)

  return `${CACHE_PREFIX}${model}:${operation}:${hash}`
}

/**
 * Checks if a cache entry is fresh (within TTL).
 */
function isFresh(entry: CacheEntry<unknown>): boolean {
  const age = (Date.now() - entry.createdAt) / 1000

  return age < entry.ttl
}

/**
 * Checks if a cache entry is stale but within SWR window.
 */
function isStaleButServable(entry: CacheEntry<unknown>): boolean {
  const age = (Date.now() - entry.createdAt) / 1000

  return age >= entry.ttl && age < entry.ttl + entry.swr
}

/**
 * Stores a result in the cache.
 */
async function setCache<T>(
  key: string,
  data: T,
  strategy: CacheStrategy
): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    createdAt: Date.now(),
    ttl: strategy.ttl,
    swr: strategy.swr ?? 0,
    tags: strategy.tags,
  }

  // Total TTL = ttl + swr (entry expires after both windows pass)
  const totalTtl = strategy.ttl + (strategy.swr ?? 0)

  await memcache.setex(key, totalTtl, JSON.stringify(entry))

  // Store tag associations for invalidation
  if (strategy.tags?.length) {
    for (const tag of strategy.tags) {
      await memcache.sadd(`${CACHE_PREFIX}tag:${tag}`, key)
      await memcache.expire(`${CACHE_PREFIX}tag:${tag}`, totalTtl)
    }
  }
}

/**
 * Retrieves a result from the cache.
 */
async function getCache<T>(key: string): Promise<CacheEntry<T> | null> {
  const raw = await memcache.get<string>(key)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as CacheEntry<T>
  } catch {
    return null
  }
}

/**
 * Invalidates cache entries by tag.
 */
export async function invalidateCacheByTag(tag: string): Promise<number> {
  const tagKey = `${CACHE_PREFIX}tag:${tag}`
  const keys = await memcache.smembers(tagKey)

  if (keys.length === 0) {
    return 0
  }

  await memcache.del(...keys, tagKey)

  return keys.length
}

/**
 * Invalidates cache entries by model name.
 *
 * @note This uses a pattern scan which can be slow on large datasets.
 */
export async function invalidateCacheByModel(model: string): Promise<number> {
  const pattern = `${CACHE_PREFIX}${model}:*`

  // @note the cursor is opaque and the contract returns it as a string, but it
  // is normalised on the way back in anyway. This loop only ends when the
  // cursor reads as complete, so a backend answering with the number 0 instead
  // of the string would spin here allocating keys until the process died -
  // which is far too severe a failure for a strictness the caller gains nothing
  // from.
  let cursor = '0'
  let deletedCount = 0

  do {
    const [nextCursor, keys] = await memcache.scan(cursor, {
      match: pattern,
      count: 100,
    })

    cursor = String(nextCursor)

    if (keys.length > 0) {
      await memcache.del(...keys)
      deletedCount += keys.length
    }
  } while (cursor !== '0')

  return deletedCount
}

/**
 * Prisma extension that adds caching capabilities similar to Prisma Accelerate.
 *
 * @example
 * ```typescript
 * const result = await prisma.user.findUnique({
 *   where: { id: '123' },
 *   cacheStrategy: {
 *     ttl: 60,      // Cache for 60 seconds
 *     swr: 60,      // Serve stale for 60 more seconds while revalidating
 *     tags: ['user:123'],  // Optional tags for manual invalidation
 *   },
 * })
 * ```
 */
export function withCache(): (client: any) => PrismaDefault.PrismaClientExtends<
  Types.Extensions.InternalArgs<
    object,
    {
      $allModels: {
        findUnique<T, A>(
          this: T,
          args: PrismaNamespace.Exact<
            A,
            PrismaNamespace.Args<T, 'findUnique'> & PrismaCacheStrategy
          >
        ): PrismaNamespace.PrismaPromise<PrismaNamespace.Result<
          T,
          A,
          'findUnique'
        > | null>
        findUniqueOrThrow<T, A>(
          this: T,
          args: PrismaNamespace.Exact<
            A,
            PrismaNamespace.Args<T, 'findUniqueOrThrow'> & PrismaCacheStrategy
          >
        ): PrismaNamespace.PrismaPromise<
          PrismaNamespace.Result<T, A, 'findUniqueOrThrow'>
        >
        findFirst<T, A>(
          this: T,
          args?: PrismaNamespace.Exact<
            A,
            PrismaNamespace.Args<T, 'findFirst'> & PrismaCacheStrategy
          >
        ): PrismaNamespace.PrismaPromise<PrismaNamespace.Result<
          T,
          A,
          'findFirst'
        > | null>
        findFirstOrThrow<T, A>(
          this: T,
          args?: PrismaNamespace.Exact<
            A,
            PrismaNamespace.Args<T, 'findFirstOrThrow'> & PrismaCacheStrategy
          >
        ): PrismaNamespace.PrismaPromise<
          PrismaNamespace.Result<T, A, 'findFirstOrThrow'>
        >
        findMany<T, A>(
          this: T,
          args?: PrismaNamespace.Exact<
            A,
            PrismaNamespace.Args<T, 'findMany'> & PrismaCacheStrategy
          >
        ): PrismaNamespace.PrismaPromise<
          PrismaNamespace.Result<T, A, 'findMany'>
        >
        count<T, A>(
          this: T,
          args?: PrismaNamespace.Exact<
            A,
            PrismaNamespace.Args<T, 'count'> & PrismaCacheStrategy
          >
        ): PrismaNamespace.PrismaPromise<PrismaNamespace.Result<T, A, 'count'>>
        aggregate<T, A>(
          this: T,
          args: PrismaNamespace.Exact<
            A,
            PrismaNamespace.Args<T, 'aggregate'> & PrismaCacheStrategy
          >
        ): PrismaNamespace.PrismaPromise<
          PrismaNamespace.Result<T, A, 'aggregate'>
        >
        groupBy<T, A>(
          this: T,
          args: PrismaNamespace.Exact<
            A,
            PrismaNamespace.Args<T, 'groupBy'> & PrismaCacheStrategy
          >
        ): PrismaNamespace.PrismaPromise<
          PrismaNamespace.Result<T, A, 'groupBy'>
        >
      }
    },
    object,
    object
  > &
    Types.Extensions.InternalArgs<object, object, object, object> &
    Types.Extensions.DefaultArgs
> {
  return Prisma.defineExtension({
    name: 'prisma-cache',

    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Only cache read operations
          if (!READ_OPERATIONS.includes(operation as ReadOperation)) {
            return query(args)
          }

          // Check if cacheStrategy is provided
          const cacheStrategy = (args as any)?.cacheStrategy as
            | CacheStrategy
            | undefined

          if (!cacheStrategy) {
            return query(args)
          }

          // Remove cacheStrategy from args before passing to query
          const { cacheStrategy: _, ...queryArgs } = args as any

          const cacheKey = generateCacheKey(model, operation, queryArgs)

          // Try to get from cache
          const cached = await getCache<unknown>(cacheKey)

          if (cached) {
            if (isFresh(cached)) {
              // Fresh cache hit - return immediately
              return cached.data
            }

            if (isStaleButServable(cached)) {
              // SWR: Return stale data and revalidate in background
              // @note using void to not await the promise
              void (async () => {
                try {
                  const freshData = await query(queryArgs)

                  await setCache(cacheKey, freshData, cacheStrategy)
                } catch {
                  // @note silently fail background revalidation
                }
              })()

              return cached.data
            }
          }

          // Cache miss or expired - fetch fresh data
          const result = await query(queryArgs)

          // Store in cache (fire and forget)
          void setCache(cacheKey, result, cacheStrategy).catch(() => {
            // @note silently fail cache write
          })

          return result
        },
      },
    },
  }) as any
}

export default withCache
