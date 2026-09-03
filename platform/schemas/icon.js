// @ts-check
import schema from '@/lib/joi.schema'
import { throwBadRequest } from '@/lib/response'

export default schema
  .string()
  .allow(null, '')
  .external(async function (value) {
    if (!value) {
      return value
    }

    if (!/^:[\w_]+:$/.test(value)) {
      throwBadRequest('Invalid icon')
    }
  }, 'icon')
