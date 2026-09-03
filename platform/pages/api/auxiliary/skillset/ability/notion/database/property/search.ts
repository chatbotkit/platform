import {
  UnsupportedPropertiesError,
  searchDatabaseHandler,
} from '@chatbotkit-dev/auxiliary-notion'
import type { PositiveNumber } from '@chatbotkit-dev/typescript-utils/number'
import { isPositiveNumber } from '@chatbotkit-dev/typescript-utils/number'
import { isTrimmedNonEmptyString } from '@chatbotkit-dev/typescript-utils/string'

import { authenticatedHandler } from '@/lib/auxiliary.handler'
import call from '@/lib/call'
import debug from '@/lib/debug'
import { throwBadRequest, throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

const schema = z.object({
  databaseId: z.string(),
  query: z.record(z.string()).optional(),
  startCursor: z.string().optional(),
  pageSize: z.number().default(20),
  simplifiedProperties: z.boolean().default(true),
})

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`notion/database/property/search`, { parameters, headers }).log(
      'auxiliary.skillset.ability.notion.database.property.search'
    )

    const { databaseId, query, startCursor, pageSize, simplifiedProperties } =
      parameters

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

    try {
      return await searchDatabaseHandler({
        token: token,
        databaseId: databaseId,
        query: query,
        startCursor:
          startCursor && isTrimmedNonEmptyString(startCursor)
            ? startCursor
            : undefined,
        pageSize:
          pageSize && isPositiveNumber(pageSize)
            ? pageSize
            : (20 as PositiveNumber),
        simplifiedProperties,
        fetch: call,
      })
    } catch (error) {
      // @note the caller (typically the model) supplied filter property names
      // that do not exist in the database schema; surface this as a bad request
      // so it is returned to the caller for self-correction rather than captured
      // in Sentry as an unexpected exception

      if (error instanceof UnsupportedPropertiesError) {
        return throwBadRequest(error.message)
      }

      throw error
    }
  }
)
