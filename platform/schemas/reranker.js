// @ts-check
import schema from '@/lib/joi.schema'
import { parseRerankModel } from '@/lib/model.utils'

export default schema
  .string()
  .allow(null, '')
  .custom((value) => {
    if (value) {
      parseRerankModel(value)
    }

    return value
  }, 'reranker')
