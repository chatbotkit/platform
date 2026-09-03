import {
  isCron,
  isDate,
  isInterval,
  isSchedule,
  isTime,
} from './task.validation'

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

describe('isInterval', () => {
  it('should return true for valid interval schedule', () => {
    expect(isInterval('daily')).toBe(true)
    expect(isInterval('weekly')).toBe(true)
  })

  it('should return false for invalid interval schedule', () => {
    expect(isInterval('century')).toBe(false)
    expect(isInterval('')).toBe(false)
    expect(isInterval(null)).toBe(false)
  })
})

describe('isCron', () => {
  it('should return true if schedule is a valid cron expression', () => {
    const cronExpr = '*/5 * * * *'

    expect(isCron(cronExpr)).toBe(true)
  })

  it('should return false if schedule is empty or not a valid cron expression', () => {
    expect(isCron('')).toBe(false)
    expect(isCron('invalid cron')).toBe(false)
  })
})

describe('isDate', () => {
  it('should return true if schedule is a valid date expression', () => {
    const dateExpr = '2021-01-01'

    expect(isDate(dateExpr)).toBe(true)
  })

  it('should return false if schedule is empty or not a valid date expression', () => {
    expect(isDate('')).toBe(false)
    expect(isDate('bad date')).toBe(false)
  })

  it('should return false for bare year/number strings that JavaScript Date() parses permissively', () => {
    // new Date("1970") and new Date("2025") are valid JS dates but are NOT
    // valid schedule date expressions - they lack month/day components and
    // would silently create tasks that never run (getNext returns null for
    // past dates) or behave unexpectedly.
    expect(isDate('1970')).toBe(false)
    expect(isDate('2025')).toBe(false)
    expect(isDate('8')).toBe(false)
    expect(isDate('100')).toBe(false)
  })
})

describe('isTime', () => {
  it('should return true if schedule is a valid local time expression', () => {
    expect(isTime('16:45')).toBe(true)
    expect(isTime('00:00')).toBe(true)
    expect(isTime('23:59')).toBe(true)
  })

  it('should return false if schedule is not a valid local time expression', () => {
    expect(isTime('24:00')).toBe(false)
    expect(isTime('9:00')).toBe(false)
    expect(isTime('16:60')).toBe(false)
  })
})

describe('isSchedule', () => {
  it('should return true if schedule is a valid interval', () => {
    expect(isSchedule('daily')).toBe(true)
  })

  it('should return true if schedule is a valid cron expression', () => {
    expect(isSchedule('*/5 * * * *')).toBe(true)
  })

  it('should return true if schedule is a valid date', () => {
    expect(isSchedule('2021-01-01')).toBe(true)
  })

  it('should return true if schedule is a valid local time expression', () => {
    expect(isSchedule('16:45')).toBe(true)
  })

  it('should return false if schedule is none of the valid formats', () => {
    expect(isSchedule('invalid schedule')).toBe(false)
  })
})
