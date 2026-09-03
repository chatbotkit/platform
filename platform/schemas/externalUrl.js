// @ts-check
import schema from '@/lib/joi.schema'

import { ParseResultType, parseDomain } from 'parse-domain'

export default schema
  .string()
  .uri({
    scheme: ['https'],
    domain: {
      tlds: false,
    },
  })
  .custom((value) => {
    const url = new URL(value)

    const result = parseDomain(url.hostname)

    if (result.type === ParseResultType.Invalid) {
      throw new Error('Invalid domain')
    }

    if (result.type === ParseResultType.NotListed) {
      throw new Error('Not listed domain')
    }

    if (result.type === ParseResultType.Reserved) {
      throw new Error('Reserved domain')
    }

    if (result.type === ParseResultType.Ip) {
      throw new Error('IP domain')
    }

    return url.href
  })
