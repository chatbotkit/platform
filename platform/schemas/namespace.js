import { schema } from '@/lib/joi.handler'
import { throwNotAuthenticated } from '@/lib/response'

export default schema
  .string()
  .allow(null, '')
  .external(async function (value, helpers) {
    // @todo use types

    const { user, payload } = helpers?.prefs?.context?.session || {}

    if (!user) {
      return throwNotAuthenticated()
    }

    // @note if the namespace is provided in the session payload, use it
    // directly - this is a hard override because it means the session creator
    // has already validated the namespace access

    if (payload?.namespace) {
      return payload.namespace
    }

    return value
  })
