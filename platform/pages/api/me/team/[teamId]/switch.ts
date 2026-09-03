// @ts-check
import {
  RUNAS_TEAMID_COOKIE_NAME,
  RUNAS_TEAMNAME_COOKIE_NAME,
  RUNAS_USERID_COOKIE_NAME,
  RUNAS_USERNAME_COOKIE_NAME,
} from '@/config/cookie'

import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withoutTeamAndUserRunasCookies } from '@/lib/runas'
import { withSession } from '@/lib/session.handler'

// Team Switch Flow
//
// This endpoint switches the dashboard context to a team account. Switching
// teams resets all assumption state so the session resolves cleanly.
//
// Session resolution order (see session.get.js):
//   1. Team association (config-based)
//   2. Team cookie  -> session.user becomes the team owner
//   3. User cookie  -> session.user becomes the child user
//
// Pre-session middleware: withoutTeamAndUserRunasCookies
//   Strips both team and user cookies so that session.user resolves to the
//   original logged-in user. This is the correct identity for authorizing
//   whether the caller owns or is a member of the target team.
//
// Response cookies: sets team cookies and clears user cookies.
//   User cookies are cleared because switching teams changes the account-level
//   context, which invalidates any previous child-user assumption (the child
//   belonged to the old team owner, not the new one).

export default withPost(
  withoutTeamAndUserRunasCookies(
    withSession(async function (req, session) {
      const team = await prisma.team.findUnique({
        where: {
          id: requiredUrlParam(req, 'teamId'),
        },

        select: {
          userId: true,

          id: true,

          name: true,

          memberships: {
            select: {
              email: true,
            },
          },
        },
      })

      if (!team) {
        return notFound()
      }

      if (
        team.userId !== session.user.id &&
        !team.memberships.find((m) => m.email === session.user.email)
      ) {
        return notAuthorized()
      }

      const headers = new Headers()

      // set the team switch cookies

      headers.append(
        'Set-Cookie',
        `${RUNAS_TEAMID_COOKIE_NAME}=${encodeURIComponent(
          team.id
        )}; Path=/; Secure; SameSite=Lax`
      )
      headers.append(
        'Set-Cookie',
        `${RUNAS_TEAMNAME_COOKIE_NAME}=${encodeURIComponent(
          team.name || ''
        )}; Path=/; Secure; SameSite=Lax`
      )

      // also clear the user switch cookies

      headers.append(
        'Set-Cookie',
        `${RUNAS_USERID_COOKIE_NAME}=; Path=/; Secure; SameSite=Lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      )
      headers.append(
        'Set-Cookie',
        `${RUNAS_USERNAME_COOKIE_NAME}=; Path=/; Secure; SameSite=Lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      )

      return ok({ redirectUrl: `/overview` }, headers)
    })
  )
)
