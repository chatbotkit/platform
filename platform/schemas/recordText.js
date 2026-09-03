// @ts-check
import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'

import schema from '@/lib/joi.schema'

export default schema.string().allow('').maxByteLength(MAX_DB_TEXT_BYTES_LENGTH)
