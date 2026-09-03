import type {
  PublishChannelMessageOptions,
  StreamChannelEventsOptions,
  WaitForChannelMessageOptions,
} from '@/lib/channel.core'
import {
  publishChannelMessage as _publishChannelMessage,
  streamChannelEvents as _streamChannelEvents,
  waitForChannelMessage as _waitForChannelMessage,
} from '@/lib/channel.core'
import debug from '@/lib/debug'

export type {
  StreamChannelEventsOptions,
  WaitForChannelMessageOptions,
  PublishChannelMessageOptions,
}

export function makeSessionChannelId(
  session: { id: string }, // @todo add more specific type
  channelId: string
) {
  channelId = `session[${session.id}]:channel[${channelId}]`

  debug(`using session channel id`, { channelId }).log(
    'channel.session.makeSessionChannelId'
  )

  return channelId
}

/**
 * Stream channel events within a session context.
 *
 * @param session
 * @param channelId
 * @param options - Optional streaming options including history length
 * @returns
 */
export async function* streamChannelEvents(
  session: { id: string }, // @todo add more specific type
  channelId: string,
  options?: StreamChannelEventsOptions
) {
  debug(`streaming session channel events`, {
    sessionId: session.id,
    channelId: channelId,
  }).log('channel.session.streamChannelEvents')

  channelId = makeSessionChannelId(session, channelId)

  yield* _streamChannelEvents(channelId, options)
}

/**
 * Wait for a message on a channel within a session context.
 *
 * @param session
 * @param channelId
 * @param options
 * @returns
 */
export async function waitForChannelMessage(
  session: { id: string }, // @todo add more specific type
  channelId: string,
  options?: WaitForChannelMessageOptions
) {
  debug(`waiting for session channel message`, {
    sessionId: session.id,
    channelId: channelId,
  }).log('channel.session.waitForChannelMessage')

  channelId = makeSessionChannelId(session, channelId)

  return await _waitForChannelMessage(channelId, options)
}

/**
 * Publish a message to a channel within a session context.
 *
 * @param session
 * @param channelId
 * @param message
 * @param options - Optional settings for message persistence (history)
 * @returns
 */
export async function publishChannelMessage(
  session: { id: string }, // @todo add more specific type
  channelId: string,
  message: Record<string, unknown>,
  options?: PublishChannelMessageOptions
) {
  debug(`publishing session channel message`, {
    sessionId: session.id,
    channelId: channelId,
    message: message,
  }).log('channel.session.publishChannelMessage')

  channelId = makeSessionChannelId(session, channelId)

  return await _publishChannelMessage(channelId, message, options)
}
