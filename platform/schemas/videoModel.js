// @ts-check
import schema from '@/lib/joi.schema'
import { parseVideoModel } from '@/lib/model.utils'

export default schema
  .string()
  .allow(null, '')
  .custom((value) => {
    if (value) {
      parseVideoModel(value)
    }

    return value
  }, 'model')
