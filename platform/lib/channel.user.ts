import type {
  PublishChannelMessageOptions,
  StreamChannelEventsOptions,
} from '@/lib/channel.core'
import {
  publishChannelMessage as _publishChannelMessage,
  streamChannelEvents as _streamChannelEvents,
} from '@/lib/channel.core'
import debug from '@/lib/debug'

export type { StreamChannelEventsOptions, PublishChannelMessageOptions }

/**
 * Create a user-scoped channel ID for event streaming.
 *
 * @param userId - The user ID
 * @param channelName - The name of the channel (e.g., 'events')
 * @returns The scoped channel ID
 */
export function makeUserChannelId(userId: string, channelName: string): string {
  const channelId = `user[${userId}]:channel[${channelName}]`

  debug(`using user channel id`, { channelId }).log(
    'channel.user.makeUserChannelId'
  )

  return channelId
}

/**
 * Stream channel events within a user context.
 *
 * @param userId - The user ID
 * @param channelName - The name of the channel
 * @param options - Optional streaming options including history length
 */
export async function* streamChannelEvents(
  userId: string,
  channelName: string,
  options?: StreamChannelEventsOptions
) {
  debug(`streaming user channel events`, {
    userId: userId,
    channelName: channelName,
  }).log('channel.user.streamChannelEvents')

  const channelId = makeUserChannelId(userId, channelName)

  yield* _streamChannelEvents(channelId, options)
}

/**
 * Publish a message to a channel within a user context.
 *
 * @param userId - The user ID
 * @param channelName - The name of the channel
 * @param message - The message to publish
 * @param options - Optional settings for message persistence (history)
 */
export async function publishChannelMessage(
  userId: string,
  channelName: string,
  message: Record<string, unknown>,
  options?: PublishChannelMessageOptions
) {
  debug(`publishing user channel message`, {
    userId: userId,
    channelName: channelName,
    message: message,
  }).log('channel.user.publishChannelMessage')

  const channelId = makeUserChannelId(userId, channelName)

  return await _publishChannelMessage(channelId, message, options)
}
