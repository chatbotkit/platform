// @ts-check
import { MessageType } from '@/prisma/types'

import schema from '@/lib/joi.schema'

export default schema.string().valid(...Object.keys(MessageType))
