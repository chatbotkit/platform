/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'
import { getConversationUsageStats } from '@/prisma/sql'

import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      conversation: {
        findUniqueByIdentifier: jest.fn(),
      },
      $queryRawTyped: jest.fn(),
    },
  }),
  { virtual: true }
)

jest.mock('@/prisma/sql', () => ({
  getConversationUsageStats: jest.fn(() => 'mock-query-tag'),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
  queryParam: jest.fn((req, param) => req.query?.[param] ?? null),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((x) => x),
}))

const { queryParam } = require('@/lib/query.get')

describe('GET /api/v1/conversation/{conversationId}/usage/fetch', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockConversation = {
    id: 'conv_abc',
    userId: 'user_123',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.conversation.findUniqueByIdentifier.mockResolvedValue(
      mockConversation
    )

    prisma.$queryRawTyped.mockResolvedValue([
      { totalTokens: 1500n, totalMessages: 10n },
    ])
  })

  describe('authorization', () => {
    it('should return 404 when conversation does not exist', async () => {
      prisma.conversation.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { conversationId: 'conv_missing' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when conversation belongs to a different user', async () => {
      prisma.conversation.findUniqueByIdentifier.mockResolvedValue({
        id: 'conv_abc',
        userId: 'other_user_999',
      })

      const req = { query: { conversationId: 'conv_abc' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })

    it('should return 200 for the conversation owner', async () => {
      const req = { query: { conversationId: 'conv_abc' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
    })
  })

  describe('statistics processing', () => {
    it('should convert BigInt token count to a plain Number', async () => {
      prisma.$queryRawTyped.mockResolvedValue([
        { totalTokens: 9999n, totalMessages: 42n },
      ])

      const req = { query: { conversationId: 'conv_abc' } }

      const result = await handler(req, mockSession)

      const body = await result.json()

      expect(typeof body.tokens).toBe('number')
      expect(body.tokens).toBe(9999)
      expect(typeof body.messages).toBe('number')
      expect(body.messages).toBe(42)
    })

    it('should default to zero tokens and messages when query returns no rows', async () => {
      prisma.$queryRawTyped.mockResolvedValue([])

      const req = { query: { conversationId: 'conv_abc' } }

      const result = await handler(req, mockSession)

      const body = await result.json()

      expect(body.tokens).toBe(0)
      expect(body.messages).toBe(0)
    })

    it('should default tokens to 0 when totalTokens is null', async () => {
      prisma.$queryRawTyped.mockResolvedValue([
        { totalTokens: null, totalMessages: 5n },
      ])

      const req = { query: { conversationId: 'conv_abc' } }

      const result = await handler(req, mockSession)

      const body = await result.json()

      expect(body.tokens).toBe(0)
      expect(body.messages).toBe(5)
    })

    it('should default messages to 0 when totalMessages is null', async () => {
      prisma.$queryRawTyped.mockResolvedValue([
        { totalTokens: 100n, totalMessages: null },
      ])

      const req = { query: { conversationId: 'conv_abc' } }

      const result = await handler(req, mockSession)

      const body = await result.json()

      expect(body.tokens).toBe(100)
      expect(body.messages).toBe(0)
    })
  })

  describe('query construction', () => {
    it('should query stats using the session user id and conversation id', async () => {
      const req = { query: { conversationId: 'conv_abc' } }

      await handler(req, mockSession)

      expect(getConversationUsageStats).toHaveBeenCalledWith(
        'user_123',
        'conv_abc',
        expect.any(Date),
        expect.any(Date)
      )

      expect(prisma.$queryRawTyped).toHaveBeenCalledWith('mock-query-tag')
    })

    it('should call findUniqueByIdentifier with session user and conversationId', async () => {
      const req = { query: { conversationId: 'conv_abc' } }

      await handler(req, mockSession)

      expect(prisma.conversation.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'conv_abc',
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            userId: true,
          }),
        })
      )
    })
  })

  describe('date range clamping', () => {
    it('should clamp a from date more than 90 days in the past to the 90-day boundary', async () => {
      // @note pass a date 200 days ago - should be clamped to 90 days ago
      const veryOldDate = new Date()

      veryOldDate.setDate(veryOldDate.getDate() - 200)
      queryParam.mockImplementation((req, param) => {
        if (param === 'from') {
          return veryOldDate.toISOString()
        }

        return null
      })

      const req = { query: { conversationId: 'conv_abc' } }

      await handler(req, mockSession)

      const [, , passedFromDate] = getConversationUsageStats.mock.calls[0]

      const ninetyDaysAgo = new Date()

      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

      // @note the from date should have been clamped - it cannot be older than 90 days
      expect(passedFromDate.getTime()).toBeGreaterThanOrEqual(
        ninetyDaysAgo.getTime() - 1000 // allow 1s margin for test execution
      )
    })

    it('should clamp a to date in the future to the current time boundary', async () => {
      // @note pass a date 1 year in the future - should be clamped to now
      const futureDate = new Date()

      futureDate.setFullYear(futureDate.getFullYear() + 1)
      queryParam.mockImplementation((req, param) => {
        if (param === 'to') {
          return futureDate.toISOString()
        }

        return null
      })

      const req = { query: { conversationId: 'conv_abc' } }

      await handler(req, mockSession)

      const [, , , passedToDate] = getConversationUsageStats.mock.calls[0]

      const now = new Date()

      // @note the to date should have been clamped to current time (not future)
      expect(passedToDate.getTime()).toBeLessThanOrEqual(now.getTime() + 1000)
    })

    it('should ensure to date is never before from date when from is later', async () => {
      // @note if from > to, validToDate should be set to fromDate via maxDate()
      const fromDate = new Date()

      fromDate.setDate(fromDate.getDate() - 10)

      const toDate = new Date()

      toDate.setDate(toDate.getDate() - 20) // to is before from
      queryParam.mockImplementation((req, param) => {
        if (param === 'from') {
          return fromDate.toISOString()
        }

        if (param === 'to') {
          return toDate.toISOString()
        }

        return null
      })

      const req = { query: { conversationId: 'conv_abc' } }

      await handler(req, mockSession)

      const [, , passedFrom, passedTo] = getConversationUsageStats.mock.calls[0]

      // @note when to < from, validToDate = maxDate(from, to) = from
      expect(passedTo.getTime()).toBeGreaterThanOrEqual(passedFrom.getTime())
    })
  })

  describe('error handling', () => {
    it('should propagate database errors when looking up the conversation', async () => {
      prisma.conversation.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB connection failed')
      )

      const req = { query: { conversationId: 'conv_abc' } }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'DB connection failed'
      )
    })

    it('should propagate errors from the usage stats query', async () => {
      prisma.$queryRawTyped.mockRejectedValue(
        new Error('Usage query timed out')
      )

      const req = { query: { conversationId: 'conv_abc' } }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Usage query timed out'
      )
    })
  })
})
