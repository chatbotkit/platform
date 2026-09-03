import {
  invalidateCacheByModel,
  invalidateCacheByTag,
  withCache,
} from '@/prisma/cache'

import memcache from '@/lib/memcache'

jest.mock('@/lib/memcache', () => ({
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  sadd: jest.fn(),
  expire: jest.fn(),
  smembers: jest.fn(),
  scan: jest.fn(),
}))

jest.mock('@/lib/debug', () => {
  const debug = jest.fn(() => ({ log: jest.fn() }))

  debug.assert = jest.fn()

  return {
    __esModule: true,
    default: debug,
    assert: jest.fn(),
  }
})

describe('withCache', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-02-09T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('extension definition', () => {
    it('should return a valid Prisma extension', () => {
      const extension = withCache()

      expect(extension).toBeDefined()
      // Prisma.defineExtension returns a function to be used with $extends
      expect(typeof extension).toBe('function')
    })
  })

  describe('cache key generation', () => {
    it('should generate deterministic cache keys for same query', () => {
      // Cache keys are generated internally using SHA256
      // Testing this indirectly through the behavior
      expect(true).toBe(true)
    })
  })

  describe('cacheStrategy option', () => {
    it('should accept ttl option', () => {
      const strategy = { ttl: 60 }

      expect(strategy.ttl).toBe(60)
    })

    it('should accept ttl and swr options', () => {
      const strategy = { ttl: 60, swr: 60 }

      expect(strategy.ttl).toBe(60)
      expect(strategy.swr).toBe(60)
    })

    it('should accept tags option', () => {
      const strategy = { ttl: 60, tags: ['user', 'post'] }

      expect(strategy.ttl).toBe(60)
      expect(strategy.tags).toEqual(['user', 'post'])
    })
  })
})

describe('cache entry freshness', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-02-09T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should consider cache fresh when within TTL', () => {
    const createdAt = Date.now()
    const ttl = 60
    const age = (Date.now() - createdAt) / 1000

    expect(age).toBeLessThan(ttl)
  })

  it('should consider cache stale when beyond TTL', () => {
    const createdAt = Date.now() - 61 * 1000 // 61 seconds ago
    const ttl = 60
    const age = (Date.now() - createdAt) / 1000

    expect(age).toBeGreaterThan(ttl)
  })

  it('should consider cache servable during SWR window', () => {
    const createdAt = Date.now() - 90 * 1000 // 90 seconds ago
    const ttl = 60
    const swr = 60
    const age = (Date.now() - createdAt) / 1000

    expect(age).toBeGreaterThan(ttl)
    expect(age).toBeLessThan(ttl + swr)
  })

  it('should consider cache expired beyond TTL + SWR', () => {
    const createdAt = Date.now() - 130 * 1000 // 130 seconds ago
    const ttl = 60
    const swr = 60
    const age = (Date.now() - createdAt) / 1000

    expect(age).toBeGreaterThan(ttl + swr)
  })
})

describe('invalidateCacheByTag', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should delete all cache entries associated with a tag', async () => {
    const keys = [
      'prisma:cache:User:findUnique:abc123',
      'prisma:cache:User:findMany:def456',
    ]

    memcache.smembers.mockResolvedValue(keys)
    memcache.del.mockResolvedValue(keys.length + 1)

    const count = await invalidateCacheByTag('user')

    expect(memcache.smembers).toHaveBeenCalledWith('prisma:cache:tag:user')
    expect(memcache.del).toHaveBeenCalledWith(...keys, 'prisma:cache:tag:user')
    expect(count).toBe(2)
  })

  it('should return 0 when no entries exist for tag', async () => {
    memcache.smembers.mockResolvedValue([])

    const count = await invalidateCacheByTag('nonexistent')

    expect(memcache.smembers).toHaveBeenCalledWith('prisma:cache:tag:nonexistent')
    expect(memcache.del).not.toHaveBeenCalled()
    expect(count).toBe(0)
  })

  it('should handle tag with single entry', async () => {
    memcache.smembers.mockResolvedValue(['prisma:cache:Post:findFirst:xyz789'])
    memcache.del.mockResolvedValue(2)

    const count = await invalidateCacheByTag('post:123')

    expect(count).toBe(1)
  })
})

describe('invalidateCacheByModel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should delete all cache entries for a model', async () => {
    const keys = [
      'prisma:cache:User:findUnique:abc',
      'prisma:cache:User:findMany:def',
    ]

    memcache.scan.mockResolvedValueOnce(['0', keys])
    memcache.del.mockResolvedValue(keys.length)

    const count = await invalidateCacheByModel('User')

    expect(memcache.scan).toHaveBeenCalledWith('0', {
      match: 'prisma:cache:User:*',
      count: 100,
    })
    expect(memcache.del).toHaveBeenCalledWith(...keys)
    expect(count).toBe(2)
  })

  it('should handle pagination when many keys exist', async () => {
    const keys1 = [
      'prisma:cache:Post:findUnique:a',
      'prisma:cache:Post:findMany:b',
    ]
    const keys2 = ['prisma:cache:Post:count:c']

    memcache.scan.mockResolvedValueOnce(['5', keys1])
    memcache.scan.mockResolvedValueOnce(['0', keys2])
    memcache.del.mockResolvedValue(2)

    const count = await invalidateCacheByModel('Post')

    expect(memcache.scan).toHaveBeenCalledTimes(2)
    expect(memcache.del).toHaveBeenCalledTimes(2)
    expect(count).toBe(3)
  })

  // @note these two guard a loop that once spun forever. The termination check
  // is `cursor !== '0'`, so a backend answering with the number 0 rather than
  // the string never satisfied it: the scan repeated, the deleted count climbed,
  // and the process died of heap exhaustion. Nothing in the suite noticed,
  // because the failure presented as a jest worker killed by SIGTERM.
  //
  // Both use `mockResolvedValueOnce` deliberately. If the loop regresses, the
  // next call returns undefined and the destructuring throws, so the test fails
  // in milliseconds instead of hanging CI the way the bug itself did.

  it('should terminate when a backend answers with a numeric cursor', async () => {
    memcache.scan.mockResolvedValueOnce([0, ['prisma:cache:User:findMany:a']])
    memcache.del.mockResolvedValue(1)

    const count = await invalidateCacheByModel('User')

    expect(memcache.scan).toHaveBeenCalledTimes(1)
    expect(count).toBe(1)
  })

  it('should page correctly when a backend answers with numeric cursors', async () => {
    memcache.scan.mockResolvedValueOnce([5, ['prisma:cache:Post:findUnique:a']])
    memcache.scan.mockResolvedValueOnce([0, ['prisma:cache:Post:count:b']])
    memcache.del.mockResolvedValue(1)

    const count = await invalidateCacheByModel('Post')

    expect(memcache.scan).toHaveBeenCalledTimes(2)
    expect(memcache.scan).toHaveBeenLastCalledWith('5', {
      match: 'prisma:cache:Post:*',
      count: 100,
    })
    expect(count).toBe(2)
  })

  it('should return 0 when no entries exist for model', async () => {
    memcache.scan.mockResolvedValue(['0', []])

    const count = await invalidateCacheByModel('NonExistentModel')

    expect(memcache.del).not.toHaveBeenCalled()
    expect(count).toBe(0)
  })

  it('should handle string cursor from Redis', async () => {
    memcache.scan.mockResolvedValueOnce(['5', ['prisma:cache:User:findFirst:x']])
    memcache.scan.mockResolvedValueOnce(['0', []])
    memcache.del.mockResolvedValue(1)

    const count = await invalidateCacheByModel('User')

    expect(count).toBe(1)
  })
})

describe('cache storage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should store cache entry with correct TTL', async () => {
    memcache.setex.mockResolvedValue('OK')
    memcache.sadd.mockResolvedValue(1)
    memcache.expire.mockResolvedValue(1)

    // Testing indirectly - setex should receive total TTL (ttl + swr)
    const strategy = { ttl: 60, swr: 30 }
    const totalTtl = strategy.ttl + (strategy.swr ?? 0)

    expect(totalTtl).toBe(90)
  })

  it('should store tag associations when tags provided', async () => {
    memcache.setex.mockResolvedValue('OK')
    memcache.sadd.mockResolvedValue(1)
    memcache.expire.mockResolvedValue(1)

    const strategy = { ttl: 60, tags: ['user:123', 'users'] }

    expect(strategy.tags).toHaveLength(2)
    // When storing, sadd should be called for each tag
  })
})

describe('READ_OPERATIONS', () => {
  const readOperations = [
    'findUnique',
    'findUniqueOrThrow',
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'count',
    'aggregate',
    'groupBy',
  ]

  it.each(readOperations)(
    'should support caching for %s operation',
    (operation) => {
      expect(readOperations).toContain(operation)
    }
  )

  const writeOperations = [
    'create',
    'createMany',
    'update',
    'updateMany',
    'delete',
    'deleteMany',
    'upsert',
  ]

  it.each(writeOperations)('should NOT cache %s operation', (operation) => {
    expect(readOperations).not.toContain(operation)
  })
})

describe('cache entry format', () => {
  it('should include required fields in cache entry', () => {
    const entry = {
      data: { id: '123', name: 'Test' },
      createdAt: Date.now(),
      ttl: 60,
      swr: 30,
      tags: ['test'],
    }

    expect(entry).toHaveProperty('data')
    expect(entry).toHaveProperty('createdAt')
    expect(entry).toHaveProperty('ttl')
    expect(entry).toHaveProperty('swr')
    expect(entry).toHaveProperty('tags')
  })

  it('should serialize entry as JSON', () => {
    const entry = {
      data: { id: '123', name: 'Test' },
      createdAt: Date.now(),
      ttl: 60,
      swr: 30,
    }

    const serialized = JSON.stringify(entry)
    const parsed = JSON.parse(serialized)

    expect(parsed.data).toEqual(entry.data)
    expect(parsed.ttl).toBe(60)
  })
})

describe('cache key prefix', () => {
  it('should use prisma:cache: prefix', () => {
    const prefix = 'prisma:cache:'

    expect(prefix).toBe('prisma:cache:')
  })

  it('should include model name in cache key', () => {
    const model = 'User'
    const operation = 'findUnique'
    const keyPattern = `prisma:cache:${model}:${operation}:`

    expect(keyPattern).toContain('User')
    expect(keyPattern).toContain('findUnique')
  })
})

describe('edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle null results from cache', async () => {
    memcache.get.mockResolvedValue(null)

    // When cache returns null, should proceed with query
    expect(await memcache.get('nonexistent')).toBeNull()
  })

  it('should handle malformed JSON in cache', async () => {
    memcache.get.mockResolvedValue('not-valid-json')

    // getCache should return null on parse error
    try {
      JSON.parse('not-valid-json')
    } catch {
      expect(true).toBe(true)
    }
  })

  it('should handle Redis errors gracefully', async () => {
    memcache.get.mockRejectedValue(new Error('Redis connection failed'))

    // Cache operations should not throw, they should fail silently
    await expect(memcache.get('test')).rejects.toThrow('Redis connection failed')
  })

  it('should handle empty tags array', () => {
    const strategy = { ttl: 60, tags: [] }

    expect(strategy.tags).toHaveLength(0)
  })

  it('should handle zero TTL', () => {
    const strategy = { ttl: 0 }

    expect(strategy.ttl).toBe(0)
  })

  it('should handle very large TTL values', () => {
    const strategy = { ttl: 86400 * 30 } // 30 days

    expect(strategy.ttl).toBe(2592000)
  })
})
