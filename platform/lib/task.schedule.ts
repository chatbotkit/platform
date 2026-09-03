import {
  HALF_HOUR_IN_MILLISECONDS,
  ONE_DAY_IN_MILLISECONDS,
  ONE_HOUR_IN_MILLISECONDS,
  ONE_MONTH_IN_MILLISECONDS,
  ONE_WEEK_IN_MILLISECONDS,
  QUARTER_HOUR_IN_MILLISECONDS,
  getTimezone,
  isDate,
} from '@chatbotkit-dev/time'

import { Schedule } from '@/prisma/types'

import { getNext as getNextCronDate, isCron } from '@/lib/cron'
import debug from '@/lib/debug'
import { isTime } from '@/lib/task.validation'

interface GetNextOptions {
  timezone?: string | null
}

/**
 * Calculates the next run date for a task based on the schedule type (cron, date, or interval)
 */
export function getNext(
  schedule: string,
  options?: GetNextOptions
): Date | null {
  let nextRunAt: Date | null

  const timezone = getTimezone(options?.timezone)

  switch (true) {
    case schedule && schedule in Schedule: {
      debug(`is schedule`, { schedule }).log('task.queue.handleScheduleEvent')

      const scheduleMap: Record<Schedule, number | null> = {
        [Schedule.never]: null,
        [Schedule.quarterhourly]: QUARTER_HOUR_IN_MILLISECONDS,
        [Schedule.halfhourly]: HALF_HOUR_IN_MILLISECONDS,
        [Schedule.hourly]: ONE_HOUR_IN_MILLISECONDS,
        [Schedule.twicedaily]: ONE_DAY_IN_MILLISECONDS / 2,
        [Schedule.daily]: ONE_DAY_IN_MILLISECONDS,
        [Schedule.twiceweekly]: ONE_WEEK_IN_MILLISECONDS / 2,
        [Schedule.weekly]: ONE_WEEK_IN_MILLISECONDS,
        [Schedule.twicemonthly]: ONE_MONTH_IN_MILLISECONDS / 2,
        [Schedule.monthly]: ONE_MONTH_IN_MILLISECONDS,
      }

      const interval = scheduleMap[schedule as Schedule]

      nextRunAt = interval ? new Date(Date.now() + interval) : null

      break
    }

    case schedule && isCron(schedule): {
      debug(`is cron`, { schedule }).log('task.queue.handleScheduleEvent')

      nextRunAt = getNextCronDate(schedule, { timezone })

      break
    }

    case schedule && isTime(schedule): {
      debug(`is time`, { schedule, timezone }).log(
        'task.queue.handleScheduleEvent'
      )

      const [hour, minute] = schedule.split(':')

      nextRunAt = getNextCronDate(`${minute} ${hour} * * *`, { timezone })

      break
    }

    case schedule && isDate(schedule): {
      debug(`is date`, { schedule }).log('task.queue.handleScheduleEvent')

      const dateValue = new Date(schedule)

      // @note reject past dates - tasks scheduled in the past would never run
      if (dateValue.getTime() < Date.now()) {
        nextRunAt = null
      } else {
        nextRunAt = dateValue
      }

      break
    }

    default: {
      debug(`is unknown`, { schedule }).log('task.queue.handleScheduleEvent')

      nextRunAt = null

      break
    }
  }

  return nextRunAt
}
