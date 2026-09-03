/**
 * @jest-environment node
 */
import { searchMemories } from '@/lib/memory.search'

import handler from './search'

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/memory.search', () => ({
  searchMemories: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const mockSession = { user: { id: 'user-abc' } }
const mockReq = {}

const makeMemory = (n) => ({ id: `mem-${n}`, text: `Memory ${n}` })

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('POST /api/v1/memory/search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    searchMemories.mockResolvedValue([makeMemory(1), makeMemory(2)])
  })

  describe('basic behaviour', () => {
    it('calls searchMemories with the user object and search term', async () => {
      await handler(mockReq, mockSession, { search: 'hello world' })
      expect(searchMemories).toHaveBeenCalledWith(
        mockSession.user,
        'hello world',
        expect.any(Object)
      )
    })

    it('returns a 200 status', async () => {
      const result = await handler(mockReq, mockSession, { search: 'test' })

      expect(result.status).toBe(200)
    })

    it('wraps results in an items array', async () => {
      const result = await handler(mockReq, mockSession, { search: 'test' })

      expect(result.body).toHaveProperty('items')
      expect(Array.isArray(result.body.items)).toBe(true)
    })

    it('returns the memories from searchMemories', async () => {
      const result = await handler(mockReq, mockSession, { search: 'test' })

      expect(result.body.items).toEqual([makeMemory(1), makeMemory(2)])
    })
  })

  describe('optional filters', () => {
    it('passes contactId to searchMemories when provided', async () => {
      await handler(mockReq, mockSession, {
        search: 'test',
        contactId: 'contact-1',
      })
      expect(searchMemories).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ contactId: 'contact-1' })
      )
    })

    it('passes botId to searchMemories when provided', async () => {
      await handler(mockReq, mockSession, {
        search: 'test',
        botId: 'bot-1',
      })
      expect(searchMemories).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ botId: 'bot-1' })
      )
    })

    it('passes both contactId and botId when provided together', async () => {
      await handler(mockReq, mockSession, {
        search: 'test',
        contactId: 'contact-1',
        botId: 'bot-1',
      })
      expect(searchMemories).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ contactId: 'contact-1', botId: 'bot-1' })
      )
    })

    it('works without contactId or botId', async () => {
      await expect(
        handler(mockReq, mockSession, { search: 'test' })
      ).resolves.toBeDefined()
    })
  })

  describe('pagination limits', () => {
    it('sets a take limit on the search options', async () => {
      await handler(mockReq, mockSession, { search: 'test' })
      expect(searchMemories).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ take: expect.any(Number) })
      )
    })

    it('sets a result limit on the search options', async () => {
      await handler(mockReq, mockSession, { search: 'test' })
      expect(searchMemories).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ limit: expect.any(Number) })
      )
    })
  })

  describe('empty results', () => {
    it('returns an empty items array when no memories match', async () => {
      searchMemories.mockResolvedValue([])

      const result = await handler(mockReq, mockSession, {
        search: 'no match',
      })

      expect(result.body.items).toEqual([])
    })
  })

  describe('error propagation', () => {
    it('propagates errors from searchMemories', async () => {
      searchMemories.mockRejectedValue(new Error('search failed'))
      await expect(
        handler(mockReq, mockSession, { search: 'test' })
      ).rejects.toThrow('search failed')
    })
  })

  describe('user isolation', () => {
    it('passes the session user (not just the id) to searchMemories', async () => {
      const customSession = { user: { id: 'user-xyz', role: 'admin' } }

      await handler(mockReq, customSession, { search: 'test' })
      expect(searchMemories).toHaveBeenCalledWith(
        customSession.user,
        expect.anything(),
        expect.anything()
      )
    })
  })
})
