import prisma from '@/prisma/client'
import type { User as PrismaUser } from '@/prisma/types'

import { assert, createSpan } from '@/lib/debug'

export interface User {
  id: string

  email: string

  // @note like parentId, the billing columns stay null (not undefined) on
  // loaded rows - undefined means the shape was never loaded, and plan
  // resolution re-fetches on that signal
  billingCustomerId?: string | null
  billingSubscriptionId?: string | null
  billingSubscriptionStatus?: string | null

  // @note parentId must always be present on User objects because usage
  // recording relies on it to associate child User usage with parent Users
  // for billing aggregation. Do not make this optional-key (?:). It stays
  // null (not undefined) for parentless users - undefined means the row was
  // never loaded, and plan resolution re-fetches on that signal
  parentId: string | null

  limits?: Record<string, unknown>

  meta?: Record<string, unknown>
}

type DbUser = Pick<
  PrismaUser,
  | 'id'
  | 'email'
  | 'billingCustomerId'
  | 'billingSubscriptionId'
  | 'billingSubscriptionStatus'
  | 'parentId'
  | 'limits'
  | 'meta'
>

export function getUserObject(user: User | DbUser): User {
  return Object.freeze({
    id: user.id,

    email: user.email ?? undefined,

    billingCustomerId: user.billingCustomerId ?? null,
    billingSubscriptionId: user.billingSubscriptionId ?? null,
    billingSubscriptionStatus: user.billingSubscriptionStatus ?? null,

    parentId: user.parentId ?? null,

    limits: user.limits ?? undefined,

    meta: user.meta ?? undefined,
  })
}

// @todo the following implementation is not handling the case where the request
// are made in parallel and the cache is not yet populated, hence why we need
// to change this in the future

interface CacheEntry {
  value: Promise<User | null>
  expiresAt: number
}

// @todo we should pick both maps from a shared context if present

const userByIdCache = new Map<string, CacheEntry>()

const userByEmailCache = new Map<string, CacheEntry>()

const CACHE_TTL = 60 * 1000

function getCacheEntry(
  cache: Map<string, CacheEntry>,
  key: string
): Promise<User | null> | undefined {
  const entry = cache.get(key)

  if (!entry) {
    return undefined
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key)

    return undefined
  }

  return entry.value
}

function setCacheEntry(
  cache: Map<string, CacheEntry>,
  key: string,
  value: Promise<User | null>,
  ttl: number = CACHE_TTL
): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttl,
  })
}

export async function cacheUser(user: User): Promise<void> {
  const userObject = getUserObject(user)

  setCacheEntry(userByIdCache, userObject.id, Promise.resolve(userObject))
  setCacheEntry(userByEmailCache, userObject.email, Promise.resolve(userObject))
}

export async function fastGetUserById(userId: string): Promise<User | null> {
  assert(userId, 'userId is required')

  const span = createSpan({ name: 'fastGetUserById' })

  try {
    const key = userId

    const cached = getCacheEntry(userByIdCache, key)

    if (cached) {
      return await cached
    }

    const promise: Promise<User | null> = prisma.user
      .findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,

          email: true,

          billingCustomerId: true,
          billingSubscriptionId: true,
          billingSubscriptionStatus: true,

          parentId: true,

          limits: true,

          meta: true,
        },

        cacheStrategy: {
          ttl: 60,
          swr: 60,
        },
      })
      .then((user) => {
        if (user) {
          const userObject = getUserObject(user)

          setCacheEntry(
            userByEmailCache,
            user.email,
            Promise.resolve(userObject)
          )

          return userObject
        }

        return null
      })
      .catch((error) => {
        userByIdCache.delete(key)

        throw error // Rethrow error to maintain existing behavior
      })

    setCacheEntry(userByIdCache, key, promise)

    return await promise
  } finally {
    span.finish()
  }
}

export async function fastGetUserByEmail(email: string): Promise<User | null> {
  assert(email, 'email is required')

  const span = createSpan({ name: 'fastGetUserByEmail' })

  try {
    const key = email

    const cached = getCacheEntry(userByEmailCache, key)

    if (cached) {
      return await cached
    }

    const promise: Promise<User | null> = prisma.user
      .findUnique({
        where: {
          email: email,
        },

        select: {
          id: true,

          email: true,

          billingCustomerId: true,
          billingSubscriptionId: true,
          billingSubscriptionStatus: true,

          parentId: true,

          limits: true,

          meta: true,
        },

        cacheStrategy: {
          ttl: 60,
          swr: 60,
        },
      })
      .then((user) => {
        if (user) {
          const userObject = getUserObject(user)

          setCacheEntry(userByIdCache, user.id, Promise.resolve(userObject))

          return userObject
        }

        return null
      })
      .catch((error) => {
        userByEmailCache.delete(key)

        throw error
      })

    setCacheEntry(userByEmailCache, key, promise)

    return await promise
  } finally {
    span.finish()
  }
}
