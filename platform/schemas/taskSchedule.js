// @ts-check
import { isSchedule } from '@/lib/task.validation'

import dbStringSchema from '@/schemas/dbString'

export default dbStringSchema.custom((value) => {
  if (value) {
    if (!isSchedule(value)) {
      throw new Error('Invalid schedule')
    }
  }

  return value
}, 'schedule')
