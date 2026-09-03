import type { Session } from 'next-auth'

import type { AnyArgs } from '@chatbotkit-dev/typescript-utils/args'

import debug, { assert } from '@/lib/debug'
import { isDevelopment } from '@/lib/env'
import { slidingWindow } from '@/lib/ratelimit'
import { ok, tooManyRequests } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

type Rate =
  | `${number} ms`
  | `${number} s`
  | `${number} m`
  | `${number} h`
  | `${number} d`

type HandlerFunction<TArgs extends AnyArgs = AnyArgs> = (
  req: Request,
  session: Session,
  ...args: TArgs
) => Promise<Response>

export function withRate<TArgs extends AnyArgs = AnyArgs>(
  n: number,
  rate: Rate,
  fn: HandlerFunction<TArgs>,
  pass?: boolean
): HandlerFunction<TArgs> {
  return async function (req: Request, session: Session, ...args: TArgs) {
    if (!isDevelopment) {
      assert(session, 'no session provided')

      assert(session.user.id, 'no session provided')
      assert(req.url, 'no url provided')

      const key = `with-rate-user-${session.user.id}-url-${req.url}`

      const { success } = await slidingWindow(key, n, rate)

      debug(`checking rate`, { key, success }).log('rate.withRate')

      if (!success) {
        if (pass) {
          return ok()
        } else {
          return tooManyRequests(
            `You have exceeded your allocated request limits`
          )
        }
      }
    }

    return fn(req, session, ...args)
  }
}

export function withSystemRate<TArgs extends AnyArgs = AnyArgs>(
  n: number,
  rate: Rate,
  fn: HandlerFunction<TArgs>,
  pass?: boolean
): HandlerFunction<TArgs> {
  return async function (req: Request, session: Session, ...args: TArgs) {
    if (!isDevelopment) {
      assert(session, 'no session provided')

      assert(req.url, 'no url provided')

      const key = `with-rate-user-system-url-${req.url}`

      const { success } = await slidingWindow(key, n, rate)

      debug(`checking system rate`, { key, success }).log('rate.withSystemRate')

      if (!success) {
        if (pass) {
          return ok()
        } else {
          return tooManyRequests(
            `You have exceeded the system allocated request limits`
          )
        }
      }
    }

    return fn(req, session, ...args)
  }
}

export function withSessionRate(
  n: number,
  rate: Rate,
  fn: HandlerFunction,
  pass?: boolean
): ReturnType<typeof withSession> {
  return withSession(withRate(n, rate, fn as HandlerFunction, pass))
}

export function withSessionSystemRate(
  n: number,
  rate: Rate,
  fn: HandlerFunction,
  pass?: boolean
): ReturnType<typeof withSession> {
  return withSession(withSystemRate(n, rate, fn as HandlerFunction, pass))
}
