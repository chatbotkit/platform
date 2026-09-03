import {
  UnsupportedPropertiesError,
  updateDatabaseItemHandler,
} from '@chatbotkit-dev/auxiliary-notion'
import { isTrimmedNonEmptyString } from '@chatbotkit-dev/typescript-utils/string'

import { authenticatedHandler } from '@/lib/auxiliary.handler'
import call from '@/lib/call'
import debug from '@/lib/debug'
import { throwBadRequest, throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

const schema = z.object({
  databaseId: z.string(),
  itemId: z.string(),
  properties: z.record(z.unknown()),
})

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`notion/database/item/update`, { parameters, headers }).log(
      'auxiliary.skillset.ability.notion.database.item.update'
    )

    const { databaseId, itemId, properties } = parameters

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

    if (!isTrimmedNonEmptyString(itemId)) {
      return throwBadRequest()
    }

    try {
      return await updateDatabaseItemHandler({
        token,
        databaseId,
        itemId,
        properties,
        fetch: call,
      })
    } catch (error) {
      // @note the caller (typically the model) supplied property names that do
      // not exist in the database schema; surface this as a bad request so it is
      // returned to the caller for self-correction rather than captured in Sentry
      // as an unexpected exception

      if (error instanceof UnsupportedPropertiesError) {
        return throwBadRequest(error.message)
      }

      throw error
    }
  }
)
