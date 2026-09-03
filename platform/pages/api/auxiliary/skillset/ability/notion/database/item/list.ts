import { listDatabaseItemsHandler } from '@chatbotkit-dev/auxiliary-notion'
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
  startCursor: z.string().optional(),
  pageSize: z.number().default(20),
  simplifiedProperties: z.boolean().default(true),
})

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`notion/database/item/list`, { parameters, headers }).log(
      'auxiliary.skillset.ability.notion.database.item.list'
    )

    const { databaseId, startCursor, pageSize, simplifiedProperties } = parameters

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

    return await listDatabaseItemsHandler({
      token: token,
      databaseId: databaseId,
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
  }
)
