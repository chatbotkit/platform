// @ts-check
import {
  RUNAS_TEAMID_COOKIE_NAME,
  RUNAS_TEAMNAME_COOKIE_NAME,
  RUNAS_USERID_COOKIE_NAME,
  RUNAS_USERNAME_COOKIE_NAME,
} from '@/config/cookie'

import prisma from '@/prisma/client'

import { withAdminSession } from '@/lib/admin'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notFound, ok } from '@/lib/response'
import { expiredRunasCookie, runasCookie } from '@/lib/runas'

export default withPost(
  withAdminSession(async function (req) {
    const id = requiredUrlParam(req, 'userId')

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          {
            id,
          },
          {
            email: id,
          },
        ],
      },
    })

    if (!user) {
      return notFound()
    }

    const headers = new Headers()

    headers.append('Set-Cookie', runasCookie(RUNAS_USERID_COOKIE_NAME, user.id))
    headers.append(
      'Set-Cookie',
      runasCookie(RUNAS_USERNAME_COOKIE_NAME, user.name || user.email)
    )

    // clear team cookies so user-switch and team-switch state can never
    // coexist - mirrors the symmetric behaviour of team switching

    headers.append('Set-Cookie', expiredRunasCookie(RUNAS_TEAMID_COOKIE_NAME))
    headers.append('Set-Cookie', expiredRunasCookie(RUNAS_TEAMNAME_COOKIE_NAME))

    return ok({ id }, headers)
  })
)
