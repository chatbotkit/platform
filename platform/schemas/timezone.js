// @ts-check
import dbStringSchema from '@/schemas/dbString'

export default dbStringSchema.custom((value) => {
  value = value?.trim?.() ?? value

  if (value) {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: value })
    } catch {
      throw new Error('Invalid timezone')
    }
  }

  return value
}, 'timezone')
