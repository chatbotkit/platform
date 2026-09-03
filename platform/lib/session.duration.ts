import { ONE_DAY_IN_SECONDS } from '@chatbotkit-dev/time'

export interface SessionDurationPolicy {
  /**
   * Whether the session→conversation mapping should be persisted (and looked
   * up) in Redis. `false` means "no session": every event starts a fresh
   * conversation and nothing is carried over.
   */
  persist: boolean

  /**
   * The Redis `EX` value (in seconds) to use when `persist` is `true`. Always
   * `>= 1`. Meaningless (and `0`) when `persist` is `false`.
   */
  ttlSecs: number
}

/**
 * Resolve a `sessionDuration` (in milliseconds) into a Redis session policy.
 *
 * The semantics deliberately distinguish "unset" from an explicit zero:
 *
 * - `null` / `undefined` → **auto**: persist with the default 1 day TTL. This
 *   is what you get when the user never picks a duration.
 * - `0` → **no session**: do not persist or look up the mapping, so every
 *   event starts a fresh conversation. A literal `0` second TTL is not an
 *   option anyway - Redis rejects `EX <= 0` - so `0` is reserved for this
 *   "no session" meaning.
 * - `> 0` → persist for that many seconds, floored to `1` so sub-second
 *   durations never round down to an invalid `EX 0`.
 */
export function resolveSessionDuration(
  sessionDuration: number | null | undefined
): SessionDurationPolicy {
  if (sessionDuration === 0) {
    return { persist: false, ttlSecs: 0 }
  }

  if (sessionDuration == null) {
    return { persist: true, ttlSecs: ONE_DAY_IN_SECONDS }
  }

  return {
    persist: true,
    ttlSecs: Math.max(1, Math.round(sessionDuration / 1000)),
  }
}
