import memcache from '@/lib/memcache'
import {
  USAGE_PERIOD_IN_DAYS,
  USAGE_PERIOD_IN_MILLISECONDS,
  USAGE_PERIOD_IN_SECONDS,
  getUserUsageElapsedDays,
  getUserUsagePeriod,
  getUserUsageRemainingDays,
} from '@/lib/usage.period'

jest.mock('@/lib/usage.record', () => ({
  getUsageKey: jest.fn((userId, type) => `usage-${userId}-${type}`),
}))

jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: {
    ttl: jest.fn(),
  },
}))

describe('usage.period', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('constants', () => {
    it('should define correct period constants', () => {
      expect(USAGE_PERIOD_IN_DAYS).toBe(31)
      expect(USAGE_PERIOD_IN_SECONDS).toBe(31 * 24 * 60 * 60)
      expect(USAGE_PERIOD_IN_MILLISECONDS).toBe(31 * 24 * 60 * 60 * 1000)
    })

    it('should have consistent conversion between units', () => {
      expect(USAGE_PERIOD_IN_SECONDS).toBe(USAGE_PERIOD_IN_DAYS * 86400)
      expect(USAGE_PERIOD_IN_MILLISECONDS).toBe(USAGE_PERIOD_IN_SECONDS * 1000)
    })
  })

  describe('getUserUsagePeriod', () => {
    describe('basic functionality', () => {
      it('should calculate period with positive TTL', async () => {
        const userId = 'user-123'
        const ttlSeconds = 15 * 24 * 60 * 60 // 15 days

        memcache.ttl.mockResolvedValue(ttlSeconds)

        const result = await getUserUsagePeriod(userId)

        expect(result).toHaveProperty('start')
        expect(result).toHaveProperty('end')
        expect(result.start).toBeInstanceOf(Date)
        expect(result.end).toBeInstanceOf(Date)

        // end should be in the future
        expect(result.end.getTime()).toBeGreaterThan(Date.now())

        // period should span 31 days
        const periodMs = result.end.getTime() - result.start.getTime()

        expect(periodMs).toBe(USAGE_PERIOD_IN_MILLISECONDS)
      })

      it('should handle TTL at beginning of period', async () => {
        const userId = 'user-456'
        const ttlSeconds = USAGE_PERIOD_IN_SECONDS // 31 days remaining

        memcache.ttl.mockResolvedValue(ttlSeconds)

        const result = await getUserUsagePeriod(userId)

        // start should be approximately now
        const startDiff = Math.abs(result.start.getTime() - Date.now())

        expect(startDiff).toBeLessThan(1000) // within 1 second
      })

      it('should handle TTL near end of period', async () => {
        const userId = 'user-789'
        const ttlSeconds = 60 // 1 minute remaining

        memcache.ttl.mockResolvedValue(ttlSeconds)

        const result = await getUserUsagePeriod(userId)

        // end should be approximately 1 minute from now
        const endDiff = Math.abs(result.end.getTime() - (Date.now() + 60000))

        expect(endDiff).toBeLessThan(1000)

        // period should still span 31 days
        const periodMs = result.end.getTime() - result.start.getTime()

        expect(periodMs).toBe(USAGE_PERIOD_IN_MILLISECONDS)
      })
    })

    describe('edge cases', () => {
      it('should handle zero TTL', async () => {
        const userId = 'user-expired'

        memcache.ttl.mockResolvedValue(0)

        const result = await getUserUsagePeriod(userId)

        // end should be approximately now
        const endDiff = Math.abs(result.end.getTime() - Date.now())

        expect(endDiff).toBeLessThan(1000)

        // period should span 31 days
        const periodMs = result.end.getTime() - result.start.getTime()

        expect(periodMs).toBe(USAGE_PERIOD_IN_MILLISECONDS)
      })

      it('should handle negative TTL as zero', async () => {
        const userId = 'user-negative'

        memcache.ttl.mockResolvedValue(-1)

        const result = await getUserUsagePeriod(userId)

        // negative TTL should be treated as 0 via Math.max
        const endDiff = Math.abs(result.end.getTime() - Date.now())

        expect(endDiff).toBeLessThan(1000)
      })

      it('should handle very large TTL', async () => {
        const userId = 'user-large'
        const ttlSeconds = 365 * 24 * 60 * 60 // 1 year

        memcache.ttl.mockResolvedValue(ttlSeconds)

        const result = await getUserUsagePeriod(userId)

        // period should still span exactly 31 days
        const periodMs = result.end.getTime() - result.start.getTime()

        expect(periodMs).toBe(USAGE_PERIOD_IN_MILLISECONDS)
      })
    })

    describe('redis interaction', () => {
      it('should call memcache.ttl with correct key', async () => {
        const userId = 'test-user'

        memcache.ttl.mockResolvedValue(1000)

        await getUserUsagePeriod(userId)

        expect(memcache.ttl).toHaveBeenCalledWith(`usage-${userId}-token`)
      })

      it('should be called exactly once', async () => {
        const userId = 'single-call'

        memcache.ttl.mockResolvedValue(500)

        await getUserUsagePeriod(userId)

        expect(memcache.ttl).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('getUserUsageElapsedDays', () => {
    describe('basic functionality', () => {
      it('should return 0 for period that starts in future', async () => {
        const userId = 'user-future'
        const ttlSeconds = USAGE_PERIOD_IN_SECONDS + 86400 // +1 day from now

        memcache.ttl.mockResolvedValue(ttlSeconds)

        const result = await getUserUsageElapsedDays(userId)

        expect(result).toBe(0)
      })

      it('should calculate elapsed days correctly', async () => {
        const userId = 'user-mid'
        const daysRemaining = 15
        const ttlSeconds = daysRemaining * 24 * 60 * 60

        memcache.ttl.mockResolvedValue(ttlSeconds)

        const result = await getUserUsageElapsedDays(userId)

        // 31 - 15 = 16 days elapsed
        expect(result).toBeGreaterThanOrEqual(15)
        expect(result).toBeLessThanOrEqual(17) // allow for timing
      })

      it('should return full period for expired TTL', async () => {
        const userId = 'user-expired'

        memcache.ttl.mockResolvedValue(0)

        const result = await getUserUsageElapsedDays(userId)

        expect(result).toBe(USAGE_PERIOD_IN_DAYS)
      })
    })

    describe('edge cases', () => {
      it('should handle period start (0 elapsed)', async () => {
        const userId = 'user-start'
        const ttlSeconds = USAGE_PERIOD_IN_SECONDS

        memcache.ttl.mockResolvedValue(ttlSeconds)

        const result = await getUserUsageElapsedDays(userId)

        expect(result).toBe(0)
      })

      it('should handle one day elapsed', async () => {
        const userId = 'user-one-day'
        const ttlSeconds = (USAGE_PERIOD_IN_DAYS - 1) * 24 * 60 * 60

        memcache.ttl.mockResolvedValue(ttlSeconds)

        const result = await getUserUsageElapsedDays(userId)

        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(2)
      })

      it('should handle negative TTL', async () => {
        const userId = 'user-negative'

        memcache.ttl.mockResolvedValue(-1)

        const result = await getUserUsageElapsedDays(userId)

        expect(result).toBe(USAGE_PERIOD_IN_DAYS)
      })
    })

    describe('floor calculation', () => {
      it('should use floor for partial days', async () => {
        const userId = 'user-partial'
        // set TTL such that elapsed is 1.5 days
        const ttlSeconds = (USAGE_PERIOD_IN_DAYS - 1.5) * 24 * 60 * 60

        memcache.ttl.mockResolvedValue(Math.floor(ttlSeconds))

        const result = await getUserUsageElapsedDays(userId)

        // should floor to 1 day
        expect(result).toBeGreaterThanOrEqual(1)
        expect(result).toBeLessThanOrEqual(2)
      })
    })
  })

  describe('getUserUsageRemainingDays', () => {
    describe('basic functionality', () => {
      it('should calculate remaining days correctly', async () => {
        const userId = 'user-remaining'
        const daysRemaining = 10
        const ttlSeconds = daysRemaining * 24 * 60 * 60

        memcache.ttl.mockResolvedValue(ttlSeconds)

        const result = await getUserUsageRemainingDays(userId)

        expect(result).toBeGreaterThanOrEqual(9)
        expect(result).toBeLessThanOrEqual(11) // allow for timing
      })

      it('should return 0 for expired period', async () => {
        const userId = 'user-expired'

        memcache.ttl.mockResolvedValue(0)

        const result = await getUserUsageRemainingDays(userId)

        expect(result).toBe(0)
      })

      it('should return full period at start', async () => {
        const userId = 'user-start'
        const ttlSeconds = USAGE_PERIOD_IN_SECONDS

        memcache.ttl.mockResolvedValue(ttlSeconds)

        const result = await getUserUsageRemainingDays(userId)

        expect(result).toBeGreaterThanOrEqual(30)
        expect(result).toBeLessThanOrEqual(31)
      })
    })

    describe('edge cases', () => {
      it('should return 1 for less than 24 hours remaining', async () => {
        const userId = 'user-hours'
        const ttlSeconds = 12 * 60 * 60 // 12 hours

        memcache.ttl.mockResolvedValue(ttlSeconds)

        const result = await getUserUsageRemainingDays(userId)

        // ceil should round up to 1 day
        expect(result).toBe(1)
      })

      it('should handle negative TTL as expired', async () => {
        const userId = 'user-negative'

        memcache.ttl.mockResolvedValue(-1)

        const result = await getUserUsageRemainingDays(userId)

        expect(result).toBe(0)
      })

      it('should return 0 when end is in past', async () => {
        const userId = 'user-past'

        memcache.ttl.mockResolvedValue(-86400) // -1 day

        const result = await getUserUsageRemainingDays(userId)

        expect(result).toBe(0)
      })
    })

    describe('ceil calculation', () => {
      it('should use ceil for partial days', async () => {
        const userId = 'user-partial'
        const ttlSeconds = 0.5 * 24 * 60 * 60 // 12 hours

        memcache.ttl.mockResolvedValue(Math.floor(ttlSeconds))

        const result = await getUserUsageRemainingDays(userId)

        // should ceil to 1 day
        expect(result).toBe(1)
      })

      it('should ceil up even for small fractions', async () => {
        const userId = 'user-minute'
        const ttlSeconds = 60 // 1 minute

        memcache.ttl.mockResolvedValue(ttlSeconds)

        const result = await getUserUsageRemainingDays(userId)

        // should ceil to 1 day
        expect(result).toBe(1)
      })
    })
  })

  describe('integration scenarios', () => {
    it('should have elapsed + remaining approximately equal period', async () => {
      const userId = 'user-integration'
      const ttlSeconds = 15 * 24 * 60 * 60 // 15 days

      memcache.ttl.mockResolvedValue(ttlSeconds)

      const elapsed = await getUserUsageElapsedDays(userId)
      const remaining = await getUserUsageRemainingDays(userId)

      // due to ceil/floor, sum might be off by 1
      expect(elapsed + remaining).toBeGreaterThanOrEqual(
        USAGE_PERIOD_IN_DAYS - 1
      )
      expect(elapsed + remaining).toBeLessThanOrEqual(USAGE_PERIOD_IN_DAYS + 1)
    })

    it('should handle complete lifecycle from start to end', async () => {
      const userId = 'user-lifecycle'

      // beginning of period
      memcache.ttl.mockResolvedValue(USAGE_PERIOD_IN_SECONDS)

      let elapsed = await getUserUsageElapsedDays(userId)
      let remaining = await getUserUsageRemainingDays(userId)

      expect(elapsed).toBe(0)
      expect(remaining).toBeGreaterThanOrEqual(30)

      // middle of period
      memcache.ttl.mockResolvedValue(15 * 24 * 60 * 60)
      elapsed = await getUserUsageElapsedDays(userId)
      remaining = await getUserUsageRemainingDays(userId)

      expect(elapsed).toBeGreaterThan(10)
      expect(remaining).toBeGreaterThan(10)

      // end of period
      memcache.ttl.mockResolvedValue(0)
      elapsed = await getUserUsageElapsedDays(userId)
      remaining = await getUserUsageRemainingDays(userId)

      expect(elapsed).toBe(USAGE_PERIOD_IN_DAYS)
      expect(remaining).toBe(0)
    })
  })
})
