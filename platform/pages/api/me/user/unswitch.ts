import {
  RUNAS_USERID_COOKIE_NAME,
  RUNAS_USERNAME_COOKIE_NAME,
} from '@/config/cookie'

import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export default withPost(
  withSession(async function (_req) {
    const headers = new Headers()

    // clear the user switch cookies

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
