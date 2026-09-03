// @note the platform's side of realtime channels.
//
// Where two sides meet is now `@chatbotkit-dev/relay`. What is left here is
// naming the meeting point, which stays with the platform for the same reason
// `sandboxId` does: the name is what correlates a channel with the conversation
// that caused it, and no relay has any use for that correlation.

import relay from '@chatbotkit-dev/relay'

import cuid from '@/lib/cuid'

interface RealtimeRelayOptions {
  events?: boolean
}

/**
 * Creates a unique channel ID for realtime relay
 *
 * @note two cuids rather than one. A channel id is quoted by both sides and one
 * of them is a browser, so it is guessable-by-enumeration in a way a database
 * key is not - the second half is what makes joining someone else's channel
 * require the id rather than a neighbouring one.
 */
export function createRealtimeRelayChannelId(): string {
  return `realtime-${cuid()}-${cuid()}`
}

/**
 * Creates a WebSocket URL for a realtime relay channel
 */
export function createRealtimeRelayChannelUrl(
  channelId: string,
  side: string,
  options: RealtimeRelayOptions = {}
): string {
  return relay.channelUrl(channelId, side, options)
}
