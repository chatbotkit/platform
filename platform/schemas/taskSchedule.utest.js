import { isSchedule } from '@/lib/task.validation'

import taskScheduleSchema from '@/schemas/taskSchedule'

jest.mock('@/lib/task.validation', () => ({
  isSchedule: jest.fn(),
}))

describe('taskSchedule schema', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should allow null values', () => {
    const result = taskScheduleSchema.validate(null)

    expect(result).toEqual({ value: null })
    expect(isSchedule).not.toHaveBeenCalled() // should not call validation for null
  })

  it('should allow empty string', () => {
    const result = taskScheduleSchema.validate('')

    expect(result).toEqual({ value: '' })
    expect(isSchedule).not.toHaveBeenCalled() // should not call validation for empty string
  })

  it('should validate valid schedule values', () => {
    const validSchedules = [
      'daily',
      'hourly',
      'weekly',
      '0 0 * * *', // daily at midnight cron
      '*/5 * * * *', // every 5 minutes cron
      '2024-12-25T10:00:00Z', // date string
    ]

    validSchedules.forEach((schedule) => {
      isSchedule.mockReturnValue(true)

      const result = taskScheduleSchema.validate(schedule)

      expect(result).toEqual({ value: schedule })
      expect(isSchedule).toHaveBeenCalledWith(schedule)

      jest.clearAllMocks()
    })
  })

  it('should reject invalid schedule values', () => {
    const invalidSchedules = [
      'invalid',
      'DAILY', // wrong case
      'bi-weekly', // not a valid schedule
      '* * * *', // invalid cron
      'invalid-date', // invalid date
    ]

    invalidSchedules.forEach((schedule) => {
      isSchedule.mockReturnValue(false)

      const result = taskScheduleSchema.validate(schedule)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('Invalid schedule')
      expect(isSchedule).toHaveBeenCalledWith(schedule)

      jest.clearAllMocks()
    })
  })

  it('should reject non-string values except null', () => {
    const invalidValues = [123, true, false, [], {}]

    invalidValues.forEach((value) => {
      const result = taskScheduleSchema.validate(value)

      expect(result.error).toBeDefined()
      expect(isSchedule).not.toHaveBeenCalled()
    })
  })

  it('should handle undefined values', () => {
    const result = taskScheduleSchema.validate(undefined)

    if (result.error) {
      expect(result.error).toBeDefined()
      expect(isSchedule).not.toHaveBeenCalled()
    } else {
      expect(isSchedule).not.toHaveBeenCalled()
    }
  })

  it('should handle whitespace strings', () => {
    isSchedule.mockReturnValue(false)

    const result = taskScheduleSchema.validate('   ')

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('Invalid schedule')
    expect(isSchedule).toHaveBeenCalledWith('   ')
  })
})
