import platform from '@/config/platform'

import debug from '@/lib/debug'
import { captureException } from '@/lib/error'
import memcache from '@/lib/memcache'

/**
 * Pseudo user id used to namespace platform-wide usage counters. Reuses the
 * per-user `usage-<id>-<type>` key shape so the platform counter expires on the
 * same monthly window as user counters.
 */
export const PLATFORM_USAGE_USER_ID = 'platform'

/**
 * The base usage type tracked against the platform token budget.
 */
export const PLATFORM_TOKEN_USAGE_TYPE = 'token'

/**
 * Represents a user for the purposes of logging and error reporting.
 */
interface User {
  id: string
}

/**
 * Redis key holding the platform-wide token usage for the current billing
 * period. Must match the `getUsageKey` format in `@/lib/usage.record`; defined
 * here (rather than imported) to avoid a circular dependency, since
 * `usage.record` imports this module to increment the counter.
 */
export function getPlatformTokenUsageKey(): string {
  return `usage-${PLATFORM_USAGE_USER_ID}-${PLATFORM_TOKEN_USAGE_TYPE}`
}

/**
 * Returns whether the platform is within its monthly token budget. Returns
 * `false` once platform-wide token usage has reached `maxTokensPerMonth` (see
 * `@/config/platform`). The budget applies to every request without exception.
 *
 * Fails open: if the usage counter cannot be read (e.g. during a Redis
 * incident) the platform is assumed to be within budget, so an infrastructure
 * blip does not itself become a platform-wide outage. This mirrors the
 * fail-open behaviour of the sliding-window rate limiter.
 */
export async function platformBudgetOk(user?: User): Promise<boolean> {
  if (process.env.SKIP_LIMITS_CHECK) {
    return true
  }

  const max = platform.maxTokensPerMonth

  // cap disabled
  {
    if (!Number.isFinite(max)) {
      return true
    }
  }

  let usage: number

  try {
    usage = Number(await memcache.get(getPlatformTokenUsageKey())) || 0
  } catch (e) {
    // fail open on infrastructure errors
    await captureException(e)

    return true
  }

  if (usage < max) {
    return true
  }

  debug(`platform token budget exhausted, blocking request`, {
    user,
    usage,
    max,
  }).log('limit.platform.platformBudgetOk')

  return false
}
