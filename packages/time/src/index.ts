export const ONE_MINUTE_IN_MILLISECONDS = 60000
export const FIVE_MINUTE_IN_MILLISECONDS = 300000
export const TEN_MINUTES_IN_MILLISECONDS = 600000
export const QUARTER_HOUR_IN_MILLISECONDS = 900000
export const HALF_HOUR_IN_MILLISECONDS = 1.8e6
export const ONE_HOUR_IN_MILLISECONDS = 3.6e6
export const ONE_DAY_IN_MILLISECONDS = 8.64e7
export const ONE_WEEK_IN_MILLISECONDS = 6.048e8
export const ONE_MONTH_IN_MILLISECONDS = 2.628e9
export const THREE_MONTHS_IN_MILLISECONDS = 7.884e9
export const ONE_YEAR_IN_MILLISECONDS = 3.154e10

export const ONE_MINUTE_IN_SECONDS = 60
export const FIVE_MINUTE_IN_SECONDS = 300
export const TEN_MINUTES_IN_SECONDS = 600
export const QUARTER_HOUR_IN_SECONDS = 900
export const HALF_HOUR_IN_SECONDS = 1800
export const ONE_HOUR_IN_SECONDS = 3600
export const ONE_DAY_IN_SECONDS = 86400
export const ONE_WEEK_IN_SECONDS = 604800
export const ONE_MONTH_IN_SECONDS = 2.628e6
export const THREE_MONTHS_IN_SECONDS = 7.884e6
export const ONE_YEAR_IN_SECONDS = 3.154e7

export const ONE_MINUTE_IN_DAYS = 0.000694444
export const FIVE_MINUTE_IN_DAYS = 0.00347222
export const TEN_MINUTES_IN_DAYS = 0.00694444
export const QUARTER_HOUR_IN_DAYS = 0.0104167
export const HALF_HOUR_IN_DAYS = 0.0208333
export const ONE_HOUR_IN_DAYS = 0.0416667
export const ONE_DAY_IN_DAYS = 1
export const ONE_WEEK_IN_DAYS = 7
export const ONE_MONTH_IN_DAYS = 30.4167
export const THREE_MONTHS_IN_DAYS = 91.25
export const ONE_YEAR_IN_DAYS = 365.25

export const DAYS_SINCE_EPOCH = Math.round(Date.now() / ONE_DAY_IN_MILLISECONDS)

export const DISTANT_FUTURE = new Date('9999-12-31T23:59:59.999Z')

export function getStartOfYear(
  date: Date | number | string | undefined = new Date()
): Date {
  const d = new Date(date)

  d.setMonth(0, 1)
  d.setHours(0, 0, 0, 0)

  return d
}

export function getStartOfNextYear(
  date: Date | number | string | undefined = new Date()
): Date {
  const d = new Date(date)

  d.setFullYear(d.getFullYear() + 1)
  d.setMonth(0, 1)
  d.setHours(0, 0, 0, 0)

  return d
}

export function getStartOfMonth(
  date: Date | number | string | undefined = new Date()
): Date {
  const d = new Date(date)

  d.setDate(1)
  d.setHours(0, 0, 0, 0)

  return d
}

export function getStartOfNextMonth(
  date: Date | number | string | undefined = new Date()
): Date {
  const d = new Date(date)

  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  d.setHours(0, 0, 0, 0)

  return d
}

export function getStartOfPreviousMonth(
  date: Date | number | string | undefined = new Date()
): Date {
  const d = new Date(date)

  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  d.setHours(0, 0, 0, 0)

  return d
}

export function getStartOfQuarter(
  date: Date | number | string | undefined = new Date()
): Date {
  const d = new Date(date)

  const quarter = Math.floor(d.getMonth() / 3)

  d.setMonth(quarter * 3, 1)
  d.setHours(0, 0, 0, 0)

  return d
}

export function getStartOfWeek(
  date: Date | number | string | undefined = new Date()
): Date {
  const d = new Date(date)

  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // @note adjust when day is sunday

  d.setDate(diff)
  d.setHours(0, 0, 0, 0)

  return d
}

export function getStartOfNextWeek(
  date: Date | number | string | undefined = new Date()
): Date {
  const d = new Date(date)

  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // @note adjust when day is sunday

  d.setDate(diff + 7)
  d.setHours(0, 0, 0, 0)

  return d
}

export function getStartOfPreviousWeek(
  date: Date | number | string | undefined = new Date()
): Date {
  const d = new Date(date)

  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // @note adjust when day is sunday

  d.setDate(diff - 7)
  d.setHours(0, 0, 0, 0)

  return d
}

export function getStartOfDay(
  date: Date | number | string | undefined = new Date()
): Date {
  const d = new Date(date)

  d.setHours(0, 0, 0, 0)

  return d
}

export function getStartOfNextDay(
  date: Date | number | string | undefined = new Date()
): Date {
  const d = new Date(date)

  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)

  return d
}

export function getStartOfPreviousDay(
  date: Date | number | string | undefined = new Date()
): Date {
  const d = new Date(date)

  d.setDate(d.getDate() - 1)
  d.setHours(0, 0, 0, 0)

  return d
}

export function roundToNearestNMinutes(
  N: number,
  time: Date | number | string = new Date()
): Date {
  time = new Date(time)

  const coff = 1000 * 60 * N

  return new Date(Math.round(time.getTime() / coff) * coff)
}

export function timePlusDays(
  days: number,
  time: Date | number | string = new Date()
) {
  time = new Date(time)

  const integerDays = Math.floor(days)
  const fractionalDays = days - integerDays

  time.setDate(time.getDate() + integerDays)
  time.setMilliseconds(
    time.getMilliseconds() + fractionalDays * 24 * 60 * 60 * 1000
  )

  return time
}

export function timeAgo(
  time: Date | number | string,
  options: Intl.RelativeTimeFormatOptions = { numeric: 'auto', style: 'long' }
): string {
  time = new Date(time).getTime()

  const formatter = new Intl.RelativeTimeFormat('en-US', options)

  const units = {
    year: ONE_YEAR_IN_MILLISECONDS,
    month: ONE_MONTH_IN_MILLISECONDS,
    week: ONE_WEEK_IN_MILLISECONDS,
    day: ONE_DAY_IN_MILLISECONDS,
    hour: ONE_HOUR_IN_MILLISECONDS,
    minute: ONE_MINUTE_IN_MILLISECONDS,
    second: 1000,
  }

  const now = Date.now()

  const delta = time - now

  for (const [unit, value] of Object.entries(units)) {
    const rawAmount = delta / value

    const amount = delta > 0 ? Math.floor(rawAmount) : Math.ceil(rawAmount)

    if (Math.abs(amount) >= 1 || unit === 'second') {
      // @ts-expect-error - not sure why
      return formatter.format(amount, unit)
    }
  }

  return 'now'
}

export function dateFormat(
  date: Date | number | string = new Date(),
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }
): string {
  return new Intl.DateTimeFormat('en', options).format(new Date(date))
}

export function getShortDate(
  date: Date | number | string = new Date(),
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = new Date(date)

  return d.toLocaleDateString('en-US', {
    ...options,

    year: 'numeric',
    month: 'short',
    weekday: 'short',
    day: 'numeric',
  })
}

export function getShortTime(
  date: Date | number | string = new Date(),
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = new Date(date)

  return d.toLocaleTimeString('en-US', {
    ...options,

    hour: 'numeric',
    minute: 'numeric',
  })
}

export function getShortDateTime(
  date: Date | number | string = new Date(),
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = new Date(date)

  return d.toLocaleDateString('en-US', {
    ...options,

    year: 'numeric',
    month: 'short',
    weekday: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  })
}

export function getYYYYMMDD(date: Date | number | string = new Date()): string {
  const d = new Date(date)

  return d.toISOString().split('T')[0]
}

export function formatDuration(ms: number): string {
  if (ms < 0) {
    ms = -ms
  }

  const time = {
    day: Math.floor(ms / 86400000),
    hour: Math.floor(ms / 3600000) % 24,
    minute: Math.floor(ms / 60000) % 60,
    second: Math.floor(ms / 1000) % 60,
    millisecond: Math.floor(ms) % 1000,
  }

  return Object.entries(time)
    .filter((val) => val[1] !== 0)
    .map(([key, val]) => `${val} ${key}${val !== 1 ? 's' : ''}`)
    .join(', ')
}

const DURATION_UNITS: ReadonlyArray<readonly [RegExp, number]> = [
  [/^(?:y|yr|yrs|year|years)$/, ONE_YEAR_IN_MILLISECONDS],
  [/^(?:mo|mon|mos|month|months)$/, ONE_MONTH_IN_MILLISECONDS],
  [/^(?:w|wk|wks|week|weeks)$/, ONE_WEEK_IN_MILLISECONDS],
  [/^(?:d|day|days)$/, ONE_DAY_IN_MILLISECONDS],
  [/^(?:h|hr|hrs|hour|hours)$/, ONE_HOUR_IN_MILLISECONDS],
  [/^(?:m|min|mins|minute|minutes)$/, ONE_MINUTE_IN_MILLISECONDS],
  [/^(?:s|sec|secs|second|seconds)$/, ONE_MINUTE_IN_MILLISECONDS / 60],
  [/^(?:ms|msec|msecs|millisecond|milliseconds)$/, 1],
]

const DURATION_COMPONENT = /(-?\d+(?:\.\d+)?)\s*([a-z]+)/g

/**
 * Parse a human-readable duration into milliseconds — the inverse of
 * {@link formatDuration}. Accepts:
 *
 * - a number (returned as-is, treated as milliseconds),
 * - a bare numeric string ("3600000" → milliseconds),
 * - single units ("1 day", "30 minutes", "2h", "15m", "1.5h"), and
 * - compound durations ("1 day, 2 hours", "1 day and 30 minutes").
 *
 * Note `m` means minutes and `mo` means months (matching common convention).
 * Returns `null` when the input cannot be parsed.
 */
export function parseDuration(input: string | number): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null
  }

  if (typeof input !== 'string') {
    return null
  }

  const text = input.trim().toLowerCase()

  if (!text) {
    return null
  }

  // @note a bare number is interpreted as milliseconds
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    const value = Number(text)

    return Number.isFinite(value) ? value : null
  }

  const components = [...text.matchAll(DURATION_COMPONENT)]

  if (components.length === 0) {
    return null
  }

  let total = 0

  for (const [, value, unit] of components) {
    const match = DURATION_UNITS.find(([pattern]) => pattern.test(unit))

    if (!match) {
      return null // @note unknown unit fails the whole parse
    }

    total += parseFloat(value) * match[1]
  }

  // @note reject any leftover that is not a component separator, so junk like
  // "1 day of fun" does not silently parse as one day
  const leftover = text
    .replace(DURATION_COMPONENT, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/[\s,]+/g, '')

  if (leftover) {
    return null
  }

  return total
}

export function laterThan(date: Date | number | string): boolean {
  return Date.now() > new Date(date).getTime()
}

export function daysLeft(date: Date | number | string): number {
  return Math.ceil(
    (new Date(date).getTime() - Date.now()) / ONE_DAY_IN_MILLISECONDS
  )
}

export function getMonthName(date?: Date | number | string): string {
  return new Date(date || new Date()).toLocaleString('default', {
    month: 'long',
  })
}

export function isDate(date: Date | number | string): boolean {
  return !!date && !isNaN(new Date(date).getTime())
}

export function isDateString(date: Date | number | string): boolean {
  if (typeof date !== 'string') {
    return false
  }

  if (/^[\d\.]+$/.test(date.trim())) {
    return false
  }

  const number = Date.parse(date)

  if (isNaN(number)) {
    return false
  }

  if (number < 0) {
    return false
  }

  const dateObj = new Date(number)

  if (dateObj.toString() === 'Invalid Date') {
    return false
  }

  return true
}

export function getTimezone(timezone?: string | null): string {
  timezone = timezone?.trim?.() || 'UTC'

  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone })

    return timezone
  } catch (_e) {
    return 'UTC'
  }
}

/**
 * Returns the minimum (earliest) date from the provided dates.
 * Filters out null and undefined values.
 *
 * @param dates - Array of dates (Date objects, timestamps, or null/undefined)
 * @returns The earliest date, or undefined if no valid dates provided
 *
 * @example
 * minDate(new Date('2023-01-01'), new Date('2024-01-01')) // Returns 2023-01-01
 * minDate(new Date('2024-01-01'), null, new Date('2023-01-01')) // Returns 2023-01-01
 */
export function minDate(
  ...dates: (Date | number | string | null | undefined)[]
): Date | undefined {
  const validDates = dates
    .filter((d): d is Date | number | string => d != null)
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()))

  if (validDates.length === 0) {
    return undefined
  }

  return new Date(Math.min(...validDates.map((d) => d.getTime())))
}

/**
 * Returns the maximum (latest) date from the provided dates.
 * Filters out null and undefined values.
 *
 * @param dates - Array of dates (Date objects, timestamps, or null/undefined)
 * @returns The latest date, or undefined if no valid dates provided
 *
 * @example
 * maxDate(new Date('2023-01-01'), new Date('2024-01-01')) // Returns 2024-01-01
 * maxDate(new Date('2024-01-01'), null, new Date('2025-01-01')) // Returns 2025-01-01
 */
export function maxDate(
  ...dates: (Date | number | string | null | undefined)[]
): Date | undefined {
  const validDates = dates
    .filter((d): d is Date | number | string => d != null)
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()))

  if (validDates.length === 0) {
    return undefined
  }

  return new Date(Math.max(...validDates.map((d) => d.getTime())))
}

/**
 * Clamps a date between a minimum and maximum date.
 *
 * @param date - The date to clamp
 * @param min - The minimum allowed date (optional)
 * @param max - The maximum allowed date (optional)
 * @returns The clamped date
 *
 * @example
 * clampDate(new Date('2023-06-15'), new Date('2023-01-01'), new Date('2023-12-31'))
 * // Returns 2023-06-15 (within range)
 *
 * clampDate(new Date('2024-06-15'), new Date('2023-01-01'), new Date('2023-12-31'))
 * // Returns 2023-12-31 (clamped to max)
 *
 * clampDate(new Date('2022-06-15'), new Date('2023-01-01'), new Date('2023-12-31'))
 * // Returns 2023-01-01 (clamped to min)
 */
export function clampDate(
  date: Date | number | string,
  min?: Date | number | string | null,
  max?: Date | number | string | null
): Date {
  const d = new Date(date)

  if (min != null) {
    const minD = new Date(min)

    if (d < minD) {
      return minD
    }
  }

  if (max != null) {
    const maxD = new Date(max)

    if (d > maxD) {
      return maxD
    }
  }

  return d
}
