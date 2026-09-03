/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import cuid from '@/lib/cuid'
import {
  cacheUser,
  fastGetUserByEmail,
  fastGetUserById,
  getUserObject,
} from '@/lib/user.get'

jest.mock('@/prisma/client', () => ({
  __esModule: true,

  default: mockDeep(),
}))

beforeEach(() => {
  mockReset(prisma)
})

describe('fastGetUserById', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return user when found', async () => {
    const userId = cuid()

    const user = {
      id: userId,
      email: 'test@example.com',
      billingCustomerId: 'customer123',
      billingSubscriptionId: 'subscription123',
      billingSubscriptionStatus: 'active',
      parentId: cuid(),
    }

    prisma.user.findUnique.mockResolvedValue(user)

    const result = await fastGetUserById(userId)

    expect(result).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
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
  })

  it('should return null when user not found', async () => {
    const userId = cuid()

    prisma.user.findUnique.mockResolvedValue(null)

    const result = await fastGetUserById(userId)

    expect(result).toBeNull()
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
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
  })

  it('should not make multiple queries for the same user', async () => {
    const userId = cuid()

    const user = {
      id: userId,
      email: 'test@example.com',
      billingCustomerId: 'customer123',
      billingSubscriptionId: 'subscription123',
      billingSubscriptionStatus: 'active',
      parentId: cuid(),
    }

    prisma.user.findUnique.mockResolvedValue(user)

    const result1 = await fastGetUserById(userId)

    expect(result1).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)

    const result2 = await fastGetUserById(userId)

    expect(result2).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
  })

  it('should handle database errors gracefully', async () => {
    const userId = cuid()

    prisma.user.findUnique.mockRejectedValue(new Error('Database error'))

    await expect(fastGetUserById(userId)).rejects.toThrow('Database error')

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)

    const secondCall = fastGetUserById(userId)

    await expect(secondCall).rejects.toThrow('Database error')

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2)
  })

  it('should handle rapid successive calls for the same user', async () => {
    const userId = cuid()

    const user = {
      id: userId,
      email: 'test@example.com',
      billingCustomerId: 'customer123',
      billingSubscriptionId: 'subscription123',
      billingSubscriptionStatus: 'active',
      parentId: cuid(),
    }

    prisma.user.findUnique.mockResolvedValue(user)

    const calls = Array.from({ length: 10 }, () => fastGetUserById(userId))

    const results = await Promise.all(calls)

    results.forEach((result) => {
      expect(result).toEqual(user)
    })

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
  })
})

describe('fastGetUserById - additional cases', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should validate input and throw when userId is missing', async () => {
    await expect(fastGetUserById('')).rejects.toThrow('userId is required')

    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('should cache null results and avoid repeated queries', async () => {
    const userId = cuid()

    prisma.user.findUnique.mockResolvedValue(null)

    const r1 = await fastGetUserById(userId)
    const r2 = await fastGetUserById(userId)

    expect(r1).toBeNull()
    expect(r2).toBeNull()
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
  })

  it('should populate email cache when fetching by id (cross-population)', async () => {
    const userId = cuid()
    const email = 'cross@example.com'
    const user = {
      id: userId,
      email,
      billingCustomerId: null,
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: null,
      limits: { a: 1 },
    }

    prisma.user.findUnique.mockResolvedValue(user)

    const u1 = await fastGetUserById(userId)

    expect(u1).toEqual(
      expect.objectContaining({ id: userId, email, limits: { a: 1 } })
    )
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)

    const u2 = await fastGetUserByEmail(email)

    expect(u2).toEqual(u1)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
  })

  it('should always select parentId from the database', async () => {
    const userId = cuid()

    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'test@example.com',
      billingCustomerId: null,
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: 'parent-abc',
      limits: null,
      meta: null,
    })

    await fastGetUserById(userId)

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          parentId: true,
        }),
      })
    )
  })

  it('should return parentId in the result when user has a parent', async () => {
    const userId = cuid()
    const parentId = cuid()

    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'child@example.com',
      billingCustomerId: null,
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId,
      limits: null,
      meta: null,
    })

    const result = await fastGetUserById(userId)

    expect(result).toHaveProperty('parentId', parentId)
  })

  it('should return null parentId when user has no parent', async () => {
    const userId = cuid()

    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'solo@example.com',
      billingCustomerId: null,
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: null,
      limits: null,
      meta: null,
    })

    const result = await fastGetUserById(userId)

    expect(result).toHaveProperty('parentId', null)
  })
})

describe('fastGetUserByEmail', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return user when found and call prisma with expected args', async () => {
    const userId = cuid()
    const email = `test+${cuid()}@example.com`

    const user = {
      id: userId,
      email,
      billingCustomerId: 'customer123',
      billingSubscriptionId: 'subscription123',
      billingSubscriptionStatus: 'active',
      parentId: cuid(),
      limits: { x: 1 },
    }

    prisma.user.findUnique.mockResolvedValue(user)

    const result = await fastGetUserByEmail(email)

    expect(result).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        email,
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
  })

  it('should return null when user not found and cache the null', async () => {
    const email = 'missing@example.com'

    prisma.user.findUnique.mockResolvedValue(null)

    const r1 = await fastGetUserByEmail(email)
    const r2 = await fastGetUserByEmail(email)

    expect(r1).toBeNull()
    expect(r2).toBeNull()
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
  })

  it('should not make multiple queries for the same email', async () => {
    const userId = cuid()
    const email = 'dupe@example.com'
    const user = {
      id: userId,
      email,
      billingCustomerId: null,
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: null,
    }

    prisma.user.findUnique.mockResolvedValue(user)

    const r1 = await fastGetUserByEmail(email)
    const r2 = await fastGetUserByEmail(email)

    expect(r1).toEqual(user)
    expect(r2).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
  })

  it('should handle database errors and retry after cache invalidation', async () => {
    const email = 'error@example.com'

    prisma.user.findUnique.mockRejectedValueOnce(new Error('DB down'))
    prisma.user.findUnique.mockRejectedValueOnce(new Error('DB down'))

    await expect(fastGetUserByEmail(email)).rejects.toThrow('DB down')
    await expect(fastGetUserByEmail(email)).rejects.toThrow('DB down')

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2)
  })

  it('should handle rapid successive calls for the same email', async () => {
    const userId = cuid()
    const email = 'burst@example.com'
    const user = {
      id: userId,
      email,
      billingCustomerId: null,
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: null,
    }

    prisma.user.findUnique.mockResolvedValue(user)

    const calls = Array.from({ length: 8 }, () => fastGetUserByEmail(email))
    const results = await Promise.all(calls)

    results.forEach((r) => expect(r).toEqual(user))

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
  })

  it('should populate id cache when fetching by email (cross-population)', async () => {
    const userId = cuid()
    const email = 'xpop@example.com'
    const user = {
      id: userId,
      email,
      billingCustomerId: null,
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: null,
    }

    prisma.user.findUnique.mockResolvedValue(user)

    const byEmail = await fastGetUserByEmail(email)

    expect(byEmail).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)

    const byId = await fastGetUserById(userId)

    expect(byId).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
  })

  it('should validate input and throw when email is missing', async () => {
    await expect(fastGetUserByEmail('')).rejects.toThrow('email is required')

    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })
})

describe('getUserObject', () => {
  it('should normalize optional fields to undefined and freeze the result', () => {
    const userId = cuid()
    const obj = getUserObject({
      id: userId,
      email: 'u@example.com',
      billingCustomerId: null,
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: null,
      limits: { k: 'v' },
    })

    expect(obj).toEqual({
      id: userId,
      email: 'u@example.com',
      billingCustomerId: null,
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: null,
      limits: { k: 'v' },
    })

    expect(Object.isFrozen(obj)).toBe(true)
  })
})

describe('cacheUser', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should seed both id and email caches to avoid DB calls', async () => {
    const user = {
      id: cuid(),
      email: 'seed@example.com',
      limits: { z: 1 },
    }

    await cacheUser(user)

    const r1 = await fastGetUserById(user.id)
    const r2 = await fastGetUserByEmail(user.email)

    expect(r1).toEqual(
      expect.objectContaining({
        id: user.id,
        email: user.email,
        limits: { z: 1 },
      })
    )
    expect(r2).toEqual(r1)

    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })
})

describe('cache expiry', () => {
  let realDateNow

  beforeEach(() => {
    realDateNow = Date.now
  })

  afterEach(() => {
    Date.now = realDateNow
    jest.clearAllMocks()
  })

  it('should expire cache entries after 60 seconds for fastGetUserById', async () => {
    const userId = cuid()
    const user = {
      id: userId,
      email: 'expiry@example.com',
      billingCustomerId: 'customer123',
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: null,
    }

    let currentTime = 1000000

    Date.now = jest.fn(() => currentTime)

    prisma.user.findUnique.mockResolvedValue(user)

    // First call at time 1000000
    const result1 = await fastGetUserById(userId)

    expect(result1).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)

    // Second call at time 1030000 (30 seconds later - within 60s TTL)
    currentTime = 1030000

    const result2 = await fastGetUserById(userId)

    expect(result2).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1) // Still cached

    // Third call at time 1070000 (70 seconds from original - beyond 60s TTL)
    currentTime = 1070000

    const result3 = await fastGetUserById(userId)

    expect(result3).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2) // Cache expired, new query
  })

  it('should expire cache entries after 60 seconds for fastGetUserByEmail', async () => {
    const userId = cuid()
    const email = 'expiry-email@example.com'
    const user = {
      id: userId,
      email,
      billingCustomerId: 'customer456',
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: null,
    }

    let currentTime = 2000000

    Date.now = jest.fn(() => currentTime)

    prisma.user.findUnique.mockResolvedValue(user)

    // First call at time 2000000
    const result1 = await fastGetUserByEmail(email)

    expect(result1).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)

    // Second call at time 2040000 (40 seconds later - within 60s TTL)
    currentTime = 2040000

    const result2 = await fastGetUserByEmail(email)

    expect(result2).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1) // Still cached

    // Third call at time 2065000 (65 seconds from original - beyond 60s TTL)
    currentTime = 2065000

    const result3 = await fastGetUserByEmail(email)

    expect(result3).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2) // Cache expired, new query
  })

  it('should expire null cache entries after 60 seconds', async () => {
    const userId = cuid()

    let currentTime = 3000000

    Date.now = jest.fn(() => currentTime)

    prisma.user.findUnique.mockResolvedValue(null)

    // First call - user not found
    const result1 = await fastGetUserById(userId)

    expect(result1).toBeNull()
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)

    // Second call at time 3050000 (50 seconds later - within TTL)
    currentTime = 3050000

    const result2 = await fastGetUserById(userId)

    expect(result2).toBeNull()
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1) // Null result still cached

    // Third call at time 3070000 (70 seconds from original - beyond TTL)
    currentTime = 3070000

    // Now the user exists
    const user = {
      id: userId,
      email: 'new@example.com',
      billingCustomerId: null,
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: null,
    }

    prisma.user.findUnique.mockResolvedValue(user)

    const result3 = await fastGetUserById(userId)

    expect(result3).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2) // Cache expired, new query found user
  })

  it('should respect cache expiry for cross-populated caches', async () => {
    const userId = cuid()
    const email = 'cross-expiry@example.com'
    const user = {
      id: userId,
      email,
      billingCustomerId: 'customer789',
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: null,
    }

    let currentTime = 4000000

    Date.now = jest.fn(() => currentTime)

    prisma.user.findUnique.mockResolvedValue(user)

    // Fetch by ID - this will populate both caches
    const result1 = await fastGetUserById(userId)

    expect(result1).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)

    // Fetch by email at time 4050000 (50 seconds later - within TTL)
    currentTime = 4050000

    const result2 = await fastGetUserByEmail(email)

    expect(result2).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1) // Cross-cache still valid

    // Fetch by email at time 4070000 (70 seconds from original - beyond TTL)
    currentTime = 4070000

    const result3 = await fastGetUserByEmail(email)

    expect(result3).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2) // Email cache expired
  })

  it('should handle cache expiry with cacheUser pre-population', async () => {
    const userId = cuid()
    const email = 'preload-expiry@example.com'
    const user = {
      id: userId,
      email,
      billingCustomerId: null,
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: null,
      limits: { test: true },
    }

    let currentTime = 5000000

    Date.now = jest.fn(() => currentTime)

    // Pre-populate cache
    await cacheUser(user)

    const result1 = await fastGetUserById(userId)

    expect(result1).toEqual(expect.objectContaining(user))
    expect(prisma.user.findUnique).not.toHaveBeenCalled()

    // Check at time 5055000 (55 seconds later - within TTL)
    currentTime = 5055000

    const result2 = await fastGetUserById(userId)

    expect(result2).toEqual(expect.objectContaining(user))
    expect(prisma.user.findUnique).not.toHaveBeenCalled() // Still cached

    // Check at time 5065000 (65 seconds from cacheUser - beyond TTL)
    currentTime = 5065000

    prisma.user.findUnique.mockResolvedValue(user)

    const result3 = await fastGetUserById(userId)

    expect(result3).toEqual(user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1) // Cache expired, fetched from DB
  })

  it('should set new expiry time when cache is refreshed after expiration', async () => {
    const userId = cuid()
    const user = {
      id: userId,
      email: 'refresh@example.com',
    }

    let currentTime = 6000000

    Date.now = jest.fn(() => currentTime)

    prisma.user.findUnique.mockResolvedValue(user)

    // First call - populate cache with expiry at 6060000
    await fastGetUserById(userId)

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)

    // Move to 6070000 (expired) and call again - should refresh with new expiry at 6130000
    currentTime = 6070000

    await fastGetUserById(userId)

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2)

    // Move to 6120000 (50 seconds after refresh, should be cached)
    currentTime = 6120000

    await fastGetUserById(userId)

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2) // Still cached with new TTL

    // Move to 6140000 (70 seconds after refresh, should be expired)
    currentTime = 6140000

    await fastGetUserById(userId)

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(3) // Expired again
  })
})
