import {
  getContextFrontendHost,
  getContextRequestIpAddress,
  getContextTimezone,
} from '@/lib/context.store'
import { TIMEZONE_HEADER_NAME } from '@/lib/header'
import { getInternalAssertionHeaders } from '@/lib/header.assertion'
import { getLocalAPIHostURL } from '@/lib/host'
import { type Session } from '@/lib/session.get'
import {
  getTemporaryUserSessionToken,
  getTemporaryUserToken,
} from '@/lib/session.temp'
import { type User } from '@/lib/user.get'

import { type Client as GraphqlClient, createClient } from '@/graphql/v1/client'

import { type ChatBotKitClientOptions } from '@chatbotkit/sdk/client'

/**
 * Get a GraphQL client for a specific user.
 *
 * @note the user is not checked that it exists - it's the caller's
 * responsibility to ensure the user is valid
 *
 * @deprecated use getSessionGraphQLClient instead
 */
export async function getUserGraphQLClient(
  user: Pick<User, 'id'>,
  options?: Partial<ChatBotKitClientOptions>
): Promise<GraphqlClient> {
  const endpoint = getLocalAPIHostURL('/api/v1/graphql')

  const frontendHost = getContextFrontendHost()
  const realIp = getContextRequestIpAddress()

  const timezone = getContextTimezone()

  return createClient({
    secret: await getTemporaryUserToken(user.id),

    endpoint: endpoint,

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
}

/**
 * Get a GraphQL client for a specific session.
 */
export async function getSessionGraphQLClient(
  session: Pick<Session, 'id' | 'user'>,
  options?: Partial<ChatBotKitClientOptions>
): Promise<GraphqlClient> {
  const endpoint = getLocalAPIHostURL('/api/v1/graphql')

  const frontendHost = getContextFrontendHost()
  const realIp = getContextRequestIpAddress()

  const timezone = getContextTimezone()

  return createClient({
    secret: await getTemporaryUserSessionToken(session),

    endpoint: endpoint,

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
}

/**
 * Get a GraphQL client for the platform user.
 *
 * @note the platform user is not a privileged user and it does not have any
 * specific subscriptions - it is mainly used to introspect platform-level
 * data such as available abilities, skillsets, etc
 */
export async function getPlatformGraphQLClient(
  options?: Partial<ChatBotKitClientOptions>
): Promise<GraphqlClient> {
  return getUserGraphQLClient(
    {
      id: '_platform', // @note by convention _ denotes private
    },
    options
  )
}
