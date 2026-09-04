// @note the community default for realtime channels: an address builder for
// any relay that speaks the platform's channel protocol.
//
// A relay is a process that accepts two websocket connections on the same
// channel and copies bytes between them. That is not something a package can
// be - it needs somewhere to listen that both sides can reach, and a lifetime
// longer than the request that asked for the address. So this module does the
// part a package can do: given RELAY_URL, the origin such a process listens
// on, it mints the address each side dials. It can also be that process:
// with RELAY_PORT set, `listen` starts the relay in ./server inside the
// platform, which is what the compose stacks do. Any other relay honouring
// the same route works too.
//
// Unset, `channelUrl` throws `NOT_CONFIGURED` naming the variable, and
// `assertConfigured` throws too, rather than following `@chatbotkit-dev/email`
// and resolving anyway: a module that cannot serve any request should fail the
// deployment's readiness check instead of waiting to fail the first user. The
// platform still imports and boots; what it loses are the features that need
// a live link - realtime voice, avatars, meeting bots, streamed calls.
//
// The route is `/channel/<id>?side=<side>[&events=1]`, upgraded to a
// websocket. The scheme is derived from the origin rather than configured -
// `https` becomes `wss`, `http` becomes `ws` - so a deployment cannot end up
// with the two half moved.

import type {
  RelayChannelId,
  RelayChannelOptions,
  RelayChannelSide,
  RelayProvider,
} from '@chatbotkit-dev/relay-spec'

import { RelayError } from './error'
import { type RelayServer, startRelayServer } from './server'

export type * from '@chatbotkit-dev/relay-spec'

export { RelayError }
export * from './server'

const UNCONFIGURED =
  'no realtime relay is configured, so live channels cannot be opened - set RELAY_URL to the origin of a relay speaking the channel protocol (the platform hosts one when RELAY_PORT is set), or override @chatbotkit-dev/relay with a package whose default export satisfies RelayProvider from @chatbotkit-dev/relay-spec'

let cached: URL | undefined

/**
 * @note resolved on first use rather than at import, so the platform can be
 * imported - and boot - without a relay. See packages/AGENTS.md.
 *
 * @throws `NOT_CONFIGURED` when RELAY_URL is unset, malformed or not a web
 * origin
 */
function getBaseUrl(): URL {
  if (!cached) {
    const value = process.env.RELAY_URL

    if (!value) {
      throw new RelayError('NOT_CONFIGURED', UNCONFIGURED)
    }

    let url: URL

    try {
      url = new URL(value)
    } catch {
      throw new RelayError(
        'NOT_CONFIGURED',
        `RELAY_URL is ${JSON.stringify(value)}, which is not a URL, so realtime channels cannot be opened`
      )
    }

    if (url.protocol === 'https:') {
      url.protocol = 'wss:'
    } else if (url.protocol === 'http:') {
      url.protocol = 'ws:'
    } else if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      throw new RelayError(
        'NOT_CONFIGURED',
        `RELAY_URL is ${value}, which does not yield a websocket address, so realtime channels cannot be opened`
      )
    }

    cached = url
  }

  return cached
}

/**
 * @note exported for the tests, which vary the environment per case.
 */
export function resetEnv(): void {
  cached = undefined
}

/**
 * The address a side dials to join a channel.
 *
 * @throws `NOT_CONFIGURED` when RELAY_URL is unset or malformed
 */
export function channelUrl(
  channelId: RelayChannelId,
  side: RelayChannelSide,
  options: RelayChannelOptions = {}
): string {
  let base: URL

  try {
    base = getBaseUrl()
  } catch (error) {
    if (error instanceof RelayError) {
      throw new RelayError(error.code, error.message, {
        detail: `cannot address channel ${channelId} for side ${side}`,
        cause: error,
      })
    }

    throw error
  }

  const url = new URL(`/channel/${encodeURIComponent(channelId)}`, base)

  url.searchParams.set('side', side)

  if (options.events) {
    url.searchParams.set('events', '1')
  }

  return url.toString()
}

/**
 * @note reads the variable rather than dialling. The relay's answer to a
 * request is a websocket upgrade, and opening one from a readiness check
 * would leave a channel occupied by a side that never speaks.
 */
export async function assertConfigured(): Promise<void> {
  try {
    getBaseUrl()
  } catch (error) {
    throw new Error(
      `@chatbotkit-dev/relay is the community default and ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

let listening: Promise<RelayServer> | undefined

/**
 * Hosts the relay in this process when RELAY_PORT is set; a no-op otherwise.
 *
 * @note once per process. The development server can evaluate the caller
 * more than once, and a second listener on the same port would only fail.
 */
export async function listen(): Promise<void> {
  const value = process.env.RELAY_PORT

  if (!value) {
    return
  }

  const port = Number(value)

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(
      `RELAY_PORT is ${JSON.stringify(value)}, which is not a port number, so the relay cannot listen`
    )
  }

  if (!listening) {
    listening = startRelayServer({ port, host: process.env.RELAY_HOST })
  }

  await listening
}

const provider: RelayProvider = {
  channelUrl,
  listen,
  assertConfigured,
}

export default provider
