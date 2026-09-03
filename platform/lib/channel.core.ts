import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import debug from '@/lib/debug'
import { SystemError, captureUnexpectedState } from '@/lib/error'
import { ABORT_ERROR_NAME, AbortError, anySignal } from '@/lib/fetch'
import {
  stringify as stringifyJson,
  tryParse as tryParseJson,
} from '@/lib/json'
import memcache from '@/lib/memcache'
import type { ZodSchemaFor } from '@/lib/zod.schema'
import { z } from '@/lib/zod.schema'

/**
 * Default expiry time for history streams in seconds (1 hour). This ensures
 * streams don't accumulate indefinitely if not explicitly set.
 */
export const DEFAULT_HISTORY_EXPIRE_SECONDS = 60 * 60

/**
 * Subscribe event type for streaming and messaging.
 */
export type SubscribeChannelEvent = {
  type: 'subscribe'
  channel: string
}

/**
 * Message event type for streaming and messaging.
 */
export type MessageChannelEvent = {
  type: 'message'
  channel: string
  data: Record<string, unknown>
}

/**
 * Channel event types for streaming and messaging.
 */
export type ChannelEvent = SubscribeChannelEvent | MessageChannelEvent

/**
 * Get the history key for a channel. All channel-related keys are namespaced
 * under 'channel:' to prevent conflicts with other Redis keys.
 */
function getHistoryKey(channel: string): string {
  return `channel:history:${channel}`
}

/**
 * Get the stream key for pub/sub. All channel-related keys are namespaced
 * under 'channel:' to prevent conflicts with other Redis keys.
 */
function getStreamKey(channel: string): string {
  return `channel:stream:${channel}`
}

/**
 * Encode history message
 */
function encodeHistoryMessage(
  message: Record<string, unknown>
): Record<string, unknown> {
  return message // @note we are not doing any encoding at the moment
}

/**
 * Decode history message
 */
function decodeHistoryMessage(
  message: Record<string, unknown>
): Record<string, unknown> {
  return message // @note we are not doing any decoding at the moment
}

/**
 * Encode stream message
 */
function encodeStreamMessage(
  message: Record<string, unknown>
): Record<string, unknown> {
  return message // @note we are not doing any encoding at the moment
}

/**
 * Decode stream message
 */
function decodeStreamMessage(
  message: Record<string, unknown>
): Record<string, unknown> {
  return message // @note we are not doing any decoding at the moment
}

/**
 * Redis history message schema for parsing incoming messages.
 */
const redisHistoryMessageSchema = z.object({
  _hm: z.record(z.string(), z.unknown()),
} satisfies ZodSchemaFor<{ _hm: ReturnType<typeof encodeHistoryMessage> }>)

type RedisHistoryMessageSchema = z.infer<typeof redisHistoryMessageSchema>

/**
 * Redis stream message schema for parsing incoming messages.
 */
const redisStreamMessageSchema = z.object({
  _sm: z.record(z.string(), z.unknown()),
} satisfies ZodSchemaFor<{ _sm: ReturnType<typeof encodeStreamMessage> }>)

type RedisStreamMessageSchema = z.infer<typeof redisStreamMessageSchema>

// --- stream ---

/**
 * Options for streaming channel events.
 */
export type StreamChannelEventsOptions = {
  abortSignal?: AbortSignal
  /**
   * When provided, enables message history replay from the beginning of the
   * stream. This is useful for dispatch scenarios where the client may connect
   * after events have started being published.
   */
  historyLength?: number
}

/**
 * Stream events from a channel. When `historyLength` is provided, will first
 * replay historical messages from the Redis Stream before streaming new ones
 * via pub/sub.
 *
 * @param channel - The channel name to subscribe to
 * @param options - Streaming options including abort signal and history length
 * @yields Channel events (subscribe confirmation and messages)
 */
export async function* streamChannelEvents(
  channel: string,
  options?: StreamChannelEventsOptions
): AsyncGenerator<ChannelEvent> {
  debug(`streaming channel events`, { channel, options }).log(
    'channel.core.streamChannelEvents'
  )

  // If history is requested, replay historical messages first from Redis Stream

  if (options?.historyLength && options.historyLength > 0) {
    const historyKey = getHistoryKey(channel)

    debug(`fetching history from stream`, {
      channel: channel,
      limit: options.historyLength,
      historyKey: historyKey,
    }).log('channel.core.streamChannelEvents')

    try {
      // @note xrevrange returns newest first, so we reverse to yield chronologically

      const history = await memcache.xrevrange(
        historyKey,
        '+',
        '-',
        options.historyLength
      )

      debug(`retrieved history messages`, {
        channel: channel,
        limit: options.historyLength,
        historyKey: historyKey,
        length: Object.keys(history).length,
      }).log('channel.core.streamChannelEvents')

      for (const [_id, data] of Object.entries(history).reverse()) {
        const result = redisHistoryMessageSchema.safeParse(data)

        if (!result.success) {
          void captureUnexpectedState(`Invalid history message format`, data)

          // @note it is ok to skip invalid messages - we don't expect this to
          // happen at all but we want to be resilient

          continue
        }

        const message = decodeHistoryMessage(result.data._hm)

        const event: MessageChannelEvent = {
          type: 'message',
          channel: channel,
          data: message,
        }

        yield event
      }
    } catch (e) {
      debug(`error fetching history`, { error: e }).log(
        'channel.core.streamChannelEvents'
      )

      // @note continue without history if stream doesn't exist yet
    }
  }

  // Now subscribe to real-time messages via pub/sub, through the key-value
  // module: which wire that is - a Redis connection, a vendor's SSE stream,
  // an in-process emitter - belongs to the installed backend.

  const streamKey = getStreamKey(channel)

  debug(`subscribing to stream`, { channel, streamKey }).log(
    'channel.core.streamChannelEvents'
  )

  const abortSignal = options?.abortSignal

  if (abortSignal?.aborted) {
    throw new AbortError('channel stream aborted')
  }

  const events: ChannelEvent[] = []

  let closed = false
  let closeError: unknown

  let notify: (() => void) | undefined

  const wake = () => {
    const pending = notify

    notify = undefined

    pending?.()
  }

  const subscription = await memcache.subscribe(streamKey, {
    onMessage: (raw) => {
      debug(`received data`, { data: raw }).log(
        'channel.core.streamChannelEvents'
      )

      const result = redisStreamMessageSchema.safeParse(tryParseJson(raw))

      if (!result.success) {
        void captureUnexpectedState(`Invalid stream message format`, raw)

        return
      }

      const event: MessageChannelEvent = {
        type: 'message',
        channel: streamKey,
        data: decodeStreamMessage(result.data._sm),
      }

      debug(`received channel event`, { channelEvent: event }).log(
        'channel.core.streamChannelEvents'
      )

      events.push(event)

      wake()
    },

    onClose: (error) => {
      closed = true
      closeError = error

      wake()
    },
  })

  // @note the subscription promise resolves once the backend confirms the
  // subscription is active, which is what this event has always meant:
  // publishes from here on will be observed

  events.push({ type: 'subscribe', channel: streamKey })

  const onAbort = () => wake()

  abortSignal?.addEventListener('abort', onAbort)

  try {
    for (;;) {
      while (events.length) {
        yield events.shift() as ChannelEvent
      }

      if (abortSignal?.aborted) {
        throw new AbortError('channel stream aborted')
      }

      if (closed) {
        if (closeError) {
          throw closeError
        }

        return
      }

      await new Promise<void>((resolve) => {
        notify = resolve
      })
    }
  } finally {
    abortSignal?.removeEventListener('abort', onAbort)

    await subscription.unsubscribe()
  }
}

// --- wait ---

/**
 * Maximum number of retries when waiting for a channel message.
 */
const WAIT_FOR_MAX_DEPTH = 10

/**
 * Options for waiting for a channel message.
 */
export type WaitForChannelMessageOptions = StreamChannelEventsOptions & {
  onSubscribe?: () => Promise<void> | void

  maxDepth?: number

  _wasAborted?: boolean // @note internal flag to track if channel was aborted
}

/**
 * Wait for a single message on a channel.
 *
 * @param channel - The channel name to wait on
 * @param options - Wait options including callbacks and retry depth
 * @returns The first message received on the channel
 */
export async function waitForChannelMessage(
  channel: string,
  options?: WaitForChannelMessageOptions
): Promise<Record<string, unknown>> {
  debug(`waiting for channel message`, { channel, options }).log(
    'channel.core.waitForChannelMessage'
  )

  const abortController = new AbortController()

  let wasAborted = options?._wasAborted ?? false

  try {
    for await (const event of streamChannelEvents(channel, {
      abortSignal: anySignal([abortController.signal, options?.abortSignal]),
      historyLength: options?.historyLength,
    })) {
      switch (event.type) {
        case 'subscribe': {
          debug(`received subscribe event`, { event }).log(
            'channel.core.waitForChannelMessage'
          )

          await options?.onSubscribe?.()

          break
        }

        case 'message': {
          debug(`received message event`, { event }).log(
            'channel.core.waitForChannelMessage'
          )

          const message = event.data

          debug(`received message`, { message }).log(
            'channel.core.waitForChannelMessage'
          )

          return message
        }

        default: {
          assertUnreachable(event)
        }
      }
    }
  } catch (e) {
    if (e instanceof AbortError || (e as Error).name === ABORT_ERROR_NAME) {
      // @note track abort to provide better error context later

      wasAborted = true
    } else {
      throw e
    }
  } finally {
    abortController.abort()
  }

  // @note if the caller's abort signal is already aborted, retrying would be
  // pointless since all subsequent attempts will immediately fail too

  if (options?.abortSignal?.aborted) {
    throw new SystemError(
      'No message received: channel wait was aborted (likely timeout)',
      'no_message_received_aborted'
    )
  }

  const currentDepth = options?.maxDepth ?? WAIT_FOR_MAX_DEPTH

  if (currentDepth <= 0) {
    if (wasAborted) {
      // @todo come up with a better / more standard error code and message

      throw new SystemError(
        'No message received: channel wait was aborted (likely timeout)',
        'no_message_received_aborted'
      )
    }

    throw new SystemError('No message received', 'no_message_received')
  }

  return await waitForChannelMessage(channel, {
    ...options,

    maxDepth: currentDepth - 1,

    _wasAborted: wasAborted, // @note pass abort state to recursive call
  })
}

// --- publish ---

/**
 * Options for publishing a channel message.
 */
export type PublishChannelMessageOptions = {
  /**
   * When provided, the message will be stored in a Redis Stream for history
   * replay. The stream will be trimmed to keep at most this many messages.
   */
  historyLength?: number
  /**
   * The stream will expire after this many seconds of inactivity.
   * Defaults to 1 hour (3600 seconds) if not provided.
   */
  historyExpireSeconds?: number
}

/**
 * Publish a message to a channel. When historyLength is configured on the
 * subscriber, messages are also stored in a Redis Stream for replay.
 *
 * @param channel - The channel name to publish to
 * @param message - The message content
 * @param options - Optional settings for message persistence
 */
export async function publishChannelMessage(
  channel: string,
  message: Record<string, unknown>,
  options?: PublishChannelMessageOptions
): Promise<void> {
  debug(`publishing channel message`, { channel, message, options }).log(
    'channel.core.publishChannelMessage'
  )

  // If history is enabled, also store in Redis Stream

  if (options?.historyLength && options.historyLength > 0) {
    const historyKey = getHistoryKey(channel)

    debug(`storing message in history stream`, {
      historyKey,
      message,
      options,
    }).log('channel.core.publishChannelMessage')

    const data: RedisHistoryMessageSchema = {
      _hm: encodeHistoryMessage(message),
    }

    // Add to stream with automatic trimming

    await memcache.xadd(historyKey, '*', data, {
      trim: {
        type: 'MAXLEN',
        threshold: options.historyLength,
        comparison: '~', // Approximate trimming for better performance
      },
    })

    // Always set expiry to prevent streams from accumulating indefinitely

    const expireSeconds =
      options.historyExpireSeconds ?? DEFAULT_HISTORY_EXPIRE_SECONDS

    // @todo setup assertion to ensure we don't store forever or for long periods of time

    await memcache.expire(historyKey, expireSeconds)
  }

  const streamKey = getStreamKey(channel)

  debug(`publishing message to stream`, {
    streamKey,
    message,
  }).log('channel.core.publishChannelMessage')

  const data: RedisStreamMessageSchema = {
    _sm: encodeStreamMessage(message),
  }

  await memcache.publish(streamKey, stringifyJson(data))
}
