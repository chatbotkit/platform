/**
 * @jest-environment node
 */
import { getUsageSeries } from '@/lib/usage.get'

import handler from './fetch'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/usage.get', () => ({
  getUsageSeries: jest.fn(),
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

const makeUsageSeries = (overrides = {}) => ({
  tokens: [
    { date: 1700000000000, total: 5000, extra: 'ignored' },
    { date: 1700086400000, total: 3000, extra: 'ignored' },
  ],
  conversations: [
    { date: 1700000000000, total: 10, extra: 'ignored' },
    { date: 1700086400000, total: 7, extra: 'ignored' },
  ],
  messages: [
    { date: 1700000000000, total: 50, extra: 'ignored' },
    { date: 1700086400000, total: 35, extra: 'ignored' },
  ],
  ...overrides,
})

const mockSession = { user: { id: 'user-abc' } }
const mockReq = {}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('GET /api/v1/usage/series/fetch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUsageSeries.mockResolvedValue(makeUsageSeries())
  })

  describe('data fetching', () => {
    it('fetches usage series for the authenticated user', async () => {
      await handler(mockReq, mockSession)
      expect(getUsageSeries).toHaveBeenCalledWith('user-abc')
      expect(getUsageSeries).toHaveBeenCalledTimes(1)
    })

    it('uses the session user id, not a hardcoded value', async () => {
      const otherSession = { user: { id: 'user-xyz' } }

      await handler(mockReq, otherSession)
      expect(getUsageSeries).toHaveBeenCalledWith('user-xyz')
    })
  })

  describe('data transformation', () => {
    it('returns tokens as {date, total} pairs', async () => {
      const result = await handler(mockReq, mockSession)

      expect(result.body.tokens).toEqual([
        { date: 1700000000000, total: 5000 },
        { date: 1700086400000, total: 3000 },
      ])
    })

    it('returns conversations as {date, total} pairs', async () => {
      const result = await handler(mockReq, mockSession)

      expect(result.body.conversations).toEqual([
        { date: 1700000000000, total: 10 },
        { date: 1700086400000, total: 7 },
      ])
    })

    it('returns messages as {date, total} pairs', async () => {
      const result = await handler(mockReq, mockSession)

      expect(result.body.messages).toEqual([
        { date: 1700000000000, total: 50 },
        { date: 1700086400000, total: 35 },
      ])
    })

    it('strips extra fields from data points', async () => {
      const result = await handler(mockReq, mockSession)

      for (const point of result.body.tokens) {
        expect(Object.keys(point)).toEqual(['date', 'total'])
      }
    })
  })

  describe('empty series', () => {
    it('returns empty arrays when all series are empty', async () => {
      getUsageSeries.mockResolvedValue({
        tokens: [],
        conversations: [],
        messages: [],
      })

      const result = await handler(mockReq, mockSession)

      expect(result.body).toEqual({
        tokens: [],
        conversations: [],
        messages: [],
      })
    })

    it('handles mixed empty and populated series', async () => {
      getUsageSeries.mockResolvedValue({
        tokens: [{ date: 1700000000000, total: 100 }],
        conversations: [],
        messages: [],
      })

      const result = await handler(mockReq, mockSession)

      expect(result.body.tokens).toHaveLength(1)
      expect(result.body.conversations).toHaveLength(0)
    })
  })

  describe('response format', () => {
    it('returns a 200 status', async () => {
      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
    })

    it('response body has tokens, conversations, and messages keys', async () => {
      const result = await handler(mockReq, mockSession)

      expect(result.body).toHaveProperty('tokens')
      expect(result.body).toHaveProperty('conversations')
      expect(result.body).toHaveProperty('messages')
    })
  })
})
