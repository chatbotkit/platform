// @ts-check
import { nameMaxLength } from '@/config/abilities'

import schema from '@/lib/joi.schema'

export default schema.string().allow(null, '').max(nameMaxLength)
