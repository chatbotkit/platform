// @ts-check
import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'

import schema from '@/lib/joi.schema'

export default schema
  .string()
  .allow(null, '')
  .maxByteLength(MAX_DB_TEXT_BYTES_LENGTH)
  .custom((value) => {
    // @todo add more validation here

    return value
  }, 'request')
