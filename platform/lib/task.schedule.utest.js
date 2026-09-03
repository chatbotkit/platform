/* eslint-disable @typescript-eslint/no-require-imports */
import {
  HALF_HOUR_IN_MILLISECONDS,
  ONE_DAY_IN_MILLISECONDS,
  ONE_HOUR_IN_MILLISECONDS,
  ONE_MONTH_IN_MILLISECONDS,
  ONE_WEEK_IN_MILLISECONDS,
  QUARTER_HOUR_IN_MILLISECONDS,
} from '@chatbotkit-dev/time'

import { getNext } from './task.schedule'

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

const { Schedule } = require('@/prisma/types')

describe('getNext', () => {
  describe('Schedule enum values', () => {
    test('returns null for Schedule.never', () => {
      const nextDate = getNext(Schedule.never)

      expect(nextDate).toBeNull()
    })

    test('returns next run Date for Schedule.quarterhourly (~15 min)', () => {
      const now = Date.now()
      const nextDate = getNext(Schedule.quarterhourly)
      const diff = nextDate.getTime() - now

      expect(Math.abs(diff - QUARTER_HOUR_IN_MILLISECONDS)).toBeLessThan(100)
    })

    test('returns next run Date for Schedule.halfhourly (~30 min)', () => {
      const now = Date.now()
      const nextDate = getNext(Schedule.halfhourly)
      const diff = nextDate.getTime() - now

      expect(Math.abs(diff - HALF_HOUR_IN_MILLISECONDS)).toBeLessThan(100)
    })

    test('returns next run Date for Schedule enum (hourly)', () => {
      const schedule = Schedule.hourly
      const now = Date.now()
      const nextDate = getNext(schedule)
      const diff = nextDate.getTime() - now

      expect(Math.abs(diff - ONE_HOUR_IN_MILLISECONDS)).toBeLessThan(100)
    })

    test('returns next run Date for Schedule.daily (~24 h)', () => {
      const now = Date.now()
      const nextDate = getNext(Schedule.daily)
      const diff = nextDate.getTime() - now

      expect(Math.abs(diff - ONE_DAY_IN_MILLISECONDS)).toBeLessThan(100)
    })

    test('returns next run Date for Schedule.twicedaily (~12 h)', () => {
      const now = Date.now()
      const nextDate = getNext(Schedule.twicedaily)
      const diff = nextDate.getTime() - now

      expect(Math.abs(diff - ONE_DAY_IN_MILLISECONDS / 2)).toBeLessThan(100)
    })

    test('returns next run Date for Schedule.weekly (~7 days)', () => {
      const now = Date.now()
      const nextDate = getNext(Schedule.weekly)
      const diff = nextDate.getTime() - now

      expect(Math.abs(diff - ONE_WEEK_IN_MILLISECONDS)).toBeLessThan(100)
    })

    test('returns next run Date for Schedule.twiceweekly (~3.5 days)', () => {
      const now = Date.now()
      const nextDate = getNext(Schedule.twiceweekly)
      const diff = nextDate.getTime() - now

      expect(Math.abs(diff - ONE_WEEK_IN_MILLISECONDS / 2)).toBeLessThan(100)
    })

    test('returns next run Date for Schedule.monthly (~30 days)', () => {
      const now = Date.now()
      const nextDate = getNext(Schedule.monthly)
      const diff = nextDate.getTime() - now

      expect(Math.abs(diff - ONE_MONTH_IN_MILLISECONDS)).toBeLessThan(100)
    })

    test('returns next run Date for Schedule.twicemonthly (~15 days)', () => {
      const now = Date.now()
      const nextDate = getNext(Schedule.twicemonthly)
      const diff = nextDate.getTime() - now

      expect(Math.abs(diff - ONE_MONTH_IN_MILLISECONDS / 2)).toBeLessThan(100)
    })
  })

  test('returns next run Date for cron schedule', () => {
    const schedule = '*/5 * * * *'
    const nextDate = getNext(schedule)

    expect(nextDate).toBeInstanceOf(Date)
    expect(isNaN(nextDate.getTime())).toBe(false)
    expect(nextDate.getTime()).toBeGreaterThan(Date.now())

    const nextMinutes = nextDate.getUTCMinutes()

    expect(nextMinutes % 5).toBe(0)

    const diff = nextDate.getTime() - Date.now()

    expect(diff).toBeGreaterThan(0)
    expect(diff).toBeLessThanOrEqual(5 * 60 * 1000)
  })

  test('returns next run Date for cron schedule in timezone', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T20:00:00.000Z'))

    try {
      expect(getNext('0 9 * * *', { timezone: 'UTC' })).toEqual(
        new Date('2026-01-02T09:00:00.000Z')
      )
      expect(getNext('0 9 * * *', { timezone: 'America/New_York' })).toEqual(
        new Date('2026-01-02T14:00:00.000Z')
      )
    } finally {
      jest.useRealTimers()
    }
  })

  test('returns next run Date for local time schedule in timezone', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T20:00:00.000Z'))

    try {
      expect(getNext('16:45', { timezone: 'UTC' })).toEqual(
        new Date('2026-01-02T16:45:00.000Z')
      )
      expect(getNext('16:45', { timezone: 'America/New_York' })).toEqual(
        new Date('2026-01-01T21:45:00.000Z')
      )
    } finally {
      jest.useRealTimers()
    }
  })

  test('returns next run Date for a valid date string', () => {
    // @note using a date far in the future to avoid flakiness
    const futureDate = new Date(Date.now() + ONE_DAY_IN_MILLISECONDS * 365)
    const schedule = futureDate.toISOString()
    const nextDate = getNext(schedule)

    expect(nextDate).toEqual(new Date(schedule))
  })

  test('returns null for a date in the past', () => {
    // @note past dates should not be valid schedules - tasks would never run
    const pastDate = new Date(Date.now() - ONE_DAY_IN_MILLISECONDS)
    const schedule = pastDate.toISOString()
    const nextDate = getNext(schedule)

    expect(nextDate).toBeNull()
  })

  test('returns null for unknown schedule', () => {
    const schedule = 'invalid-schedule'
    const nextDate = getNext(schedule)

    expect(nextDate).toBeNull()
  })

  test('returns null for empty string', () => {
    expect(getNext('')).toBeNull()
  })
})
