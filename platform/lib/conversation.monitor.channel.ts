import type {
  PublishChannelMessageOptions,
  StreamChannelEventsOptions,
} from '@/lib/channel.user'
import { publishChannelMessage, streamChannelEvents } from '@/lib/channel.user'
import {
  createSinkEvent,
  type EngineSinkItem,
  type Sink,
  TAG_ABORT,
  TAG_COMPLETE_BEGIN,
  TAG_COMPLETE_END,
  TAG_ERROR,
  TAG_MESSAGE,
  TAG_OPERATION_BEGIN,
  TAG_OPERATION_END,
} from '@/lib/conversation.tag'
import debug from '@/lib/debug'
import { captureError, captureUnexpectedState } from '@/lib/error'
import { sleep } from '@/lib/promise'

export type { StreamChannelEventsOptions }

// --- Constants ---

/**
 * History retained on the monitor channel so a console that opens mid-flight
 * can replay the recent lifecycle before following live. Kept small on purpose -
 * this is a lightweight monitor feed, not a durable event log.
 */
export const CONVERSATION_MONITOR_CHANNEL_HISTORY_LENGTH = 100
export const CONVERSATION_MONITOR_CHANNEL_HISTORY_EXPIRE_SECONDS = 60 * 60

/**
 * Curated set of engine event types forwarded to the monitor channel. The
 * high-frequency token/audio events (TAG_TOKEN, TAG_REASONING_TOKEN, TAG_AUDIO)
 * and TAG_PING are intentionally excluded so the feed stays cheap and readable -
 * a per-token firehose can be layered on later behind a presence gate.
 */
const MONITORED_EVENT_TYPES = new Set<string>([
  TAG_COMPLETE_BEGIN,
  TAG_COMPLETE_END,
  TAG_MESSAGE,
  TAG_OPERATION_BEGIN,
  TAG_OPERATION_END,
  TAG_ERROR,
  TAG_ABORT,
])

// --- Types ---

type ConversationMonitorChannelMessage = Record<string, unknown>

// --- Helpers ---

/**
 * The channel name (within the user scope) used to monitor a conversation.
 */
export function getConversationMonitorChannelName(
  conversationId: string
): string {
  return `conversation[${conversationId}]:monitor`
}

function getHistoryOptions(): PublishChannelMessageOptions {
  return {
    historyLength: CONVERSATION_MONITOR_CHANNEL_HISTORY_LENGTH,
    historyExpireSeconds: CONVERSATION_MONITOR_CHANNEL_HISTORY_EXPIRE_SECONDS,
  }
}

// --- Stream ---

/**
 * Backoff before retrying a subscribe that dropped almost immediately (the
 * upstream is rejecting us); a healthy subscribe never hits this path.
 */
const MONITOR_RECONNECT_BACKOFF_MS = 1000

/**
 * A healthy live subscribe lasts minutes - until the conversation produces an
 * event or the idle body timeout fires. Connections shorter than this are
 * treated as failed attempts for the hot-loop guard below.
 */
const MONITOR_MIN_HEALTHY_CONNECTION_MS = 5000

/**
 * After this many consecutive sub-{@link MONITOR_MIN_HEALTHY_CONNECTION_MS}
 * reconnects we stop and report, rather than spin reconnecting forever.
 */
const MONITOR_MAX_RAPID_RECONNECTS = 5

/**
 * Whether an error thrown while reading the channel SSE body is a benign,
 * expected end of a long-lived subscribe rather than a real failure.
 *
 * The live subscribe is a long-lived Upstash SSE `fetch` running on Node's
 * built-in undici, which drops an *idle* response body after ~300s with
 * `UND_ERR_BODY_TIMEOUT` - surfaced as `TypeError: terminated`. A quiet
 * conversation publishes nothing, so this is normal and we reconnect. Genuine
 * connect-time failures (auth, unreachable host) throw different shapes and are
 * NOT benign, so they still surface to the caller.
 */
export function isBenignChannelTermination(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const err = error as {
    name?: string
    message?: string
    code?: string
    cause?: { code?: string }
  }

  // @note undici aborts a terminated/idle response body mid-stream
  if (err.name === 'TypeError' && err.message === 'terminated') {
    return true
  }

  const benignCodes = ['UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET', 'ECONNRESET']

  if (err.code && benignCodes.includes(err.code)) {
    return true
  }

  if (err.cause?.code && benignCodes.includes(err.cause.code)) {
    return true
  }

  return false
}

/**
 * Stream the curated monitor events for a conversation.
 *
 * The underlying live subscribe is a long-lived Upstash SSE `fetch`; Node's
 * undici drops an *idle* response body after ~300s (`UND_ERR_BODY_TIMEOUT` ->
 * `TypeError: terminated`). For a quiet conversation that is expected, not an
 * error, so we transparently re-subscribe and keep the monitor open until the
 * caller aborts (client disconnect) or a genuine error occurs. History is
 * replayed only on the first connect so reconnects don't re-emit it.
 *
 * @param userId - The owning user of the conversation
 * @param conversationId - The conversation to monitor
 * @param options - Optional streaming options including history length
 */
export async function* streamConversationMonitorEvents(
  userId: string,
  conversationId: string,
  options?: StreamChannelEventsOptions
) {
  const channelName = getConversationMonitorChannelName(conversationId)

  const abortSignal = options?.abortSignal

  let first = true
  let rapidReconnects = 0

  while (!abortSignal?.aborted) {
    const startedAt = Date.now()

    try {
      yield* streamChannelEvents(userId, channelName, {
        abortSignal,

        // @note only replay history on the first connect - reconnecting after an
        // idle drop must not re-emit the last batch of events
        historyLength: first ? options?.historyLength : undefined,
      })
    } catch (error) {
      // @note the caller aborted (client disconnected) - end cleanly
      if (abortSignal?.aborted) {
        return
      }

      // @note a real failure (not an idle/transient upstream drop) - surface it
      if (!isBenignChannelTermination(error)) {
        throw error
      }

      debug(`monitor subscribe dropped - reconnecting`, {
        conversationId,
        error,
      }).log('conversation.monitor.channel.streamConversationMonitorEvents')
    }

    first = false

    if (abortSignal?.aborted) {
      return
    }

    // @note guard against a hot reconnect loop: a healthy subscribe lasts
    // minutes, so repeated near-instant connections mean the upstream keeps
    // rejecting us. Throttle, and give up after a few attempts rather than spin.
    if (Date.now() - startedAt < MONITOR_MIN_HEALTHY_CONNECTION_MS) {
      rapidReconnects++

      if (rapidReconnects > MONITOR_MAX_RAPID_RECONNECTS) {
        void captureUnexpectedState(
          `Conversation monitor subscribe reconnect loop`,
          { conversationId, rapidReconnects }
        )

        return
      }

      await sleep(MONITOR_RECONNECT_BACKOFF_MS)
    } else {
      rapidReconnects = 0
    }
  }
}

// --- Sink ---

/**
 * Create a live-monitoring sink for a stateful conversation.
 *
 * The sink receives the full engine firehose, filters it down to a curated
 * lifecycle set, and publishes each surviving event to the conversation's
 * monitor channel fire-and-forget. Monitoring is best-effort observability: it
 * must never block the completion nor surface its errors into the engine, so
 * publishes are not awaited and failures are captured, not thrown.
 */
export function createConversationMonitorSink({
  userId,
  conversationId,
}: {
  userId: string
  conversationId: string
}): Sink {
  const channelName = getConversationMonitorChannelName(conversationId)

  const historyOptions = getHistoryOptions()

  const push = (async (...[type, data]) => {
    const event = createSinkEvent({ type, data } as EngineSinkItem)

    if (MONITORED_EVENT_TYPES.has(type)) {
      debug(`publishing conversation monitor event`, {
        conversationId,
        type,
      }).log('conversation.monitor.channel.createConversationMonitorSink')

      // @note fire-and-forget - never await in the engine's hot path and never
      // let a monitoring failure escape into the completion
      void publishChannelMessage(
        userId,
        channelName,
        event as unknown as ConversationMonitorChannelMessage,
        historyOptions
      ).catch((e) => captureError(e))
    }

    return event
  }) as Sink['push']

  return { push }
}
