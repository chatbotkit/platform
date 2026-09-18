// @ts-check
import schema from '@/lib/joi.schema'
import { parseDecisionModel } from '@/lib/model.utils'

export default schema
  .string()
  .allow(null, '')
  .custom((value) => {
    if (value) {
      parseDecisionModel(value)
    }

    return value
  }, 'model')
