// @ts-check
import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'

import schema from '@/lib/joi.schema'
import { normalizeText } from '@/lib/string'

const recordTextSchema = schema
  .string()
  .allow('')
  .maxByteLength(MAX_DB_TEXT_BYTES_LENGTH)

export default recordTextSchema

// @note the vector store refuses a record without text, and normalization
// strips nonprintable characters, so text like "\u200b" passes a whitespace
// check yet arrives empty - validate what will be stored, not what was sent

export const nonBlankRecordTextSchema = recordTextSchema.invalid('').custom(
  (value, helpers) =>
    /\S/.test(normalizeText(value))
      ? value
      : helpers.message({
          custom: '"text" must contain printable characters',
        }),
  'non-blank'
)
