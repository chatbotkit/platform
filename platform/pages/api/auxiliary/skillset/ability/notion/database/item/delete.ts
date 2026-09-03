import { deleteDatabaseItemHandler } from '@chatbotkit-dev/auxiliary-notion'
import { isTrimmedNonEmptyString } from '@chatbotkit-dev/typescript-utils/string'

import { authenticatedHandler } from '@/lib/auxiliary.handler'
import call from '@/lib/call'
import debug from '@/lib/debug'
import { throwBadRequest, throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

const schema = z.object({
  databaseId: z.string(),
  itemId: z.string(),
})

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`notion/database/item/delete`, { parameters, headers }).log(
      'auxiliary.skillset.ability.notion.database.item.delete'
    )

    const { databaseId, itemId } = parameters

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

    return await deleteDatabaseItemHandler({
      token,
      databaseId,
      itemId,
      fetch: call,
    })
  }
)
