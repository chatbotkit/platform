import { fetchPageHandler } from '@chatbotkit-dev/auxiliary-notion'
import { isTrimmedNonEmptyString } from '@chatbotkit-dev/typescript-utils/string'

import { authenticatedHandler } from '@/lib/auxiliary.handler'
import call from '@/lib/call'
import debug from '@/lib/debug'
import { throwBadRequest, throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

const schema = z.object({
  pageId: z.string(),
  simplifiedProperties: z.boolean().default(true),
})

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`notion/page/fetch`, { parameters, headers }).log(
      'auxiliary.skillset.ability.notion.page.fetch'
    )

    const { pageId, simplifiedProperties } = parameters

    const token = headers.get('x-access-token')

    if (!token) {
      return throwNotAuthenticated()
    }

    if (!isTrimmedNonEmptyString(token)) {
      return throwNotAuthenticated()
    }

    if (!isTrimmedNonEmptyString(pageId)) {
      return throwBadRequest()
    }

    return await fetchPageHandler({
      token,
      pageId,
      simplifiedProperties,
      fetch: call,
    })
  }
)
