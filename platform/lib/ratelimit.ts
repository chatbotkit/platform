import type { Duration } from '@chatbotkit-dev/memcache-spec'

import debug from '@/lib/debug'
import memcache from '@/lib/memcache'

/**
 * Consumes one token against a sliding window, answering whether the caller is
 * still within its limit.
 *
 * @note this used to build an `@upstash/ratelimit` limiter here and hand it the
 * key-value client. That made the client's *identity* part of the platform's
 * dependencies rather than its command surface - the library reaches into it
 * for `eval` and `evalsha` - so no amount of describing commands in a contract
 * would have made it swappable. Rate limiting is now the operation, and where
 * the counting happens belongs to whichever module is installed.
 */
export async function slidingWindow(
  key: string,
  tokens: number,
  window: Duration
): Promise<{ success: boolean }> {
  debug(`ratelimit`, { key, tokens, window }).log('lib.ratelimit.slidingWindow')

  return await memcache.slidingWindow(key, tokens, window)
}
