import {
  getContextFrontendHost,
  getContextRequestIpAddress,
  getContextTimezone,
} from '@/lib/context.store'
import { TIMEZONE_HEADER_NAME } from '@/lib/header'
import { getInternalAssertionHeaders } from '@/lib/header.assertion'
import { getLocalAPIHostURL } from '@/lib/host'
import type { Session } from '@/lib/session.get'
import {
  getTemporaryUserSessionToken,
  getTemporaryUserToken,
} from '@/lib/session.temp'
import type { User } from '@/lib/user.get'

import { ChatBotKit } from '@chatbotkit/sdk'
import type { ChatBotKitClientOptions } from '@chatbotkit/sdk/client'

export type { ChatBotKit } from '@chatbotkit/sdk'

/**
 * Get a ChatBotKit client for a specific user.
 *
 * @deprecated use getSessionClient instead
 */
export async function getUserClient(
  user: Pick<User, 'id'>,
  options?: Partial<ChatBotKitClientOptions>
): Promise<ChatBotKit> {
  const url = new URL(getLocalAPIHostURL())

  const frontendHost = getContextFrontendHost()
  const realIp = getContextRequestIpAddress()

  const timezone = getContextTimezone()

  const cbk = new ChatBotKit({
    ...options,

    secret: await getTemporaryUserToken(user.id),

    host: url.host,
    protocol: url.protocol as 'http:' | 'https:',

    headers: {
      ...(timezone
        ? {
            [TIMEZONE_HEADER_NAME]: timezone,
          }
        : undefined),

      ...options?.headers,

      ...getInternalAssertionHeaders({ frontendHost, realIp }),
    },
  })

  return cbk
}

/**
 * Get a ChatBotKit client for a specific session.
 */
export async function getSessionClient(
  session: Pick<Session, 'id' | 'user'>,
  options?: Partial<ChatBotKitClientOptions>
): Promise<ChatBotKit> {
  const url = new URL(getLocalAPIHostURL())

  const frontendHost = getContextFrontendHost()
  const realIp = getContextRequestIpAddress()

  const timezone = getContextTimezone()

  const cbk = new ChatBotKit({
    ...options,

    secret: await getTemporaryUserSessionToken(session),

    host: url.host,
    protocol: url.protocol as 'http:' | 'https:',

    headers: {
      ...(timezone
        ? {
            [TIMEZONE_HEADER_NAME]: timezone,
          }
        : undefined),

      ...options?.headers,

      ...getInternalAssertionHeaders({ frontendHost, realIp }),
    },
  })

  return cbk
}

/**
 * Get a ChatBotKit client for a specific session, routing all SDK requests
 * through a local handler instead of making real HTTP calls. This preserves
 * the full middleware chain (limits, schema validation, etc.) without an HTTP
 * hop - useful for in-process bot invocations that would otherwise trigger
 * Vercel INFINITE_LOOP false positives.
 */
export async function getLocalSessionClient(
  session: Pick<Session, 'id' | 'user'>,
  handler: (req: Request) => Promise<Response>,
  options?: Partial<ChatBotKitClientOptions>
): Promise<ChatBotKit> {
  const url = new URL(getLocalAPIHostURL())

  const frontendHost = getContextFrontendHost()
  const realIp = getContextRequestIpAddress()

  const timezone = getContextTimezone()

  const cbk = new ChatBotKit({
    ...options,

    secret: await getTemporaryUserSessionToken(session),

    host: url.host,
    protocol: url.protocol as 'http:' | 'https:',

    fetchFn: (fetchUrl, init) => handler(new Request(fetchUrl, init)),

    headers: {
      ...(timezone
        ? {
            [TIMEZONE_HEADER_NAME]: timezone,
          }
        : undefined),

      ...options?.headers,

      ...getInternalAssertionHeaders({ frontendHost, realIp }),
    },
  })

  return cbk
}
