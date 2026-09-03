import { hasPlans } from '@/config/limits'

import {
  hasSubscription,
  isBillingConfigured,
  isSellable,
} from '@/lib/billing.core'
import { withAny } from '@/lib/method'
import { noSubscription, notFound } from '@/lib/response'
import type { Session } from '@/lib/session.get'
import { withSession } from '@/lib/session.handler'
import { fastGetUserById } from '@/lib/user.get'

// @note the deployment-level billing gate. A deployment that does not sell
// (no SUBSCRIPTIONS_CONFIG) or has no payment provider must serve no billing
// route - absent, not present-and-failing - so this wraps each
// `pages/api/billing/*` handler outside the session wrapper: the route 404s
// before authentication even runs, exactly as if it did not exist. Per-user
// refusal (child Users and the like) stays where it always was, in
// `canDoBilling`.
//
// @note the 404 goes through `withAny` like every other response: the wrapped
// handlers are Node pages-api handlers, and a raw `Response` returned to that
// runtime is a 500, not a 404 (caught by the self-hosting smoke test).

// @note built lazily so importing this module never touches `withAny` - test
// suites that mock `@/lib/method` partially would break at import time
let notFoundHandler: ReturnType<typeof withAny> | undefined

export function withBilling<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult
) {
  return (...args: TArgs): TResult | ReturnType<ReturnType<typeof withAny>> => {
    if (!isSellable || !isBillingConfigured()) {
      notFoundHandler ??= withAny(async () => notFound())

      return notFoundHandler(
        ...(args as unknown as Parameters<ReturnType<typeof withAny>>)
      )
    }

    return fn(...args)
  }
}

type SessionHandler = (req: Request, session: Session) => Promise<Response>
type RequestHandler = (req: Request) => Promise<Response>

/**
 * Wraps a handler requiring any active subscription - the per-user
 * entitlement gate, as opposed to `withBilling`'s deployment-level one. A
 * granted account passes even where nothing is sold, which is why this gate
 * never consults sellability.
 *
 * @note passes outright in the planless deployment (`!hasPlans`): with no
 * plan catalogue there are no subscription tiers to require, and a planless
 * deployment refuses nothing on entitlement grounds.
 */
export function withSubscription(fn: SessionHandler): RequestHandler {
  return withSession(async function (
    req: Request,
    session: Session
  ): Promise<Response> {
    if (!hasPlans) {
      return fn(req, session)
    }

    if (!session.user?.id) {
      return noSubscription()
    }

    // @note the session carries no billing columns - the check reads the
    // account row, through the short-lived user cache

    const user = await fastGetUserById(session.user.id)

    if (user && hasSubscription(user)) {
      return fn(req, session)
    } else {
      return noSubscription()
    }
  })
}
