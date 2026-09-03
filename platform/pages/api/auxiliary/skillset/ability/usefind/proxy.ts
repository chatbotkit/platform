import { authenticatedHandler } from '@/lib/auxiliary.handler'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'
import { sleep } from '@/lib/promise'
import { throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

const schema = z.object({
  url: z.string(),
  query: z.record(z.string()).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  data: z.record(z.any()).optional(),
})

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`usefind/proxy`, { parameters, headers })

    const { url: _url, query, method: _method, data } = parameters

    const token = headers.get('x-access-token')

    if (!token) {
      return throwNotAuthenticated()
    }

    const url = new URL(_url, 'https://usefind.ai')

    if (query) {
      for (const key in query) {
        url.searchParams.set(key, query[key])
      }
    }

    const method = _method || (data ? 'POST' : 'GET')

    const body = data ? JSON.stringify(data) : undefined

    const response = await call(url.href, {
      method,
      headers: {
        Authorization: token,

        ...(body
          ? {
              'Content-Type': 'application/json',
            }
          : undefined),
      },
      body,
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const json = await response.json()

    debug(`received`, { json })

    let result

    {
      const { poll } = json

      if (!poll) {
        throw new Error('Poll not found')
      }

      if (!poll.token || !poll.path) {
        throw new Error('Token or path not found')
      }

      let maxAttempts = 20

      const pollUrl = new URL(
        poll.path.replace(':token', poll.token),
        'https://usefind.ai'
      )

      while (true) {
        if (maxAttempts <= 0) {
          throw new Error('Poll timeout')
        }

        await sleep(1000)

        const response = await call(pollUrl.href, {
          headers: {
            Authorization: token,
          },
        })

        if (response.status === 202) {
          maxAttempts--

          continue
        }

        if (!response.ok) {
          throw await getCallError(response)
        }

        result = await response.json()

        break
      }
    }

    return result
  }
)
