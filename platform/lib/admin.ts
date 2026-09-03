import admins from '@/config/admins'

import { notAuthorized } from '@/lib/response'
import type { Session } from '@/lib/session.get'
import { withSession } from '@/lib/session.handler'

/**
 * Checks if a user is an admin
 *
 * @todo make this method async
 */
export function isAdmin(user: { id?: string; email?: string }): boolean {
  if ('id' in user && user.id && admins.includes(user.id)) {
    return true
  }

  if ('email' in user && user.email && admins.includes(user.email)) {
    return true
  }

  return false
}

/**
 * Creates a session handler that requires admin privileges
 */
export function withAdminSession(
  fn: (req: Request, session: Session, ...args: unknown[]) => Promise<Response>
) {
  return withSession(async function (
    req: Request,
    session: Session,
    ...args: unknown[]
  ): Promise<Response> {
    if (!isAdmin(session.user)) {
      return notAuthorized()
    } else {
      return fn(req, session, ...args)
    }
  })
}
