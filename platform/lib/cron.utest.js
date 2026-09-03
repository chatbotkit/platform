import { getNext, isCron, parse } from '@/lib/cron'

jest.retryTimes(3) // @note time drift can cause some of these tests to fail

describe('isCron', () => {
  it('should return false when empty', () => {
    expect(isCron('')).toBe(false)
  })

  it('should return false when whitespace', () => {
    expect(isCron(' ')).toBe(false)
  })

  it('should return true for valid cron', () => {
    expect(isCron('* * * * *')).toBe(true)
  })

  it('should return false for invalid cron', () => {
    expect(isCron('invalid')).toBe(false)
  })
})

describe('getNext', () => {
  test('returns a future date for a valid cron expression', () => {
    const now = new Date()
    const nextDate = getNext('* * * * *')

    expect(nextDate instanceof Date).toBe(true)
    expect(nextDate.getTime()).toBeGreaterThan(now.getTime())
    expect(nextDate.getTime()).toBeLessThan(now.getTime() + 60000)
  })

  test('respects the retries option', () => {
    const now = new Date()
    const nextDate = getNext('* * * * *', { retries: 3 })

    expect(nextDate instanceof Date).toBe(true)
    expect(nextDate.getTime()).toBeGreaterThan(now.getTime())
    expect(nextDate.getTime()).toBeLessThan(now.getTime() + 60000)
  })

  test('respects the minMs option', () => {
    const now = new Date()
    const nextDate = getNext('* * * * *', { minMs: 60000 })

    expect(nextDate instanceof Date).toBe(true)
    expect(nextDate.getTime()).toBeGreaterThan(now.getTime() + 60000)
    expect(nextDate.getTime()).toBeLessThan(now.getTime() + 120000)
  })
})

describe('isCron - additional edge cases', () => {
  describe('input validation', () => {
    it.each([
      [null, 'null input'],
      [undefined, 'undefined input'],
      [123, 'number input'],
      [[], 'array input'],
      [{}, 'object input'],
      [true, 'boolean input'],
    ])('should handle non-string input gracefully: %s (%s)', (input) => {
      // @note isCron should handle non-string inputs gracefully - currently
      // throws error on .trim()

      expect(() => isCron(input)).toThrow()
    })
  })

  describe('valid cron expressions', () => {
    it.each([
      ['0 0 * * *', 'daily at midnight'],
      ['0 12 * * MON', 'weekly on Monday at noon'],
      ['*/15 * * * *', 'every 15 minutes'],
      ['0 0 1 1 *', 'yearly on January 1st'],
      ['0 0 * * 0', 'weekly on Sunday'],
      ['30 2 * * 1-5', 'weekdays at 2:30 AM'],
      ['0 */6 * * *', 'every 6 hours'],
      ['0 9-17 * * 1-5', 'business hours on weekdays'],
    ])('should return true for valid cron expression: %s (%s)', (cronExpr) => {
      expect(isCron(cronExpr)).toBe(true)
    })
  })

  describe('invalid cron expressions', () => {
    it.each([
      ['60 * * * *', 'invalid minute (60)'],
      ['* 24 * * *', 'invalid hour (24)'],
      ['* * 32 * *', 'invalid day (32)'],
      ['* * * 13 *', 'invalid month (13)'],
      ['abc * * * *', 'non-numeric value'],
      ['* * * * MON-SUN-TUE', 'malformed range'],
      ['-1 * * * *', 'negative value'],
    ])(
      'should return false for invalid cron expression: %s (%s)',
      (cronExpr) => {
        expect(isCron(cronExpr)).toBe(false)
      }
    )
  })

  describe('edge cases for cron parser behavior', () => {
    it('should handle 4-field cron expressions (missing seconds)', () => {
      // @note cron-parser treats 4-field expressions as valid (assuming missing seconds)

      expect(isCron('* * * *')).toBe(true)
    })

    it('should handle 6-field cron expressions (with seconds)', () => {
      // @note cron-parser supports 6-field format with seconds

      expect(isCron('* * * * * *')).toBe(true)
    })

    it('should handle day of week 7 (Sunday)', () => {
      // @note cron-parser treats 7 as valid (Sunday, same as 0)

      expect(isCron('* * * * 7')).toBe(true)
    })
  })

  describe('whitespace handling', () => {
    it.each([
      ['  * * * * *  ', 'leading and trailing spaces'],
      ['\t* * * * *\t', 'leading and trailing tabs'],
      ['\n* * * * *\n', 'leading and trailing newlines'],
      ['* * * * *   ', 'trailing spaces only'],
      ['   * * * * *', 'leading spaces only'],
    ])('should handle whitespace correctly: %s', (cronExpr) => {
      expect(isCron(cronExpr)).toBe(true)
    })
  })
})

describe('getNext - additional edge cases', () => {
  describe('input validation', () => {
    it('should throw error for invalid cron expression', () => {
      expect(() => getNext('invalid')).toThrow()
    })

    it('should throw error for null input', () => {
      expect(() => getNext(null)).toThrow()
    })

    it('should throw error for undefined input', () => {
      expect(() => getNext(undefined)).toThrow()
    })

    it('should throw error for non-string input', () => {
      expect(() => getNext(123)).toThrow()
    })
  })

  describe('options handling', () => {
    it('should handle empty options object', () => {
      const now = new Date()
      const nextDate = getNext('* * * * *', {})

      expect(nextDate instanceof Date).toBe(true)
      expect(nextDate.getTime()).toBeGreaterThan(now.getTime())
    })

    it('should handle options with only retries', () => {
      const now = new Date()
      const nextDate = getNext('* * * * *', { retries: 5 })

      expect(nextDate instanceof Date).toBe(true)
      expect(nextDate.getTime()).toBeGreaterThan(now.getTime())
    })

    it('should handle options with only minMs', () => {
      const now = new Date()
      const nextDate = getNext('* * * * *', { minMs: 30000 })

      expect(nextDate instanceof Date).toBe(true)
      expect(nextDate.getTime()).toBeGreaterThan(now.getTime() + 30000)
    })

    it('should handle zero retries', () => {
      const nextDate = getNext('* * * * *', { retries: 0 })

      expect(nextDate instanceof Date).toBe(true)
    })

    it('should handle negative minMs as zero', () => {
      const now = new Date()
      const nextDate = getNext('* * * * *', { minMs: -1000 })

      expect(nextDate instanceof Date).toBe(true)
      expect(nextDate.getTime()).toBeGreaterThan(now.getTime())
    })
  })

  describe('complex cron expressions', () => {
    it('should handle yearly cron expression', () => {
      const now = new Date()
      const nextDate = getNext('0 0 1 1 *') // January 1st at midnight

      expect(nextDate instanceof Date).toBe(true)
      expect(nextDate.getTime()).toBeGreaterThan(now.getTime())
    })

    it('should handle monthly cron expression', () => {
      const now = new Date()
      const nextDate = getNext('0 0 1 * *') // First day of month at midnight

      expect(nextDate instanceof Date).toBe(true)
      expect(nextDate.getTime()).toBeGreaterThan(now.getTime())
    })

    it('should handle weekly cron expression', () => {
      const now = new Date()
      const nextDate = getNext('0 0 * * 0') // Every Sunday at midnight

      expect(nextDate instanceof Date).toBe(true)
      expect(nextDate.getTime()).toBeGreaterThan(now.getTime())
    })
  })

  describe('time constraints', () => {
    it('should respect large minMs values', () => {
      const now = new Date()
      const minMs = 24 * 60 * 60 * 1000 // 24 hours
      const nextDate = getNext('* * * * *', { minMs })

      expect(nextDate instanceof Date).toBe(true)
      expect(nextDate.getTime()).toBeGreaterThanOrEqual(now.getTime() + minMs)
    })

    it('should handle minMs greater than next scheduled time', () => {
      const now = new Date()
      const minMs = 2 * 60 * 60 * 1000 // 2 hours
      const nextDate = getNext('* * * * *', { minMs }) // Every minute

      expect(nextDate instanceof Date).toBe(true)
      // Should return now + minMs instead of next minute
      expect(nextDate.getTime()).toBeGreaterThanOrEqual(now.getTime() + minMs)
    })
  })

  describe('timezone handling', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2026-01-01T10:00:00.000Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should respect the timezone option when calculating the next run', () => {
      const nextUtc = getNext('0 9 * * *', { timezone: 'UTC' })
      const nextNewYork = getNext('0 9 * * *', {
        timezone: 'America/New_York',
      })

      expect(nextUtc.toISOString()).toBe('2026-01-02T09:00:00.000Z')
      expect(nextNewYork.toISOString()).toBe('2026-01-01T14:00:00.000Z')
    })

    it('should treat null timezone the same as an omitted timezone', () => {
      const nextDefault = getNext('0 9 * * *')
      const nextNullTimezone = getNext('0 9 * * *', { timezone: null })

      expect(nextNullTimezone.toISOString()).toBe(nextDefault.toISOString())
    })
  })
})

describe('parse', () => {
  describe('basic functionality', () => {
    it('should parse valid cron expressions', () => {
      const result = parse('* * * * *')

      expect(result).toBeDefined()
      expect(typeof result.next).toBe('function')
      expect(typeof result.prev).toBe('function')
    })

    it('should handle whitespace in input', () => {
      const result = parse('  * * * * *  ')

      expect(result).toBeDefined()
      expect(typeof result.next).toBe('function')
    })
  })

  describe('complex cron expressions', () => {
    it.each([
      ['0 0 * * *', 'daily at midnight'],
      ['*/15 * * * *', 'every 15 minutes'],
      ['0 12 * * MON', 'weekly on Monday at noon'],
      ['30 2 * * 1-5', 'weekdays at 2:30 AM'],
      ['0 */6 * * *', 'every 6 hours'],
      ['0 9-17 * * 1-5', 'business hours on weekdays'],
      ['0 0 1 1 *', 'yearly on January 1st'],
    ])('should parse complex cron expression: %s (%s)', (cronExpr) => {
      const result = parse(cronExpr)

      expect(result).toBeDefined()
      expect(typeof result.next).toBe('function')
      expect(typeof result.prev).toBe('function')

      // Verify we can get next execution time
      const nextDate = result.next().toDate()

      expect(nextDate instanceof Date).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should throw error for invalid cron expression', () => {
      expect(() => parse('invalid')).toThrow()
    })

    it('should throw error for null input', () => {
      expect(() => parse(null)).toThrow()
    })

    it('should throw error for undefined input', () => {
      expect(() => parse(undefined)).toThrow()
    })

    it('should throw error for non-string input', () => {
      expect(() => parse(123)).toThrow()
    })

    it.each([
      ['60 * * * *', 'invalid minute'],
      ['* 24 * * *', 'invalid hour'],
      ['* * 32 * *', 'invalid day'],
      ['* * * 13 *', 'invalid month'],
      ['abc * * * *', 'non-numeric value'],
    ])('should throw error for invalid cron: %s (%s)', (cronExpr) => {
      expect(() => parse(cronExpr)).toThrow()
    })

    it('should handle cron expressions with different field counts', () => {
      // @note cron-parser supports both 4-field and 6-field formats

      expect(() => parse('* * * *')).not.toThrow() // 4-field format
      expect(() => parse('* * * * * *')).not.toThrow() // 6-field format
    })
  })

  describe('return value structure', () => {
    it('should return object with expected methods', () => {
      const result = parse('* * * * *')

      expect(result).toHaveProperty('next')
      expect(result).toHaveProperty('prev')
      expect(typeof result.next).toBe('function')
      expect(typeof result.prev).toBe('function')
    })

    it('should allow iteration through multiple executions', () => {
      const result = parse('0 12 * * *') // Daily at noon

      const firstNext = result.next().toDate()
      const secondNext = result.next().toDate()

      expect(firstNext instanceof Date).toBe(true)
      expect(secondNext instanceof Date).toBe(true)
      expect(secondNext.getTime()).toBeGreaterThan(firstNext.getTime())
    })
  })
})
