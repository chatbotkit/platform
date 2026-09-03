import { introspectDatabaseHandler } from '@chatbotkit-dev/auxiliary-notion'
import { isTrimmedNonEmptyString } from '@chatbotkit-dev/typescript-utils/string'

import { authenticatedHandler } from '@/lib/auxiliary.handler'
import call from '@/lib/call'
import debug from '@/lib/debug'
import { throwBadRequest, throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

const schema = z.object({
  databaseId: z.string(),
})

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`notion/database/property/introspect`, { parameters, headers }).log(
      'auxiliary.skillset.ability.notion.database.property.introspect'
    )

    const { databaseId } = parameters

    const token = headers.get('x-access-token')

    if (!token) {
      return throwNotAuthenticated()
    }

    if (!isTrimmedNonEmptyString(token)) {
      return throwNotAuthenticated()
    }

    if (!isTrimmedNonEmptyString(databaseId)) {
      return throwBadRequest()
    }

    return await introspectDatabaseHandler({
      token,
      databaseId,
      fetch: call,
    })
  }
)
