import debug from '@/lib/debug'
import _fetch, { withRetry, withTimeout } from '@/lib/fetch'

import { getSdk } from './graphql'

import { GraphQLClient } from 'graphql-request'

export type { GraphQLClient } from 'graphql-request'

export type Client = ReturnType<typeof getSdk>

const fetch = withRetry(withTimeout(_fetch, { timeout: 60000 }), {
  retries: 1,
  retryDelay: 250,
  retryTimeout: true,
})

interface ServerClientOptions {
  secret: string

  endpoint: string
  headers?: Record<string, string>

  fetch?: typeof fetch
}

interface BrowserClientOptions {
  endpoint: string
  headers?: Record<string, string>

  fetch?: typeof fetch
}

export function createClient(
  options: ServerClientOptions | BrowserClientOptions
): Client {
  debug(`creating graphql client`, { endpoint: options.endpoint })

  const client = new GraphQLClient(options.endpoint, {
    headers: {
      ...options.headers,

      ...('secret' in options
        ? {
            Authorization: `Bearer ${options.secret}`,
          }
        : {
            'X-Requested-With': 'XMLHttpRequest',
          }),
    },

    fetch: options?.fetch || fetch,
  })

  return getSdk(client)
}
