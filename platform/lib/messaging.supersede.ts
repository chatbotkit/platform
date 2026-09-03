/**
 * @fileoverview Generic "supersede + soft-yield" for messaging channels.
 *
 * Lets any request/response messaging channel (Slack, Telegram, WhatsApp, …)
 * notice that an in-flight reply has been superseded by a newer message for the
 * same session, and bow out gracefully - both BEFORE generation starts and,
 * mid-turn, via the engine's cooperative `yieldSignal` (see
 * `lib/conversation.engine.js` / `ConversationInput.yieldSignal`).
 *
 * `order` is a per-session, monotonically-increasing number. Two ways to get it:
 *   - NATIVE - the channel's inbound message already has one (Telegram
 *     `update_id`). On the webhook: `messagingSupersede(sessionKey, order).record()`.
 *   - ALLOCATED - it doesn't (Slack threads, Meta/Teams/Twilio opaque ids,
 *     email). On the webhook: `const order = await allocateOrder(sessionKey)`,
 *     then thread `order` into the queued event. This is the universal path.
 *
 * Either way, in the HANDLER bind the identity ONCE with
 * `messagingSupersede(sessionKey, order)` (so the pair can't drift across call
 * sites) and: serialize the queue dispatch with
 * `flow: { key: sessionKey, parallel: 1 }`; `if (await supersede.isSuperseded())
 * return` before generating; `const watch = supersede.watch()`, pass
 * `watch.yieldSignal` to the engine, suppress the post when `watch.didYield()`,
 * and `watch.dispose()` in `finally`.
 *
 * "Latest" is tracked with last-write (NATIVE) / atomic-INCR (ALLOCATED)
 * semantics; under reordering the worst case is a missed yield (the turn runs to
 * completion), never a wrong answer.
 *
 * Why no polling: the cost of polling scales with turn DURATION (wasted reads
 * when nothing changed); this scales with EVENTS. The webhook nudges a
 * per-session channel and the handler watches it. The durable marker exists only
 * for the BEFORE-generation check - the channel is live-only (`historyLength:0`)
 * so it can't see a message that landed before the handler subscribed; mid-turn
 * the nudge carries the order, so no marker re-read is needed.
 */
import {
  publishChannelMessage,
  streamChannelEvents,
} from '@/lib/channel.session'
import memcache from '@/lib/memcache'

// --- Constants ---

// @note the marker only needs to outlive a session's in-flight handlers.
const MARKER_TTL_SECONDS = 60 * 60

// @note fixed sub-channel name; scoped per session via the sessionKey passed as
// the channel-session id, so there is no cross-session or cross-channel clash.
const SUPERSEDE_CHANNEL = 'inbound'

// --- Helpers ---

/**
 * The Redis key for the per-session supersede marker. The marker is the source
 * of truth for the "latest" message; the channel is live-only and can't see a
 * message that landed before the handler subscribed.
 */
function markerKey(sessionKey: string): string {
  return `${sessionKey}-latest`
}

/**
 * Publish a nudge to the session's supersede channel. The nudge carries the
 * order of the latest message, so the handler can compare it to its own and
 * decide whether to soft-yield. The channel is live-only (`historyLength:0`)
 * so it can't see a message that landed before the handler subscribed; the
 * durable marker exists only for the BEFORE-generation check.
 *
 * @note this is a live publish only (no history) - a wake-up, not a durable
 * signal; the marker is the source of truth. Internal to both webhook entry
 * points.
 */
async function publishNudge(sessionKey: string, order: number): Promise<void> {
  await publishChannelMessage({ id: sessionKey }, SUPERSEDE_CHANNEL, { order })
}

/**
 * Allocate a per-session, monotonically-increasing order for an inbound message
 * and nudge any in-flight handler for an earlier one. For channels whose inbound
 * messages carry NO usable native order - Slack threads (the carried ts is the
 * thread root, constant within a thread), the Meta/Teams/Twilio opaque ids,
 * email, … Call on the immediate (webhook) path and thread the returned order
 * into the queued event so the handler can hand it to `messagingSupersede`.
 *
 * The atomic INCR counter doubles as the supersede marker, so this needs no
 * separate key. Providers that DO have a native per-session monotonic number
 * (e.g. Telegram `update_id`) should instead use
 * `messagingSupersede(sessionKey, order).record()` and skip the INCR.
 */
export async function allocateOrder(sessionKey: string): Promise<number> {
  const order = await memcache.incr(markerKey(sessionKey))

  // @note INCR creates the key if absent; bound its lifetime to in-flight
  // handlers (the same window the marker matters for).
  await memcache.expire(markerKey(sessionKey), MARKER_TTL_SECONDS)

  await publishNudge(sessionKey, order)

  return order
}

// --- Interfaces ---

export interface SupersedeWatch {
  /**
   * Pass to the engine as `yieldSignal`. Tripped when a newer message arrives;
   * the engine then stops at its next iteration boundary (valid state).
   */
  yieldSignal: AbortSignal

  /**
   * True once a newer message tripped the soft-yield. Check after the turn.
   */
  didYield(): boolean

  /**
   * Stop watching and tear down the subscription. Call in `finally`.
   */
  dispose(): Promise<void>
}

export interface MessagingSupersede {
  /**
   * Record this message as the session's latest and nudge any in-flight handler
   * for an earlier message. Call on the immediate (webhook) path.
   */
  record(): Promise<void>

  /**
   * Has a newer message for this session been recorded since this one?
   */
  isSuperseded(): Promise<boolean>

  /**
   * Watch the session channel for the duration of a turn (event-driven, no
   * polling) and trip a soft-yield when a newer message arrives.
   */
  watch(): SupersedeWatch
}

// --- Implementation ---

/**
 * Bind the supersede + soft-yield operations to a single messaging turn,
 * identified by its `sessionKey` and a per-session monotonic `order`. Binding
 * once means the webhook and the handler can't accidentally pass a mismatched
 * key/order pair.
 */
export function messagingSupersede(
  sessionKey: string,
  order: number
): MessagingSupersede {
  return {
    record: async () => {
      await memcache.set(markerKey(sessionKey), order, { ex: MARKER_TTL_SECONDS })

      await publishNudge(sessionKey, order)
    },

    isSuperseded: async (): Promise<boolean> => {
      const latest = await memcache.get(markerKey(sessionKey))

      return latest != null && Number(latest) > order
    },

    watch: () => {
      const yieldController = new AbortController()
      const watchAbort = new AbortController()

      const watch = (async () => {
        try {
          for await (const event of streamChannelEvents(
            { id: sessionKey },
            SUPERSEDE_CHANNEL,
            { historyLength: 0, abortSignal: watchAbort.signal }
          )) {
            // @note compare the order carried in the nudge itself - a genuinely
            // newer message has a higher order; our own redelivery carries the
            // same order and is ignored. No marker re-read needed mid-turn.
            if (event.type === 'message' && Number(event.data?.order) > order) {
              yieldController.abort()

              return
            }
          }
        } catch {
          // @note aborted on dispose(), or a transient channel error - either
          // way we just don't soft-yield (the turn runs to completion), fine.
        }
      })()

      return {
        yieldSignal: yieldController.signal,

        didYield: () => yieldController.signal.aborted,

        dispose: async () => {
          watchAbort.abort()

          await watch
        },
      }
    },
  }
}
