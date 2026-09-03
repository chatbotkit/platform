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

    // clear team cookies so user-switch and team-switch state can never
    // coexist - mirrors the symmetric behaviour of team switching

    headers.append(
      'Set-Cookie',
      `${RUNAS_TEAMID_COOKIE_NAME}=; Path=/; Secure; SameSite=Lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    )
    headers.append(
      'Set-Cookie',
      `${RUNAS_TEAMNAME_COOKIE_NAME}=; Path=/; Secure; SameSite=Lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    )

    return ok({ id }, headers)
  })
)
