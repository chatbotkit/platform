import { listPagesHandler } from '@chatbotkit-dev/auxiliary-notion'
import type { PositiveNumber } from '@chatbotkit-dev/typescript-utils/number'
import { isPositiveNumber } from '@chatbotkit-dev/typescript-utils/number'
import { isTrimmedNonEmptyString } from '@chatbotkit-dev/typescript-utils/string'

import { authenticatedHandler } from '@/lib/auxiliary.handler'
import call from '@/lib/call'
import debug from '@/lib/debug'
import { throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

const schema = z.object({
  startCursor: z.string().optional(),
  pageSize: z.number().default(20),
  simplifiedProperties: z.boolean().default(true),
})

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`notion/page/list`, { parameters, headers }).log(
      'auxiliary.skillset.ability.notion.page.list'
    )

    const { startCursor, pageSize, simplifiedProperties } = parameters

    const token = headers.get('x-access-token')

    if (!token) {
      return throwNotAuthenticated()
    }

    if (!isTrimmedNonEmptyString(token)) {
      return throwNotAuthenticated()
    }

    return await listPagesHandler({
      token: token,
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
