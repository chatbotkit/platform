import { authenticatedHandler } from '@/lib/auxiliary.handler'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'

import { z } from 'zod'

const schema = z.object({
  url: z.string(),
  function: z.string(),
  params: z.union([z.string(), z.record(z.any())]),
})

export type RpcSchema = z.infer<typeof schema>

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`supabase/rpc`, { parameters, headers })

    const { url: _url, function: fn, params } = parameters

    const token = headers.get('x-access-token')

    // @note provision for anon access
    // if (!token) {
    //   return throwNotAuthenticated()
    // }

    const url = new URL(`/rpc/${fn}`, _url)

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        ...(token
          ? {
              ApiKey: (token.split(' ')[1] || '').trim(),
              Authorization: token,
            }
          : null),
        'Content-Type': 'application/json',
      },
      body: typeof params === 'string' ? params : JSON.stringify(params),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const json = await response.json()

    debug(`received`, { json })

    return json
  }
)
