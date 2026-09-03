// @ts-check
import { MAX_DB_STRING_BYTES_LENGTH } from '@/prisma/constraints'

import schema from '@/lib/joi.schema'

export default schema
  .string()
  .allow(null, '')
  .maxByteLength(MAX_DB_STRING_BYTES_LENGTH)
