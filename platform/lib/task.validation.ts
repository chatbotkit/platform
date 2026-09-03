import { isDateString as isDateExpression } from '@chatbotkit-dev/time'

import { Schedule } from '@/prisma/types'

import { isCron as isCronExpression } from '@/lib/cron'

/**
 * Checks if a schedule string is a valid interval from the Schedule enum
 */
export function isInterval(schedule: string): boolean {
  return !!schedule && Object.keys(Schedule).includes(schedule)
}

/**
 * Checks if a schedule string is a valid cron expression
 */
export function isCron(schedule: string): boolean {
  return !!schedule && isCronExpression(schedule)
}

/**
 * Checks if a schedule string is a valid date expression
 */
export function isDate(schedule: string): boolean {
  return !!schedule && isDateExpression(schedule)
}

/**
 * Checks if a schedule string is a valid local time expression
 */
export function isTime(schedule: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(schedule)
}

/**
 * Checks if a schedule string is valid (interval, cron, or date)
 */
export function isSchedule(schedule: string | null | undefined): boolean {
  return (
    !!schedule &&
    (isInterval(schedule) ||
      isCron(schedule) ||
      isDate(schedule) ||
      isTime(schedule))
  )
}
