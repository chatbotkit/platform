import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import type { Session } from '@/lib/session.handler'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'
import { throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

// --- API Path ---

export const APOLLO_API_PATH =
  '/api/auxiliary/skillset/ability/apollo/handler' as const

// --- Handler Names ---

export const PROXY_HANDLER_NAME = 'proxy' as const

// --- Schemas ---

const proxySchema = z.object({
  url: z.string(),
  query: z.record(z.string()).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  data: z.record(z.any()).optional(),
  keys: z.array(z.string()).optional(),
})

export type ProxySchema = z.infer<typeof proxySchema>

// --- Handlers ---

async function proxy(_session: Session, parameters: ProxySchema, headers: Headers) {
  debug(`apollo/proxy`, { parameters, headers })

  const { url: _url, query, method: _method, data, keys = [] } = parameters

  const rawToken = headers.get('x-access-token')

  if (!rawToken) {
    return throwNotAuthenticated()
  }

  // @note Apollo authenticates with a bare key in X-Api-Key, but callers may
  // hand us the secret as a bearer token (`Bearer <key>`). Strip the scheme
  // defensively so we never forward `X-Api-Key: Bearer <key>` to Apollo.

  const token = rawToken.replace(/^\s*Bearer\b\s*/i, '').trim()

  if (!token) {
    return throwNotAuthenticated()
  }

  const url = new URL(_url, 'https://api.apollo.io')

  if (query) {
    for (const key in query) {
      if (key.endsWith('[]')) {
        const value = query[key]

        const items = value
          .split(/,/g)
          .map((i) => i.trim())
          .filter(Boolean)

        // @note apollo range params (e.g. organization_num_employees_ranges[])
        // expect a "min,max" value, but comma is our list separator - so
        // callers pass each range as "min-max" (e.g. 1-10) and we convert it
        const isRange = key.endsWith('_ranges[]')

        for (const item of items) {
          url.searchParams.append(
            key,
            isRange ? item.replace(/^(\d+)\s*-\s*(\d+)$/, '$1,$2') : item
          )
        }
      } else {
        // @note skip empty scalars so unfilled optional fields don't send
        // blank params (e.g. `per_page=`) that apollo may reject
        const value = query[key].trim()

        if (value) {
          url.searchParams.set(key, value)
        }
      }
    }
  }

  const method = _method || (data ? 'POST' : 'GET')

  const body = data ? JSON.stringify(data) : undefined

  const response = await call(url.href, {
    method,
    headers: {
      'X-Api-Key': token,

      Accept: 'application/json',

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

  if (keys?.length) {
    for (const key of Object.keys(json)) {
      if (!keys.includes(key)) {
        delete json[key]
      }
    }
  }

  const result = JSON.parse(
    JSON.stringify(json, (_key, value) => {
      switch (true) {
        // if key ends with uid or key, return undefined - we deliberately
        // keep `id` so search results can be chained into the people enrich
        // ability (the free search masks names and only hands back the id)

        case /(?:^|\W)(?:uid|key)$/i.test(_key): {
          return undefined
        }

        // if the value is null, return undefined

        case value === null: {
          return undefined
        }

        // if the value is an empty array, return undefined

        case Array.isArray(value) && !value.length: {
          return undefined
        }

        // if the value is an empty object, return undefined

        case Object.keys(value).length === 0: {
          return undefined
        }

        // otherwise, return the value

        default: {
          return value
        }
      }
    })
  )

  debug(`filtered`, { result })

  return result
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [PROXY_HANDLER_NAME]: {
    schema: proxySchema,
    fn: proxy,
  },
})
