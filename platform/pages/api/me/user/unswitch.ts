import {
  RUNAS_USERID_COOKIE_NAME,
  RUNAS_USERNAME_COOKIE_NAME,
} from '@/config/cookie'

import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { expiredRunasCookie } from '@/lib/runas'
import { withSession } from '@/lib/session.handler'

export default withPost(
  withSession(async function (_req) {
    const headers = new Headers()

    // clear the user switch cookies

    headers.append(
      'Set-Cookie',
      expiredRunasCookie(RUNAS_USERID_COOKIE_NAME)
    )
    headers.append(
      'Set-Cookie',
      expiredRunasCookie(RUNAS_USERNAME_COOKIE_NAME)
    )

    return ok({ redirectUrl: `/overview` }, headers)
  })
)
