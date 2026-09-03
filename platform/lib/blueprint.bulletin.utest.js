/* eslint-disable @typescript-eslint/no-require-imports */
import {
  BULLETIN_DEFAULT_TTL_SECONDS,
  BULLETIN_MAX_MESSAGES,
  BULLETIN_MAX_TTL_SECONDS,
  createBlueprintBulletin,
  getBlueprintBulletinKey,
  listBlueprintBulletins,
  resolveTtlSeconds,
} from './blueprint.bulletin'

jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
  },
}))

jest.mock('@/lib/cuid', () => ({
  cuid: jest.fn(() => 'generated-id'),
}))

const memcache = require('@/lib/memcache').default

describe('blueprint.bulletin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
  })

  afterEach(() => {
    Date.now.mockRestore?.()
  })

  describe('getBlueprintBulletinKey', () => {
    it('scopes the key to the blueprint only', () => {
      expect(getBlueprintBulletinKey('bp-1')).toBe('bulletin:bp-1')
    })
  })

  describe('listBlueprintBulletins', () => {
    it('returns an empty array when nothing is stored', async () => {
      memcache.get.mockResolvedValue(null)

      const result = await listBlueprintBulletins('bp-1')

      expect(result).toEqual([])
      expect(memcache.get).toHaveBeenCalledWith('bulletin:bp-1')
    })

    it('drops expired bulletins', async () => {
      const now = Date.now()

      memcache.get.mockResolvedValue([
        { id: 'a', text: 'old', createdAt: 0, expiresAt: now - 1 },
        { id: 'b', text: 'fresh', createdAt: 0, expiresAt: now + 1000 },
      ])

      const result = await listBlueprintBulletins('bp-1')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('b')
    })

    it('returns bulletins newest first', async () => {
      const now = Date.now()

      // @note stored oldest-first, as the write path persists them
      memcache.get.mockResolvedValue([
        { id: 'a', text: 'oldest', createdAt: 1, expiresAt: now + 1000 },
        { id: 'b', text: 'middle', createdAt: 2, expiresAt: now + 1000 },
        { id: 'c', text: 'newest', createdAt: 3, expiresAt: now + 1000 },
      ])

      const result = await listBlueprintBulletins('bp-1')

      expect(result.map((bulletin) => bulletin.id)).toEqual(['c', 'b', 'a'])
    })
  })

  describe('resolveTtlSeconds', () => {
    it('returns undefined when no ttl is supplied', () => {
      expect(resolveTtlSeconds(undefined)).toBeUndefined()
      expect(resolveTtlSeconds(null)).toBeUndefined()
      expect(resolveTtlSeconds('   ')).toBeUndefined()
    })

    it('treats a number as seconds', () => {
      expect(resolveTtlSeconds(3600)).toBe(3600)
    })

    it('treats a bare numeric string as seconds (not milliseconds)', () => {
      expect(resolveTtlSeconds('3600')).toBe(3600)
    })

    it('parses human-readable duration strings into seconds', () => {
      expect(resolveTtlSeconds('1 hour')).toBe(3600)
      expect(resolveTtlSeconds('30 minutes')).toBe(1800)
      expect(resolveTtlSeconds('2d')).toBe(2 * 24 * 60 * 60)
      expect(resolveTtlSeconds('1 day, 12 hours')).toBe(36 * 60 * 60)
    })

    it('throws a user input error for an unparseable duration string', () => {
      expect(() => resolveTtlSeconds('not-a-duration')).toThrow(
        'Invalid ttl duration'
      )
    })
  })

  describe('createBlueprintBulletin', () => {
    it('creates a bulletin with the default ttl and key-level expiry', async () => {
      memcache.get.mockResolvedValue(null)

      const now = Date.now()

      const bulletin = await createBlueprintBulletin('bp-1', { text: 'hello' })

      expect(bulletin).toEqual({
        id: 'generated-id',
        text: 'hello',
        createdAt: now,
        expiresAt: now + BULLETIN_DEFAULT_TTL_SECONDS * 1000,
      })

      expect(memcache.set).toHaveBeenCalledWith('bulletin:bp-1', [bulletin], {
        ex: BULLETIN_MAX_TTL_SECONDS,
      })
    })

    it('clamps the ttl to the maximum', async () => {
      memcache.get.mockResolvedValue(null)

      const now = Date.now()

      const bulletin = await createBlueprintBulletin('bp-1', {
        text: 'hello',
        ttl: BULLETIN_MAX_TTL_SECONDS * 10,
      })

      expect(bulletin.expiresAt).toBe(now + BULLETIN_MAX_TTL_SECONDS * 1000)
    })

    it('accepts a human-readable duration string for the ttl', async () => {
      memcache.get.mockResolvedValue(null)

      const now = Date.now()

      const bulletin = await createBlueprintBulletin('bp-1', {
        text: 'hello',
        ttl: '30 minutes',
      })

      expect(bulletin.expiresAt).toBe(now + 30 * 60 * 1000)
    })

    it('clamps a duration string that exceeds the maximum', async () => {
      memcache.get.mockResolvedValue(null)

      const now = Date.now()

      const bulletin = await createBlueprintBulletin('bp-1', {
        text: 'hello',
        ttl: '10 days',
      })

      expect(bulletin.expiresAt).toBe(now + BULLETIN_MAX_TTL_SECONDS * 1000)
    })

    it('rejects an unparseable ttl duration', async () => {
      memcache.get.mockResolvedValue(null)

      await expect(
        createBlueprintBulletin('bp-1', {
          text: 'hello',
          ttl: 'not-a-duration',
        })
      ).rejects.toThrow('Invalid ttl duration')
    })

    it('records the author name and bot id when provided', async () => {
      memcache.get.mockResolvedValue(null)

      const bulletin = await createBlueprintBulletin('bp-1', {
        text: 'hello',
        author: 'Support Bot',
        botId: 'bot-1',
      })

      expect(bulletin.author).toBe('Support Bot')
      expect(bulletin.botId).toBe('bot-1')
    })

    it('prunes expired bulletins before appending', async () => {
      const now = Date.now()

      memcache.get.mockResolvedValue([
        { id: 'old', text: 'old', createdAt: 0, expiresAt: now - 1 },
      ])

      await createBlueprintBulletin('bp-1', { text: 'new' })

      const stored = memcache.set.mock.calls[0][1]

      expect(stored).toHaveLength(1)
      expect(stored[0].text).toBe('new')
    })

    it('evicts the oldest bulletins when over capacity', async () => {
      const now = Date.now()

      const existing = Array.from(
        { length: BULLETIN_MAX_MESSAGES },
        (_, i) => ({
          id: `b-${i}`,
          text: `msg-${i}`,
          createdAt: i,
          expiresAt: now + 100000,
        })
      )

      memcache.get.mockResolvedValue(existing)

      await createBlueprintBulletin('bp-1', { text: 'newest' })

      const stored = memcache.set.mock.calls[0][1]

      expect(stored).toHaveLength(BULLETIN_MAX_MESSAGES)
      // oldest (b-0) evicted, newest retained at the end
      expect(stored.find((b) => b.id === 'b-0')).toBeUndefined()
      expect(stored[stored.length - 1].text).toBe('newest')
    })
  })
})
