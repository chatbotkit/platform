/**
 * @jest-environment node
 */
import { mockDeep } from 'jest-mock-extended'

import prisma from '@/prisma/client'
import { getEventMetricSeriesOverPeriod } from '@/prisma/sql'

import { ttlCache } from '@/lib/cache'
import { getEventMetricSeries, getEventMetricSeriesNow } from '@/lib/metric'

jest.mock('@/prisma/client', () => {
  const mockPrisma = mockDeep()

  return {
    __esModule: true,
    default: mockPrisma,
    prisma: mockPrisma,
  }
})

// @note the TypedSQL factory is a plain function; stub it so we can assert the
// arguments it is called with and hand a recognisable token to $queryRawTyped.
jest.mock('@/prisma/sql', () => ({
  getEventMetricSeriesOverPeriod: jest.fn((...args) => ({
    query: 'getEventMetricSeriesOverPeriod',
    args,
  })),
}))

jest.mock('@/lib/cache', () => ({
  ttlCache: jest.fn(),
}))

jest.mock('@chatbotkit-dev/time', () => ({
  QUARTER_HOUR_IN_SECONDS: 900,
}))

const DAY_MS = 24 * 60 * 60 * 1000

describe('metric', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getEventMetricSeriesNow', () => {
    it('runs the typed query and returns its rows unchanged', async () => {
      const rows = [
        { date: new Date('2023-01-15'), total: 150 },
        { date: new Date('2023-01-16'), total: 200 },
      ]

      prisma.$queryRawTyped.mockResolvedValue(rows)

      const result = await getEventMetricSeriesNow(mockUser, 'page.view')

      // the factory is invoked with the user id, the type, and a from-date
      expect(getEventMetricSeriesOverPeriod).toHaveBeenCalledWith(
        'user-123',
        'page.view',
        expect.any(Date)
      )

      // and its token is handed to $queryRawTyped
      expect(prisma.$queryRawTyped).toHaveBeenCalledWith({
        query: 'getEventMetricSeriesOverPeriod',
        args: ['user-123', 'page.view', expect.any(Date)],
      })

      // no re-shaping: total is already a number, date already a Date
      expect(result).toEqual(rows)
    })

    it('computes a from-date roughly 90 days in the past', async () => {
      prisma.$queryRawTyped.mockResolvedValue([])

      await getEventMetricSeriesNow(mockUser, 'api.request')

      const fromDate = getEventMetricSeriesOverPeriod.mock.calls[0][2]
      const daysAgo = (Date.now() - fromDate.getTime()) / DAY_MS

      expect(daysAgo).toBeGreaterThan(89)
      expect(daysAgo).toBeLessThan(91)
      // boundary is snapped to the start of the day
      expect(fromDate.getHours()).toBe(0)
      expect(fromDate.getMinutes()).toBe(0)
      expect(fromDate.getSeconds()).toBe(0)
    })

    it('handles empty results', async () => {
      prisma.$queryRawTyped.mockResolvedValue([])

      const result = await getEventMetricSeriesNow(mockUser, 'nonexistent')

      expect(result).toEqual([])
    })

    it('propagates database errors', async () => {
      prisma.$queryRawTyped.mockRejectedValue(new Error('connection failed'))

      await expect(
        getEventMetricSeriesNow(mockUser, 'error.metric')
      ).rejects.toThrow('connection failed')
    })
  })

  describe('getEventMetricSeries', () => {
    it('wraps getEventMetricSeriesNow in ttlCache with the right key and ttl', async () => {
      const cached = [{ date: new Date('2023-01-15'), total: 100 }]

      ttlCache.mockResolvedValue(cached)

      const result = await getEventMetricSeries(mockUser, 'cached.metric')

      expect(ttlCache).toHaveBeenCalledWith(
        'event:metric:user[user-123].type[cached.metric]',
        900,
        expect.any(Function)
      )

      expect(result).toEqual(cached)
      // served from cache: the database is never touched
      expect(prisma.$queryRawTyped).not.toHaveBeenCalled()
    })

    it('runs the query when the cache function is executed', async () => {
      const rows = [{ date: new Date('2023-01-15'), total: 250 }]

      prisma.$queryRawTyped.mockResolvedValue(rows)
      ttlCache.mockImplementation(async (_key, _ttl, fn) => fn())

      const result = await getEventMetricSeries(mockUser, 'function.test')

      expect(getEventMetricSeriesOverPeriod).toHaveBeenCalledWith(
        'user-123',
        'function.test',
        expect.any(Date)
      )
      expect(result).toEqual(rows)
    })
  })
})
