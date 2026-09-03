// @ts-check
import schema from '@/lib/joi.schema'
import { parse } from '@/lib/structstr'

export default schema
  .string()
  .allow(null, '')
  .custom((value) => {
    if (value) {
      parse(value)
    }

    return value
  }, 'structstr')
