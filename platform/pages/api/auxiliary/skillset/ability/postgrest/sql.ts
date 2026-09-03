import { authenticatedHandler } from '@/lib/auxiliary.handler'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'

import { processSql, renderHttp } from '@supabase/sql-to-rest'

import { z } from 'zod'

const schema = z.object({
  url: z.string(),
  sql: z.string(),
})

export type SqlSchema = z.infer<typeof schema>

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`supabase/sql`, { parameters, headers })

    const { url: _url, sql } = parameters

    const token = headers.get('x-access-token')

    // @note provision for anon access
    // if (!token) {
    //   return throwNotAuthenticated()
    // }

    const statement = await processSql(sql)

    const request = await renderHttp(statement)

    const url = new URL(`${request.path}`, _url)

    url.search = request.params.toString()

    const response = await call(url.href, {
      method: 'GET',
      headers: {
        ...(token
          ? {
              ApiKey: (token.split(' ')[1] || '').trim(),
              Authorization: token,
            }
          : null),
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const json = await response.json()

    debug(`received`, { json })

    return json
  }
)
