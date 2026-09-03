// @note the community default for realtime channels, and it refuses.
//
// A relay is a process that accepts two websocket connections and copies bytes
// between them. That is not something a package can be - it needs somewhere to
// listen that both sides can reach, and a lifetime longer than the request that
// asked for the address. Every approximation available here is worse than
// saying so:
//
//   point at localhost   - works on one developer's machine and silently fails
//                          for every browser that is not on it.
//
//   return a URL anyway  - the caller hands it to a browser, which fails to
//                          connect somewhere the platform never sees, and the
//                          conversation simply never starts.
//
// So `channelUrl` throws `NOT_CONFIGURED` naming the override point, and
// `assertConfigured` throws too, rather than following `@chatbotkit-dev/email`
// and resolving anyway: a module that cannot serve any request
// should fail the deployment's readiness check instead of waiting to fail the
// first user.
//
// The platform still imports and boots on this. What it loses are the features
// that need a live link - realtime voice, meeting bots, streamed calls - which
// fail at the point of use with a message naming what to install.

import type {
  RelayChannelId,
  RelayChannelOptions,
  RelayChannelSide,
  RelayProvider,
} from '@chatbotkit-dev/relay-spec'

import { RelayError } from './error'

export type * from '@chatbotkit-dev/relay-spec'

export { RelayError }

// @note the parameters below are named for the contract rather than for what
// this implementation does with them, which is nothing
/* eslint-disable unused-imports/no-unused-vars */

const UNCONFIGURED =
  'no realtime relay is installed, so live channels cannot be opened - override @chatbotkit-dev/relay with a package whose default export satisfies RelayProvider from @chatbotkit-dev/relay-spec'

/**
 * Refuses, because there is nowhere for two sides to meet.
 *
 * @throws always, with `NOT_CONFIGURED`
 */
export function channelUrl(
  channelId: RelayChannelId,
  side: RelayChannelSide,
  options?: RelayChannelOptions
): string {
  throw new RelayError('NOT_CONFIGURED', UNCONFIGURED, {
    detail: `cannot address channel ${channelId} for side ${side}`,
  })
}

/**
 * @note throws, unlike most public defaults. Nothing can be served from this
 * module, so it fails the deployment's readiness check rather than letting the
 * first realtime conversation discover it.
 */
export async function assertConfigured(): Promise<void> {
  throw new Error(
    `@chatbotkit-dev/relay is the community default and ${UNCONFIGURED}`
  )
}

const provider: RelayProvider = {
  channelUrl,
  assertConfigured,
}

export default provider
