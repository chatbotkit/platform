import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import type { Session } from '@/lib/session.handler'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'
import { throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

// --- Handler Names ---

export const PROXY_HANDLER_NAME = 'proxy'

// --- Schemas ---

export const proxySchema = z.object({
  service: z.enum(['jira', 'confluence', 'servicedesk']),
  path: z.union([z.string(), z.array(z.string())]),
  query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  data: z.record(z.any()).optional(),
})

export type ProxySchema = z.infer<typeof proxySchema>

// --- Handlers ---

async function proxyHandler(
  _session: Session,
  parameters: ProxySchema,
  headers: Headers
): Promise<unknown> {
  debug(`atlassian/proxy`, { parameters, headers }).log(
    'auxiliary.skillset.ability.atlassian.proxy.handler'
  )

  const { service, path: pathInput, query, method, data } = parameters

  // @note join path array if provided, otherwise use string directly

  const path = Array.isArray(pathInput) ? pathInput.join('') : pathInput

  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  let cloudId: string
  let cloudUrl: string

  {
    const url = new URL(
      `https://api.atlassian.com/oauth/token/accessible-resources`
    )

    const response = await call(url.href, {
      method: 'GET',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json', // @note this is required to avoid 415 errors
        Accept: 'application/json', // @note this is required to avoid 415 errors
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const json = await response.json()

    debug(`received`, { json }).log(
      'auxiliary.skillset.ability.atlassian.proxy.handler'
    )

    if (json.length === 0) {
      throw new Error('No accessible resources found')
    }

    // @todo handle multiple resources

    cloudId = json[0].id
    cloudUrl = json[0].url
  }

  // @note servicedesk API is accessed via the jira service path, not a separate
  // servicedesk path

  const apiService = service === 'servicedesk' ? 'jira' : service

  const url = new URL(
    `https://api.atlassian.com/ex/${apiService}/${cloudId}${path}`
  )

  if (query) {
    for (const key in query) {
      url.searchParams.set(key, query[key].toString())
    }
  }

  debug(`url`, { url: url.href }).log(
    'auxiliary.skillset.ability.atlassian.proxy.handler'
  )

  const response = await call(url.href, {
    method: method || (data ? 'POST' : 'GET'),
    headers: {
      Authorization: token,
      'Content-Type': 'application/json', // @note this is required to avoid 415 errors
      Accept: 'application/json', // @note this is required to avoid 415 errors

      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const json = await response.json()

  debug(`received`, { json }).log(
    'auxiliary.skillset.ability.atlassian.proxy.handler'
  )

  // jira urls
  {
    if (service === 'jira') {
      switch (true) {
        case path === '/rest/api/3/search': {
          json.issues = json.issues?.map?.((issue: { key: string }) => {
            return {
              ...issue,

              publicUrl: new URL('/browse/' + issue.key, cloudUrl).href,
            }
          })

          break
        }

        case path.startsWith('/rest/api/3/issue/'): {
          json.publicUrl = new URL('/browse/' + json.key, cloudUrl).href

          break
        }
      }
    }
  }

  return json
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [PROXY_HANDLER_NAME]: {
    schema: proxySchema,
    fn: proxyHandler,
  },
})
