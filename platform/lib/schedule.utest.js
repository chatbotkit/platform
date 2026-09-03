import {
  HALF_HOUR_IN_MILLISECONDS,
  ONE_DAY_IN_MILLISECONDS,
  ONE_HOUR_IN_MILLISECONDS,
  ONE_MONTH_IN_MILLISECONDS,
  ONE_WEEK_IN_MILLISECONDS,
  QUARTER_HOUR_IN_MILLISECONDS,
} from '@chatbotkit-dev/time'

import { Schedule } from '@/prisma/types'

import { syncScheduleToMilliseconds } from '@/lib/schedule'

jest.mock('@/prisma/types', () => ({
  Schedule: {
    never: 'never',
    quarterhourly: 'quarterhourly',
    halfhourly: 'halfhourly',
    hourly: 'hourly',
    twicedaily: 'twicedaily',
    daily: 'daily',
    twiceweekly: 'twiceweekly',
    weekly: 'weekly',
    twicemonthly: 'twicemonthly',
    monthly: 'monthly',
  },
}))

describe('syncScheduleToMilliseconds', () => {
  describe('basic schedule conversions', () => {
    it('should return 0 for never schedule', () => {
      const result = syncScheduleToMilliseconds(Schedule.never)

      expect(result).toBe(0)
    })

    it('should return quarter hour in milliseconds for quarterhourly', () => {
      const result = syncScheduleToMilliseconds(Schedule.quarterhourly)

      expect(result).toBe(QUARTER_HOUR_IN_MILLISECONDS)
      expect(result).toBe(15 * 60 * 1000) // 15 minutes
    })

    it('should return half hour in milliseconds for halfhourly', () => {
      const result = syncScheduleToMilliseconds(Schedule.halfhourly)

      expect(result).toBe(HALF_HOUR_IN_MILLISECONDS)
      expect(result).toBe(30 * 60 * 1000) // 30 minutes
    })

    it('should return hour plus quarter hour for hourly schedule', () => {
      const result = syncScheduleToMilliseconds(Schedule.hourly)

      expect(result).toBe(
        ONE_HOUR_IN_MILLISECONDS + QUARTER_HOUR_IN_MILLISECONDS
      )
      expect(result).toBe(75 * 60 * 1000) // 1 hour 15 minutes
    })

    it('should return day plus quarter hour for daily schedule', () => {
      const result = syncScheduleToMilliseconds(Schedule.daily)

      expect(result).toBe(
        ONE_DAY_IN_MILLISECONDS + QUARTER_HOUR_IN_MILLISECONDS
      )
      expect(result).toBe(24 * 60 * 60 * 1000 + 15 * 60 * 1000) // 24 hours 15 minutes
    })

    it('should return week plus quarter hour for weekly schedule', () => {
      const result = syncScheduleToMilliseconds(Schedule.weekly)

      expect(result).toBe(
        ONE_WEEK_IN_MILLISECONDS + QUARTER_HOUR_IN_MILLISECONDS
      )
      expect(result).toBe(7 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000) // 7 days 15 minutes
    })

    it('should return month plus quarter hour for monthly schedule', () => {
      const result = syncScheduleToMilliseconds(Schedule.monthly)

      expect(result).toBe(
        ONE_MONTH_IN_MILLISECONDS + QUARTER_HOUR_IN_MILLISECONDS
      )
      // ONE_MONTH_IN_MILLISECONDS is approximately 30.416 days (average month length)
      expect(result).toBeGreaterThan(30 * 24 * 60 * 60 * 1000) // More than 30 days
    })
  })

  describe('schedule value verification', () => {
    it('should return consistent millisecond values', () => {
      // Verify the pattern: longer schedules have +15 minutes buffer
      expect(syncScheduleToMilliseconds(Schedule.quarterhourly)).toBe(
        15 * 60 * 1000
      )
      expect(syncScheduleToMilliseconds(Schedule.halfhourly)).toBe(
        30 * 60 * 1000
      )

      // These have the +15 minute buffer
      const quarterHourBuffer = 15 * 60 * 1000

      expect(syncScheduleToMilliseconds(Schedule.hourly)).toBe(
        60 * 60 * 1000 + quarterHourBuffer
      )
      expect(syncScheduleToMilliseconds(Schedule.daily)).toBe(
        24 * 60 * 60 * 1000 + quarterHourBuffer
      )
      expect(syncScheduleToMilliseconds(Schedule.weekly)).toBe(
        7 * 24 * 60 * 60 * 1000 + quarterHourBuffer
      )
      // Monthly uses ONE_MONTH_IN_MILLISECONDS which is average month length (~30.416 days)
      expect(syncScheduleToMilliseconds(Schedule.monthly)).toBe(
        ONE_MONTH_IN_MILLISECONDS + quarterHourBuffer
      )
    })

    it('should return positive numbers for all non-never schedules', () => {
      expect(
        syncScheduleToMilliseconds(Schedule.quarterhourly)
      ).toBeGreaterThan(0)
      expect(syncScheduleToMilliseconds(Schedule.halfhourly)).toBeGreaterThan(0)
      expect(syncScheduleToMilliseconds(Schedule.hourly)).toBeGreaterThan(0)
      expect(syncScheduleToMilliseconds(Schedule.daily)).toBeGreaterThan(0)
      expect(syncScheduleToMilliseconds(Schedule.weekly)).toBeGreaterThan(0)
      expect(syncScheduleToMilliseconds(Schedule.monthly)).toBeGreaterThan(0)
    })
  })

  describe('schedule ordering', () => {
    it('should return increasing values for longer schedules', () => {
      const never = syncScheduleToMilliseconds(Schedule.never)
      const quarterhourly = syncScheduleToMilliseconds(Schedule.quarterhourly)
      const halfhourly = syncScheduleToMilliseconds(Schedule.halfhourly)
      const hourly = syncScheduleToMilliseconds(Schedule.hourly)
      const daily = syncScheduleToMilliseconds(Schedule.daily)
      const weekly = syncScheduleToMilliseconds(Schedule.weekly)
      const monthly = syncScheduleToMilliseconds(Schedule.monthly)

      expect(never).toBe(0)
      expect(quarterhourly).toBeGreaterThan(never)
      expect(halfhourly).toBeGreaterThan(quarterhourly)
      expect(hourly).toBeGreaterThan(halfhourly)
      expect(daily).toBeGreaterThan(hourly)
      expect(weekly).toBeGreaterThan(daily)
      expect(monthly).toBeGreaterThan(weekly)
    })
  })

  describe('error handling', () => {
    it('should throw for invalid schedule value', () => {
      // @ts-expect-error - testing invalid input
      expect(() => syncScheduleToMilliseconds('invalid')).toThrow()
    })

    it('should throw for undefined schedule', () => {
      // @ts-expect-error - testing invalid input
      expect(() => syncScheduleToMilliseconds(undefined)).toThrow()
    })

    it('should throw for null schedule', () => {
      // @ts-expect-error - testing invalid input
      expect(() => syncScheduleToMilliseconds(null)).toThrow()
    })
  })
})
