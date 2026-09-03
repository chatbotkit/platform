import type { AnyArgs } from '@chatbotkit-dev/typescript-utils/args'

import { assert, createSpan } from '@/lib/debug'
import { captureException } from '@/lib/error'
import { promises } from '@/lib/it'
import type { AllTypes } from '@/lib/limit.core'
import {
  accountLimitsOk,
  constructExceededAccountLimitsMessage,
  constructExceededDatabaseLimitsMessage,
  constructExceededRateLimitsMessage,
  constructExceededSpecialRateLimitsMessage,
  databaseLimitsOk,
  rateLimitsOk,
  specialRateLimitsOk,
  splitLimits,
} from '@/lib/limit.core'
import { genericError, limitsReached } from '@/lib/response'
import type { Session } from '@/lib/session.get'
import { withSession } from '@/lib/session.handler'

type LimitHandlerFn<TArgs extends AnyArgs = AnyArgs> = (
  req: Request,
  session: Session,

  ...args: TArgs
) => Promise<Response>

type LimitsCheckResult = [(...args: AnyArgs) => Response, ...AnyArgs] | void

export function withLimits<TArgs extends AnyArgs = AnyArgs>(
  limits: AllTypes[],
  fn: LimitHandlerFn<TArgs>
): LimitHandlerFn<TArgs> {
  const { rateLimits, databaseLimits, accountLimits, specialRateLimits } =
    splitLimits(limits)

  return async function (
    req: Request,
    session: Session,

    ...args: TArgs
  ): Promise<Response> {
    assert(session, 'no session provided')

    const tasks: Array<() => Promise<LimitsCheckResult>> = []

    if (rateLimits.length > 0) {
      tasks.push(async () => {
        const context = {
          exceededLimits: [],
        }

        if (!(await rateLimitsOk(session.user, rateLimits, context))) {
          return [
            limitsReached,
            constructExceededRateLimitsMessage(context.exceededLimits),
          ]
        }
      })
    }

    if (databaseLimits.length > 0) {
      tasks.push(async () => {
        const context = {
          exceededLimits: [],
          nearlyExceededLimits: [],
        }

        if (!(await databaseLimitsOk(session.user, databaseLimits, context))) {
          return [
            limitsReached,
            constructExceededDatabaseLimitsMessage(context.exceededLimits),
          ]
        }
      })
    }

    if (accountLimits.length > 0) {
      tasks.push(async () => {
        const context = {
          exceededLimits: [],
          nearlyExceededLimits: [],
        }

        if (!(await accountLimitsOk(session.user, accountLimits, context))) {
          return [
            limitsReached,
            constructExceededAccountLimitsMessage(context.exceededLimits),
          ]
        }
      })
    }

    if (specialRateLimits.length > 0) {
      tasks.push(async () => {
        const context = {
          exceededLimits: [],
        }

        if (
          !(await specialRateLimitsOk(session.user, specialRateLimits, context))
        ) {
          return [
            limitsReached,
            constructExceededSpecialRateLimitsMessage(context.exceededLimits),
          ]
        }
      })
    }

    const span = createSpan({ name: 'withLimits' })

    try {
      for await (const result of promises(tasks.map((fn) => fn()))) {
        if (result) {
          const [throwFn, ...fnArgs] = result

          return throwFn(...fnArgs)
        }
      }
    } catch (e) {
      await captureException(e)

      return genericError(e)
    } finally {
      span.finish()
    }

    return await fn(req, session, ...args)
  }
}

export function withSessionLimits<TArgs extends AnyArgs = AnyArgs>(
  limits: AllTypes[],
  fn: LimitHandlerFn<TArgs>
): (req: Request, ...args: TArgs) => Promise<Response> {
  return withSession(withLimits(limits, fn))
}
