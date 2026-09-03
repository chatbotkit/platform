// @ts-check
import { Trigger } from '@/prisma/types'

import schema from '@/lib/joi.schema'

export default schema
  .string()
  .allow(null)
  .valid(null, ...Object.keys(Trigger))
