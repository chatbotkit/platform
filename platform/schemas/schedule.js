// @ts-check
import { Schedule } from '@/prisma/types'

import schema from '@/lib/joi.schema'

export default schema
  .string()
  .allow(null)
  .valid(null, ...Object.keys(Schedule))

export const fairSyncScheduleSchema = schema
  .string()
  .allow(null)
  .valid(
    null,
    Schedule.never,
    Schedule.daily,
    Schedule.weekly,
    Schedule.monthly
  )
