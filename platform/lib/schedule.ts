import {
  HALF_HOUR_IN_MILLISECONDS,
  ONE_DAY_IN_MILLISECONDS,
  ONE_HOUR_IN_MILLISECONDS,
  ONE_MONTH_IN_MILLISECONDS,
  ONE_WEEK_IN_MILLISECONDS,
  QUARTER_HOUR_IN_MILLISECONDS,
} from '@chatbotkit-dev/time'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { Schedule } from '@/prisma/types'

export function syncScheduleToMilliseconds(syncSchedule: Schedule): number {
  switch (syncSchedule) {
    case Schedule.never:
      return 0

    case Schedule.quarterhourly:
      return QUARTER_HOUR_IN_MILLISECONDS

    case Schedule.halfhourly:
      return HALF_HOUR_IN_MILLISECONDS

    case Schedule.hourly:
      return ONE_HOUR_IN_MILLISECONDS + QUARTER_HOUR_IN_MILLISECONDS

    case Schedule.twicedaily:
      return ONE_DAY_IN_MILLISECONDS / 2 + QUARTER_HOUR_IN_MILLISECONDS

    case Schedule.daily:
      return ONE_DAY_IN_MILLISECONDS + QUARTER_HOUR_IN_MILLISECONDS

    case Schedule.twiceweekly:
      return ONE_WEEK_IN_MILLISECONDS / 2 + QUARTER_HOUR_IN_MILLISECONDS

    case Schedule.weekly:
      return ONE_WEEK_IN_MILLISECONDS + QUARTER_HOUR_IN_MILLISECONDS

    case Schedule.twicemonthly:
      return ONE_MONTH_IN_MILLISECONDS / 2 + QUARTER_HOUR_IN_MILLISECONDS

    case Schedule.monthly:
      return ONE_MONTH_IN_MILLISECONDS + QUARTER_HOUR_IN_MILLISECONDS

    default: {
      assertUnreachable(syncSchedule)
    }
  }
}
