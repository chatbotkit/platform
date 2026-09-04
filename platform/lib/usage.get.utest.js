/**
 * @jest-environment node
 */
import { mockDeep } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import memcache from '@/lib/memcache'
import { getBaseLanguageModelTokenCount } from '@/lib/model.utils'
import {
  getUsage,
  getUsageForPeriod,
  getUsageSeriesNow as getUsageSeries,
  getUsageSeriesFromDate,
} from '@/lib/usage.get'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/prisma/utils', () => ({
  __esModule: true,
  join: jest.fn((values) => values),
}))

jest.mock('@/lib/memcache', () => {
  const mockPipeline = {
    get: jest.fn().mockReturnThis(),
    ttl: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  }

  return {
    __esModule: true,
    default: {
      pipeline: jest.fn(() => mockPipeline),
    },
  }
})

jest.mock('@/lib/model.utils', () => ({
  getBaseLanguageModelTokenCount: jest.fn((model, count) => count * 1.5),

  useTypeToLanguageModelMapping: {
    OPENAI_GPT_4_TOKEN: 'gpt-4',
    OPENAI_GPT_3_5_TURBO_TOKEN: 'gpt-3.5-turbo',
  },
}))

jest.mock('@/lib/usage.record', () => ({
  getUsageKey: jest.fn((userId, type) => `usage-${userId}-${type}`),
}))

describe('usage.get', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getUsage', () => {
    it('should return usage data with correct structure', async () => {
      const mockPipeline = memcache.pipeline()

      mockPipeline.exec.mockResolvedValue([
        100, // tokens
        5, // conversations
        20, // messages
        3600, // tokens ttl
        3600, // conversations ttl
        3600, // messages ttl
      ])

      const result = await getUsage('user123')

      expect(result).toEqual({
        tokens: { value: 100, ttl: 3600000 },
        conversations: { value: 5, ttl: 3600000 },
        messages: { value: 20, ttl: 3600000 },
      })
    })

    it('should handle missing usage data with zero values', async () => {
      const mockPipeline = memcache.pipeline()

      mockPipeline.exec.mockResolvedValue([
        null, // tokens
        null, // conversations
        null, // messages
        -1, // tokens ttl (no expiry)
        -1, // conversations ttl
        -1, // messages ttl
      ])

      const result = await getUsage('user123')

      expect(result).toEqual({
        tokens: { value: 0, ttl: 0 },
        conversations: { value: 0, ttl: 0 },
        messages: { value: 0, ttl: 0 },
      })
    })

    it('should convert string values to integers', async () => {
      const mockPipeline = memcache.pipeline()

      mockPipeline.exec.mockResolvedValue([
        '150', // tokens as string
        '10', // conversations as string
        '25', // messages as string
        7200, // tokens ttl
        7200, // conversations ttl
        7200, // messages ttl
      ])

      const result = await getUsage('user123')

      expect(result).toEqual({
        tokens: { value: 150, ttl: 7200000 },
        conversations: { value: 10, ttl: 7200000 },
        messages: { value: 25, ttl: 7200000 },
      })
    })

    it('should handle invalid string values gracefully', async () => {
      const mockPipeline = memcache.pipeline()

      mockPipeline.exec.mockResolvedValue([
        'invalid', // invalid tokens string
        'abc', // invalid conversations string
        'xyz', // invalid messages string
        3600, // tokens ttl
        3600, // conversations ttl
        3600, // messages ttl
      ])

      const result = await getUsage('user123')

      expect(result).toEqual({
        tokens: { value: 0, ttl: 3600000 },
        conversations: { value: 0, ttl: 3600000 },
        messages: { value: 0, ttl: 3600000 },
      })
    })

    it('should use correct redis keys', async () => {
      const mockPipeline = memcache.pipeline()

      mockPipeline.exec.mockResolvedValue([0, 0, 0, 0, 0, 0])

      await getUsage('test-user-456')

      expect(mockPipeline.get).toHaveBeenCalledWith('usage-test-user-456-token')
      expect(mockPipeline.get).toHaveBeenCalledWith(
        'usage-test-user-456-conversation'
      )
      expect(mockPipeline.get).toHaveBeenCalledWith(
        'usage-test-user-456-message'
      )
      expect(mockPipeline.ttl).toHaveBeenCalledWith('usage-test-user-456-token')
      expect(mockPipeline.ttl).toHaveBeenCalledWith(
        'usage-test-user-456-conversation'
      )
      expect(mockPipeline.ttl).toHaveBeenCalledWith(
        'usage-test-user-456-message'
      )
    })
  })

  describe('getUsageSeries', () => {
    it('should return usage series data with correct structure', async () => {
      const mockTokenData = [
        {
          date: new Date('2023-01-01'),
          type: 'OPENAI_GPT_4_TOKEN',
          total: { toNumber: () => 100 },
        },
        {
          date: new Date('2023-01-02'),
          type: 'OPENAI_GPT_3_5_TURBO_TOKEN',
          total: { toNumber: () => 50 },
        },
      ]

      const mockConversationData = [
        { date: new Date('2023-01-01'), total: { toNumber: () => 5 } },
        { date: new Date('2023-01-02'), total: { toNumber: () => 3 } },
      ]

      const mockMessageData = [
        { date: new Date('2023-01-01'), total: { toNumber: () => 20 } },
        { date: new Date('2023-01-02'), total: { toNumber: () => 15 } },
      ]

      // @note we mock $queryRaw to return different values for each call
      // since we use Promise.all instead of $transaction
      prisma.$queryRaw.mockResolvedValueOnce(mockTokenData)
      prisma.$queryRawTyped
        .mockResolvedValueOnce(mockConversationData)
        .mockResolvedValueOnce(mockMessageData)

      const result = await getUsageSeries('user123')

      expect(result).toHaveProperty('tokens')
      expect(result).toHaveProperty('conversations')
      expect(result).toHaveProperty('messages')
      expect(Array.isArray(result.tokens)).toBe(true)
      expect(Array.isArray(result.conversations)).toBe(true)
      expect(Array.isArray(result.messages)).toBe(true)
    })

    it('should execute three database queries', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([])
      prisma.$queryRawTyped.mockResolvedValueOnce([]).mockResolvedValueOnce([])

      await getUsageSeries('user456')

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
      expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(2)
    })

    it('should handle empty results', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([])
      prisma.$queryRawTyped.mockResolvedValueOnce([]).mockResolvedValueOnce([])

      const result = await getUsageSeries('user789')

      expect(result).toEqual({
        tokens: [],
        conversations: [],
        messages: [],
      })
    })

    it('should apply token count conversion for tokens data', async () => {
      const mockTokenData = [
        {
          date: new Date('2023-01-01'),
          type: 'OPENAI_GPT_4_TOKEN',
          total: { toNumber: () => 100 },
        },
      ]

      prisma.$queryRaw.mockResolvedValueOnce(mockTokenData)
      prisma.$queryRawTyped.mockResolvedValueOnce([]).mockResolvedValueOnce([])

      await getUsageSeries('user123')

      expect(getBaseLanguageModelTokenCount).toHaveBeenCalledWith('gpt-4', 100)
    })

    it('should use exact token types instead of a wildcard token filter', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([])
      prisma.$queryRawTyped.mockResolvedValueOnce([]).mockResolvedValueOnce([])

      await getUsageSeries('user123')

      const [strings] = prisma.$queryRaw.mock.calls[0]
      const queryText = strings.join('?')

      expect(queryText).toContain('type IN (')
      expect(queryText).not.toContain("LIKE '%_TOKEN'")
    })

    it('should convert BigInt totals to numbers for conversations and messages', async () => {
      const mockConversationData = [
        { date: new Date('2023-01-01'), total: { toNumber: () => 10 } },
      ]

      const mockMessageData = [
        { date: new Date('2023-01-01'), total: { toNumber: () => 25 } },
      ]

      prisma.$queryRaw.mockResolvedValueOnce([])
      prisma.$queryRawTyped
        .mockResolvedValueOnce(mockConversationData)
        .mockResolvedValueOnce(mockMessageData)

      const result = await getUsageSeries('user123')

      expect(result.conversations[0].total).toBe(10)
      expect(result.messages[0].total).toBe(25)
    })

    it('should sum BigInt token totals as returned by SQLite', async () => {
      const mockTokenData = [
        { date: new Date('2023-01-01'), type: 'OPENAI_GPT_4_TOKEN', total: 100n },
        {
          date: new Date('2023-01-01'),
          type: 'OPENAI_GPT_3_5_TURBO_TOKEN',
          total: 50n,
        },
      ]

      prisma.$queryRaw.mockResolvedValueOnce(mockTokenData)
      prisma.$queryRawTyped
        .mockResolvedValueOnce([{ date: new Date('2023-01-01'), total: 7n }])
        .mockResolvedValueOnce([{ date: new Date('2023-01-01'), total: 9n }])

      const result = await getUsageSeries('user123')

      expect(getBaseLanguageModelTokenCount).toHaveBeenCalledWith('gpt-4', 100)
      expect(result.tokens).toEqual([
        { date: new Date('2023-01-01'), total: 225 },
      ])
      expect(result.conversations[0].total).toBe(7)
      expect(result.messages[0].total).toBe(9)
    })
  })

  describe('getUsageSeriesFromDate', () => {
    it('should keep only daily buckets on or after the given date', () => {
      const usageSeries = {
        tokens: [
          { date: new Date('2023-01-01T00:00:00Z'), total: 10 },
          { date: new Date('2023-01-15T00:00:00Z'), total: 20 },
        ],
        conversations: [
          { date: new Date('2023-01-10T00:00:00Z'), total: 2 },
          { date: new Date('2023-01-20T00:00:00Z'), total: 3 },
        ],
        messages: [
          { date: new Date('2023-01-05T00:00:00Z'), total: 5 },
          { date: new Date('2023-01-25T00:00:00Z'), total: 6 },
        ],
      }

      const result = getUsageSeriesFromDate(
        usageSeries,
        new Date('2023-01-15T18:30:00Z')
      )

      expect(result).toEqual({
        tokens: [{ date: new Date('2023-01-15T00:00:00Z'), total: 20 }],
        conversations: [{ date: new Date('2023-01-20T00:00:00Z'), total: 3 }],
        messages: [{ date: new Date('2023-01-25T00:00:00Z'), total: 6 }],
      })
    })
  })

  describe('getUsageForPeriod', () => {
    it('should return usage data for specified period', async () => {
      const fromDate = new Date('2023-01-01')
      const toDate = new Date('2023-01-31')

      const mockTokenData = [
        {
          date: new Date('2023-01-15'),
          type: 'OPENAI_GPT_4_TOKEN',
          total: { toNumber: () => 200 },
        },
      ]

      const mockConversationData = [
        { date: new Date('2023-01-15'), total: { toNumber: () => 8 } },
      ]

      const mockMessageData = [
        { date: new Date('2023-01-15'), total: { toNumber: () => 30 } },
      ]

      // @note we mock $queryRaw to return different values for each call
      // since we use Promise.all instead of $transaction
      prisma.$queryRaw.mockResolvedValueOnce(mockTokenData)
      prisma.$queryRawTyped
        .mockResolvedValueOnce(mockConversationData)
        .mockResolvedValueOnce(mockMessageData)

      const result = await getUsageForPeriod('user123', fromDate, toDate)

      expect(result).toHaveProperty('tokens')
      expect(result).toHaveProperty('conversations')
      expect(result).toHaveProperty('messages')
      expect(Array.isArray(result.tokens)).toBe(true)
      expect(Array.isArray(result.conversations)).toBe(true)
      expect(Array.isArray(result.messages)).toBe(true)
    })

    it('should convert dates to unix timestamps', async () => {
      const fromDate = new Date('2023-01-01T00:00:00Z')
      const toDate = new Date('2023-01-31T23:59:59Z')

      prisma.$queryRaw.mockResolvedValueOnce([])
      prisma.$queryRawTyped.mockResolvedValueOnce([]).mockResolvedValueOnce([])

      await getUsageForPeriod('user123', fromDate, toDate)

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
      expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(2)

      const fromTimestamp = fromDate.getTime() / 1000
      const toTimestamp = toDate.getTime() / 1000

      expect(fromTimestamp).toBe(1672531200) // 2023-01-01 00:00:00 UTC
      expect(toTimestamp).toBe(1675209599) // 2023-01-31 23:59:59 UTC
    })

    it('should handle invalid date objects', async () => {
      const invalidDate1 = new Date('invalid')
      const invalidDate2 = new Date('also-invalid')

      prisma.$queryRaw.mockResolvedValueOnce([])
      prisma.$queryRawTyped.mockResolvedValueOnce([]).mockResolvedValueOnce([])

      await getUsageForPeriod('user123', invalidDate1, invalidDate2)

      expect(prisma.$queryRaw).toHaveBeenCalled()
    })

    it('should sum BigInt token totals as returned by SQLite', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { date: new Date('2023-01-15'), type: 'OPENAI_GPT_4_TOKEN', total: 40n },
        { date: new Date('2023-01-15'), type: 'OPENAI_GPT_4_TOKEN', total: 20n },
      ])
      prisma.$queryRawTyped.mockResolvedValueOnce([]).mockResolvedValueOnce([])

      const result = await getUsageForPeriod('user123', new Date(), new Date())

      expect(result.tokens).toEqual([
        { date: new Date('2023-01-15'), total: 90 },
      ])
    })

    it('should group token data by date correctly', async () => {
      const mockTokenData = [
        {
          date: new Date('2023-01-01'),
          type: 'OPENAI_GPT_4_TOKEN',
          total: { toNumber: () => 100 },
        },
        {
          date: new Date('2023-01-01'),
          type: 'OPENAI_GPT_3_5_TURBO_TOKEN',
          total: { toNumber: () => 50 },
        },
        {
          date: new Date('2023-01-02'),
          type: 'OPENAI_GPT_4_TOKEN',
          total: { toNumber: () => 75 },
        },
      ]

      prisma.$queryRaw.mockResolvedValueOnce(mockTokenData)
      prisma.$queryRawTyped.mockResolvedValueOnce([]).mockResolvedValueOnce([])

      const result = await getUsageForPeriod('user123', new Date(), new Date())

      expect(result.tokens).toHaveLength(2)

      const jan1Entry = result.tokens.find((entry) =>
        entry.date.toISOString().startsWith('2023-01-01')
      )

      const jan2Entry = result.tokens.find((entry) =>
        entry.date.toISOString().startsWith('2023-01-02')
      )

      expect(jan1Entry.total).toBe(225) // (100 + 50) * 1.5
      expect(jan2Entry.total).toBe(112.5) // 75 * 1.5
    })
  })
})
