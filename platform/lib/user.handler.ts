import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound } from '@/lib/response'
import type { Session } from '@/lib/session.get'
import { withSession } from '@/lib/session.handler'
import { fastGetUserById } from '@/lib/user.get'

/* eslint-disable @typescript-eslint/no-explicit-any */
type HandlerFunction = (
  req: Request,
  session: Session,
  ...args: any[]
) => Promise<Response>

/**
 * Wraps a handler function to validate user access through parent session
 */
export function withChildUserSession(fn: HandlerFunction): HandlerFunction {
  return withSession(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function (req, session, ...args: any[]) {
      const userId = requiredUrlParam(req, 'userId')

      const user = await fastGetUserById(userId)

      if (!user) {
        return notFound()
      }

      if (user.parentId !== session.user.id) {
        return notAuthorized()
      }

      const childUserSession = { ...session, user }

      return fn(req, childUserSession, ...args)
    }
  )
}
