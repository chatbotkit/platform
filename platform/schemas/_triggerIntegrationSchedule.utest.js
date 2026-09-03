/**
 * @jest-environment node
 */
import triggerIntegrationScheduleSchema from './triggerIntegrationSchedule'

jest.mock('@/lib/task.validation', () => ({
  isSchedule: jest.fn((value) => {
    const intervals = [
      'never',
      'quarterhourly',
      'halfhourly',
      'hourly',
      'twicedaily',
      'daily',
      'twiceweekly',
      'weekly',
      'twicemonthly',
      'monthly',
    ]

    if (intervals.includes(value)) {
      return true
    }

    // basic cron pattern check (5 whitespace-separated parts)
    const cronParts = value.trim().split(/\s+/)

    if (cronParts.length === 5) {
      return true
    }

    // ISO 8601 date check (must contain T and Z or offset)
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return true
    }

    return false
  }),
}))

describe('triggerIntegrationScheduleSchema', () => {
  describe('interval values', () => {
    it.each([
      'never',
      'quarterhourly',
      'halfhourly',
      'hourly',
      'twicedaily',
      'daily',
      'twiceweekly',
      'weekly',
      'twicemonthly',
      'monthly',
    ])('should accept interval value "%s"', async (value) => {
      await expect(triggerIntegrationScheduleSchema.validateAsync(value)).resolves.toBe(
        value
      )
    })
  })

  describe('cron expressions', () => {
    it.each([
      '0 0 * * *',
      '*/15 * * * *',
      '0 9 * * MON',
      '0 0 1 * *',
      '30 6 * * 1-5',
    ])('should accept cron expression "%s"', async (value) => {
      await expect(triggerIntegrationScheduleSchema.validateAsync(value)).resolves.toBe(
        value
      )
    })
  })

  describe('null and empty values', () => {
    it('should accept null', async () => {
      await expect(
        triggerIntegrationScheduleSchema.validateAsync(null)
      ).resolves.toBeNull()
    })

    it('should accept undefined', async () => {
      await expect(
        triggerIntegrationScheduleSchema.validateAsync(undefined)
      ).resolves.toBeUndefined()
    })
  })

  describe('invalid values', () => {
    it('should reject arbitrary invalid string', async () => {
      await expect(
        triggerIntegrationScheduleSchema.validateAsync('invalid-schedule')
      ).rejects.toThrow()
    })

    it('should reject numeric string', async () => {
      await expect(
        triggerIntegrationScheduleSchema.validateAsync('1234')
      ).rejects.toThrow()
    })

    it('should allow empty string (treated as no schedule)', async () => {
      await expect(triggerIntegrationScheduleSchema.validateAsync('')).resolves.toBe('')
    })
  })
})
