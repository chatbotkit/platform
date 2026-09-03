// @ts-check
import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'

import schema from '@/lib/joi.schema'

export default schema
  .string()
  .allow('')
  .maxByteLength(MAX_DB_TEXT_BYTES_LENGTH)
  .custom((value) => {
    if (value) {
      value = value.trim()

      // @todo perhaps validate if it is a template
      // @todo perhaps validate if the action has the correct format
    }

    return value
  }, 'instruction')
