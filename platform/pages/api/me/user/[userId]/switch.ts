// @ts-check
import {
  RUNAS_USERID_COOKIE_NAME,
  RUNAS_USERNAME_COOKIE_NAME,
} from '@/config/cookie'

import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withoutUserRunasCookies } from '@/lib/runas'
import { withSession } from '@/lib/session.handler'

// User Switch Flow
//
// This endpoint switches the dashboard context to a child user account. It is
// designed to work both standalone and while already switched into a team.
//
// Session resolution order (see session.get.js):
//   1. Team association (config-based)
//   2. Team cookie  -> session.user becomes the team owner
//   3. User cookie  -> session.user becomes the child user
//
// Pre-session middleware: withoutUserRunasCookies
//   Strips user cookies so that session.user resolves to the team owner (if a
//   team cookie is present) or the original logged-in user (if not). This gives
//   the handler the correct parent identity for the authorization check.
//
// Response cookies: sets user cookies only, team cookies are preserved.
//   Team cookies MUST be preserved because subsequent requests depend on the
//   team cookie to resolve session.user to the team owner first, which is the
//   parent of the child user. Clearing team cookies here would cause every
//   following request to fail authorization (the original logged-in user is
//   not the parent of the team owner's child).

export default withPost(
  withoutUserRunasCookies(
    withSession(async function (req, session) {
      const user = await prisma.user.findUnique({
        where: {
          id: requiredUrlParam(req, 'userId'),
        },

        select: {
          parentId: true,

          id: true,

          name: true,

          email: true,
        },
      })

      if (!user) {
        return notFound()
      }

      if (user.parentId !== session.user.id) {
        return notAuthorized()
      }

      const headers = new Headers()

      // set the user switch cookies

      headers.append(
        'Set-Cookie',
        `${RUNAS_USERID_COOKIE_NAME}=${encodeURIComponent(
          user.id
        )}; Path=/; Secure; SameSite=Lax`
      )
      headers.append(
        'Set-Cookie',
        `${RUNAS_USERNAME_COOKIE_NAME}=${encodeURIComponent(
          user.name || user.email
        )}; Path=/; Secure; SameSite=Lax`
      )

      return ok({ redirectUrl: `/overview` }, headers)
    })
  )
)
