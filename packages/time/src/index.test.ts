import {
  ONE_DAY_IN_MILLISECONDS,
  ONE_HOUR_IN_MILLISECONDS,
  ONE_MINUTE_IN_MILLISECONDS,
  ONE_WEEK_IN_MILLISECONDS,
  clampDate,
  getStartOfMonth,
  getStartOfNextDay,
  getStartOfNextMonth,
  getStartOfNextWeek,
  getStartOfPreviousMonth,
  getStartOfQuarter,
  getTimezone,
  getYYYYMMDD,
  isDate,
  isDateString,
  maxDate,
  minDate,
  parseDuration,
  timeAgo,
  timePlusDays,
} from './index'

describe('timeAgo', () => {
  it('should return "now" for the current date', () => {
    const date = new Date()
    const result = timeAgo(date)

    expect(result).toBe('now')
  })

  it('should return "yesterday" for yesterday', () => {
    const date = new Date()

    date.setDate(date.getDate() - 1)

    const result = timeAgo(date)

    expect(result).toBe('yesterday')
  })

  it('should return "2 days ago" for 2 days ago', () => {
    const date = new Date()

    date.setDate(date.getDate() - 2)

    const result = timeAgo(date)

    expect(result).toBe('2 days ago')
  })

  it('should return "last week" for 7 days ago', () => {
    const date = new Date()

    date.setDate(date.getDate() - 7)

    const result = timeAgo(date)

    expect(result).toBe('last week')
  })

  it('should return "2 weeks ago" for 14 days ago', () => {
    const date = new Date()

    date.setDate(date.getDate() - 14)

    const result = timeAgo(date)

    expect(result).toBe('2 weeks ago')
  })

  it('should return "last month" for 40 days ago', () => {
    const date = new Date()

    date.setDate(date.getDate() - 40)

    const result = timeAgo(date)

    expect(result).toBe('last month')
  })

  it('should return "2 months ago" for 80 days ago', () => {
    const date = new Date()

    date.setDate(date.getDate() - 80)

    const result = timeAgo(date)

    expect(result).toBe('2 months ago')
  })

  it('should return "tomorrow" for tomorrow', () => {
    const date = new Date()

    date.setDate(date.getDate() + 1)
    date.setHours(Math.min(23, date.getHours() + 3))

    const result = timeAgo(date)

    expect(result).toMatch(/tomorrow|in 23 hours/)
  })

  it('should return "in 2 days" for 2.3 days from now', () => {
    const date = new Date()

    date.setDate(date.getDate() + 2)
    date.setHours(Math.min(23, date.getHours() + 3))

    const result = timeAgo(date)

    expect(result).toBe('in 2 days')
  })
})

describe('timePlusDays', () => {
  it('should add integer number of days to the current date', () => {
    const date = new Date(2022, 0, 1) // January 1, 2022
    const result = timePlusDays(5, date)

    expect(result.getDate()).toBe(6) // January 6, 2022
  })

  it('should add fractional number of days to the current date', () => {
    const date = new Date(2022, 0, 1, 0, 0, 0, 0) // January 1, 2022, 00:00:00.000
    const result = timePlusDays(1.5, date)

    expect(result.getDate()).toBe(2) // January 2, 2022
    expect(result.getHours()).toBe(12) // 12:00:00.000
  })

  it('should handle negative number of days', () => {
    const date = new Date(2022, 0, 5) // January 5, 2022
    const result = timePlusDays(-3, date)

    expect(result.getDate()).toBe(2) // January 2, 2022
  })

  it('should handle zero days', () => {
    const date = new Date(2022, 0, 1) // January 1, 2022
    const result = timePlusDays(0, date)

    expect(result.getDate()).toBe(1) // January 1, 2022
  })
})

describe('getStartOfMonth', () => {
  it('must return correct date', () => {
    expect(
      getStartOfMonth('2023-02-06T12:12:00.000Z')
        .toISOString()
        .startsWith('2023-02-01')
    ).toBeTruthy()
    expect(
      getStartOfMonth('2023-02-28T12:12:00.000Z')
        .toISOString()
        .startsWith('2023-02-01')
    ).toBeTruthy()
  })
})

describe('getStartOfNextMonth', () => {
  it('must return correct date', () => {
    expect(
      getStartOfNextMonth('2023-02-02T12:12:00.000Z')
        .toISOString()
        .startsWith('2023-03-01')
    ).toBeTruthy()
    expect(
      getStartOfNextMonth('2023-02-28T12:12:00.000Z')
        .toISOString()
        .startsWith('2023-03-01')
    ).toBeTruthy()
  })

  it('must not overflow when current day exceeds target month length', () => {
    expect(
      getStartOfNextMonth('2023-01-31T12:00:00.000Z')
        .toISOString()
        .startsWith('2023-02-01')
    ).toBeTruthy()
    expect(
      getStartOfNextMonth('2023-03-31T12:00:00.000Z')
        .toISOString()
        .startsWith('2023-04-01')
    ).toBeTruthy()
  })
})

describe('getStartOfPreviousMonth', () => {
  it('must return correct date', () => {
    expect(
      getStartOfPreviousMonth('2023-03-15T12:12:00.000Z')
        .toISOString()
        .startsWith('2023-02-01')
    ).toBeTruthy()
  })

  it('must not overflow when current day exceeds target month length', () => {
    expect(
      getStartOfPreviousMonth('2023-03-30T12:00:00.000Z')
        .toISOString()
        .startsWith('2023-02-01')
    ).toBeTruthy()
    expect(
      getStartOfPreviousMonth('2023-03-31T12:00:00.000Z')
        .toISOString()
        .startsWith('2023-02-01')
    ).toBeTruthy()
  })
})

describe('getStartOfQuarter', () => {
  it('must return correct date for Q1', () => {
    expect(
      getStartOfQuarter('2023-02-15T12:12:00.000Z')
        .toISOString()
        .startsWith('2023-01-01')
    ).toBeTruthy()
  })

  it('must return correct date for Q2', () => {
    expect(
      getStartOfQuarter('2023-05-15T12:12:00.000Z')
        .toISOString()
        .startsWith('2023-04-01')
    ).toBeTruthy()
  })

  it('must return correct date for Q3', () => {
    expect(
      getStartOfQuarter('2023-08-15T12:12:00.000Z')
        .toISOString()
        .startsWith('2023-07-01')
    ).toBeTruthy()
  })

  it('must return correct date for Q4', () => {
    expect(
      getStartOfQuarter('2023-11-15T12:12:00.000Z')
        .toISOString()
        .startsWith('2023-10-01')
    ).toBeTruthy()
  })
})

describe('getStartOfNextDay', () => {
  it('must return correct date', () => {
    expect(
      getStartOfNextDay('2023-02-28T12:12:00.000Z')
        .toISOString()
        .startsWith('2023-03-01')
    ).toBeTruthy()
  })
})

describe('getStartOfNextWeek', () => {
  it('must return correct date', () => {
    expect(
      getStartOfNextWeek('2023-02-06T12:12:00.000Z')
        .toISOString()
        .startsWith('2023-02-13')
    ).toBeTruthy()
    expect(
      getStartOfNextWeek('2023-02-28T12:12:00.000Z')
        .toISOString()
        .startsWith('2023-03-06')
    ).toBeTruthy()
  })
})

describe('getYYYYMMDD', () => {
  it('must return correct date', () => {
    expect(getYYYYMMDD('2023-02-06T12:12:00.000Z')).toEqual('2023-02-06')
    expect(getYYYYMMDD('2023-02-28T12:12:00.000Z')).toEqual('2023-02-28')
  })
})

describe('isDate', () => {
  it('should return true for valid date', () => {
    expect(isDate('2023-02-06T12:12:00.000Z')).toBeTruthy()
  })

  it('should return false for invalid date', () => {
    expect(isDate('not a date')).toBeFalsy()
  })
})

describe('isDateString', () => {
  it('should return true for valid date string', () => {
    expect(isDateString('2023-02-06T12:12:00.000Z')).toBeTruthy()
  })

  it('should return false for invalid date string', () => {
    expect(isDateString('not a date')).toBeFalsy()
  })

  it('should return false if a string number is passed', () => {
    expect(isDateString('1234567890')).toBeFalsy()
  })
})

describe('getTimezone', () => {
  it('should return the provided valid timezone', () => {
    expect(getTimezone('America/New_York')).toBe('America/New_York')
    expect(getTimezone('Europe/London')).toBe('Europe/London')
    expect(getTimezone('Asia/Tokyo')).toBe('Asia/Tokyo')
  })

  it('should return UTC for null input', () => {
    expect(getTimezone(null)).toBe('UTC')
  })

  it('should return UTC for undefined input', () => {
    expect(getTimezone(undefined)).toBe('UTC')
    expect(getTimezone()).toBe('UTC')
  })

  it('should return UTC for invalid timezone', () => {
    expect(getTimezone('Invalid/Timezone')).toBe('UTC')
    expect(getTimezone('Not_Real')).toBe('UTC')
  })
})

describe('minDate', () => {
  it('should return the earliest date from multiple dates', () => {
    const date1 = new Date('2023-01-01')
    const date2 = new Date('2024-01-01')
    const date3 = new Date('2022-01-01')

    const result = minDate(date1, date2, date3)

    expect(result?.toISOString()).toBe(date3.toISOString())
  })

  it('should handle Date objects, timestamps, and ISO strings', () => {
    const dateObj = new Date('2023-06-15')
    const timestamp = new Date('2023-01-01').getTime()
    const isoString = '2024-01-01'

    const result = minDate(dateObj, timestamp, isoString)

    expect(result?.toISOString()).toBe(new Date(timestamp).toISOString())
  })

  it('should filter out null and undefined values', () => {
    const date1 = new Date('2023-01-01')
    const date2 = new Date('2024-01-01')

    const result = minDate(date1, null, undefined, date2)

    expect(result?.toISOString()).toBe(date1.toISOString())
  })

  it('should return undefined when no valid dates provided', () => {
    expect(minDate()).toBeUndefined()
    expect(minDate(null, undefined)).toBeUndefined()
  })

  it('should handle single date', () => {
    const date = new Date('2023-01-01')
    const result = minDate(date)

    expect(result?.toISOString()).toBe(date.toISOString())
  })

  it('should filter out invalid date strings', () => {
    const date1 = new Date('2023-01-01')
    const date2 = new Date('2024-01-01')

    const result = minDate(date1, 'invalid-date', date2)

    expect(result?.toISOString()).toBe(date1.toISOString())
  })
})

describe('maxDate', () => {
  it('should return the latest date from multiple dates', () => {
    const date1 = new Date('2023-01-01')
    const date2 = new Date('2024-01-01')
    const date3 = new Date('2022-01-01')

    const result = maxDate(date1, date2, date3)

    expect(result?.toISOString()).toBe(date2.toISOString())
  })

  it('should handle Date objects, timestamps, and ISO strings', () => {
    const dateObj = new Date('2023-06-15')
    const timestamp = new Date('2023-01-01').getTime()
    const isoString = '2024-01-01'

    const result = maxDate(dateObj, timestamp, isoString)

    expect(result?.toISOString()).toBe(new Date(isoString).toISOString())
  })

  it('should filter out null and undefined values', () => {
    const date1 = new Date('2023-01-01')
    const date2 = new Date('2024-01-01')

    const result = maxDate(date1, null, undefined, date2)

    expect(result?.toISOString()).toBe(date2.toISOString())
  })

  it('should return undefined when no valid dates provided', () => {
    expect(maxDate()).toBeUndefined()
    expect(maxDate(null, undefined)).toBeUndefined()
  })

  it('should handle single date', () => {
    const date = new Date('2023-01-01')
    const result = maxDate(date)

    expect(result?.toISOString()).toBe(date.toISOString())
  })

  it('should filter out invalid date strings', () => {
    const date1 = new Date('2023-01-01')
    const date2 = new Date('2024-01-01')

    const result = maxDate(date1, 'invalid-date', date2)

    expect(result?.toISOString()).toBe(date2.toISOString())
  })
})

describe('clampDate', () => {
  it('should return the date unchanged when within range', () => {
    const date = new Date('2023-06-15')
    const min = new Date('2023-01-01')
    const max = new Date('2023-12-31')

    const result = clampDate(date, min, max)

    expect(result.toISOString()).toBe(date.toISOString())
  })

  it('should clamp to min when date is before minimum', () => {
    const date = new Date('2022-06-15')
    const min = new Date('2023-01-01')
    const max = new Date('2023-12-31')

    const result = clampDate(date, min, max)

    expect(result.toISOString()).toBe(min.toISOString())
  })

  it('should clamp to max when date is after maximum', () => {
    const date = new Date('2024-06-15')
    const min = new Date('2023-01-01')
    const max = new Date('2023-12-31')

    const result = clampDate(date, min, max)

    expect(result.toISOString()).toBe(max.toISOString())
  })

  it('should work with only minimum constraint', () => {
    const date1 = new Date('2022-06-15')
    const date2 = new Date('2024-06-15')
    const min = new Date('2023-01-01')

    expect(clampDate(date1, min).toISOString()).toBe(min.toISOString())
    expect(clampDate(date2, min).toISOString()).toBe(date2.toISOString())
  })

  it('should work with only maximum constraint', () => {
    const date1 = new Date('2022-06-15')
    const date2 = new Date('2024-06-15')
    const max = new Date('2023-12-31')

    expect(clampDate(date1, null, max).toISOString()).toBe(date1.toISOString())
    expect(clampDate(date2, null, max).toISOString()).toBe(max.toISOString())
  })

  it('should work without any constraints', () => {
    const date = new Date('2023-06-15')

    const result = clampDate(date)

    expect(result.toISOString()).toBe(date.toISOString())
  })

  it('should handle timestamps and ISO strings', () => {
    const timestamp = new Date('2024-06-15').getTime()
    const min = '2023-01-01'
    const max = '2023-12-31'

    const result = clampDate(timestamp, min, max)

    expect(result.toISOString()).toBe(new Date(max).toISOString())
  })

  it('should handle null constraints', () => {
    const date = new Date('2023-06-15')

    const result = clampDate(date, null, null)

    expect(result.toISOString()).toBe(date.toISOString())
  })
})

describe('parseDuration', () => {
  it('returns numbers as-is (milliseconds)', () => {
    expect(parseDuration(5000)).toBe(5000)
    expect(parseDuration(0)).toBe(0)
  })

  it('parses a bare numeric string as milliseconds', () => {
    expect(parseDuration('3600000')).toBe(ONE_HOUR_IN_MILLISECONDS)
  })

  it('parses single units in long and short form', () => {
    expect(parseDuration('1 day')).toBe(ONE_DAY_IN_MILLISECONDS)
    expect(parseDuration('1d')).toBe(ONE_DAY_IN_MILLISECONDS)
    expect(parseDuration('30 minutes')).toBe(30 * ONE_MINUTE_IN_MILLISECONDS)
    expect(parseDuration('15m')).toBe(15 * ONE_MINUTE_IN_MILLISECONDS)
    expect(parseDuration('2h')).toBe(2 * ONE_HOUR_IN_MILLISECONDS)
    expect(parseDuration('1 week')).toBe(ONE_WEEK_IN_MILLISECONDS)
  })

  it('treats m as minutes and mo as months', () => {
    expect(parseDuration('5m')).toBe(5 * ONE_MINUTE_IN_MILLISECONDS)
    expect(parseDuration('1mo')).toBeGreaterThan(ONE_WEEK_IN_MILLISECONDS)
  })

  it('parses fractional and compound durations', () => {
    expect(parseDuration('1.5h')).toBe(1.5 * ONE_HOUR_IN_MILLISECONDS)
    expect(parseDuration('1 day, 2 hours')).toBe(
      ONE_DAY_IN_MILLISECONDS + 2 * ONE_HOUR_IN_MILLISECONDS
    )
    expect(parseDuration('1 day and 30 minutes')).toBe(
      ONE_DAY_IN_MILLISECONDS + 30 * ONE_MINUTE_IN_MILLISECONDS
    )
  })

  it('is case and whitespace insensitive', () => {
    expect(parseDuration('  1 DAY  ')).toBe(ONE_DAY_IN_MILLISECONDS)
  })

  it('returns null for unparseable input', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('soon')).toBeNull()
    expect(parseDuration('1 fortnight')).toBeNull()
    expect(parseDuration('1 day of fun')).toBeNull()
  })
})
