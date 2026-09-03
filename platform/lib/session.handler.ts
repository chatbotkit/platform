import type { AnyArgs } from '@chatbotkit-dev/typescript-utils/args'

import { API_AUDIENCE, USER_AUDIENCE } from '@/lib/audience.consts'
import { setContextUser } from '@/lib/context.store'
import { createSpan } from '@/lib/debug'
import {
  captureUnknownException,
  respondFromError,
  throwNotAuthorized,
} from '@/lib/response'
import { getSessionStore, runInSessionContext } from '@/lib/session.context'
import { type Session, getSession } from '@/lib/session.get'

export type { Session } from '@/lib/session.get'

// @note using AnyArgs instead of unknown[] for rest args because middleware
// composition (e.g. withSession(withStream(...))) requires flexibility
// that unknown[] breaks - the session parameter would become unknown

export type SessionHandler<TArgs extends AnyArgs = AnyArgs> = (
  req: Request,
  session: Session,
  ...args: TArgs
) => Promise<Response>

export type RequestHandler<TArgs extends AnyArgs = AnyArgs> = (
  req: Request,
  ...args: TArgs
) => Promise<Response>

/**
 * Wraps a handler with session retrieval and context setup.
 * To extend the session object, please change the next-auth.d.ts file.
 */
export function withSession<TArgs extends AnyArgs>(
  fn: SessionHandler<TArgs>
): RequestHandler<TArgs> {
  return async function (req: Request, ...args: TArgs): Promise<Response> {
    const span = createSpan({ name: 'withSession' })

    try {
      let session: Session

      try {
        session = await getSession(req)
      } catch (e) {
        await captureUnknownException(e)

        return respondFromError(e)
      }

      setContextUser(session.user)

      return runInSessionContext(() => {
        const sessionStore = getSessionStore()

        Object.assign(
          sessionStore,
          session.valueOf() // @note we deliberately use the object value in order for the assignment to work
        )

        return fn(req, session, ...args)
      })
    } finally {
      span.finish()
    }
  }
}

/**
 * Wraps a handler requiring a user session (not API session).
 */
export function withUserSession<TArgs extends AnyArgs>(
  fn: SessionHandler<TArgs>
): RequestHandler<TArgs> {
  return withSession(async function (
    req: Request,
    session: Session,
    ...args: TArgs
  ): Promise<Response> {
    if (session.payload.aud !== USER_AUDIENCE) {
      return throwNotAuthorized(`User session required`)
    }

    return fn(req, session, ...args)
  })
}

/**
 * Wraps a handler requiring an API session (not user session).
 */
export function withAPISession<TArgs extends AnyArgs>(
  fn: SessionHandler<TArgs>
): RequestHandler<TArgs> {
  return withSession(async function (
    req: Request,
    session: Session,
    ...args: TArgs
  ): Promise<Response> {
    if (session.payload.aud !== API_AUDIENCE) {
      return throwNotAuthorized(`API session required`)
    }

    return fn(req, session, ...args)
  })
}
