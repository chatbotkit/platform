import type { TrimmedNonEmptyString } from '@chatbotkit-dev/typescript-utils'

import { fetch as cbkFetch, withRetry, withTimeout } from '@chatbotkit-dev/fetch'
import { Client } from '@notionhq/client'

export function getClient(
  auth: TrimmedNonEmptyString,
  options?: { fetch?: typeof cbkFetch }
): Client {
  const clientAuth = auth.replace(/^Bearer\s+/i, '').trim()

  if (!clientAuth) {
    throw new Error(`Authentication token not provided`)
  }

  return new Client({
    auth: clientAuth as TrimmedNonEmptyString,

    fetch: withRetry(
      withTimeout(options?.fetch || cbkFetch, { timeout: 10000 }),
      {
        retries: 5,
        retryDelay: 250,
        retryTimeout: true,
      }
    ),
  })
}
