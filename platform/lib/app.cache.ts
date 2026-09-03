import { ONE_MINUTE_IN_SECONDS } from '@chatbotkit-dev/time'

import type { StoreSession } from '@/lib/app.context'
import { APP_AUDIENCE } from '@/lib/audience.consts'
import { ttlCache } from '@/lib/cache'

/**
 * Caches the result of a function call. The cache key is generated based on the
 * app, category, and session ID.
 */
export async function withCache<T>(
  fn: () => Promise<T>,
  {
    app,
    category,
    session,
    timeInSeconds = ONE_MINUTE_IN_SECONDS,
  }: {
    app: string
    category: string
    session: StoreSession
    timeInSeconds?: number
  }
): Promise<T> {
  // @note the key is scoped by the resolved user (`session.user.id`) in addition
  // to `session.id`. A single `session.id` can resolve to different effective
  // users over its lifetime - the dashboard account/team switcher (run-as via
  // cookie) swaps `session.user` without changing `session.id` - so keying by
  // `session.id` alone lets one account's cached value (e.g. a contact id) leak
  // to another for the full TTL. This poisoned the chat contact cache and broke
  // conversation ownership checks.
  return ttlCache<T>(
    `app[${app}]:category[${category}]:session[${session.id}]:user[${session.user.id}]`,
    timeInSeconds,
    fn
  )
}

/**
 * Caches the result of a function call. The cache key is generated based on the
 * app, category, and session ID, but only if the session's audience matches
 * the APP_AUDIENCE.
 */
export async function withAppAudienceCache<T>(
  fn: () => Promise<T>,
  {
    app,
    category,
    session,
    timeInSeconds = ONE_MINUTE_IN_SECONDS,
  }: {
    app: string
    category: string
    session: StoreSession
    timeInSeconds?: number
  }
): Promise<T> {
  if (session.payload.aud === APP_AUDIENCE) {
    return withCache(fn, {
      app,
      category,
      session,
      timeInSeconds,
    })
  } else {
    return fn()
  }
}
