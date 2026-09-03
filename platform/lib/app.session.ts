import { APP_AUDIENCE, USER_AUDIENCE } from '@/lib/audience.consts'
import { throwNotAuthenticated } from '@/lib/response'
import type { Session } from '@/lib/session.get'
import { ServerActionRequest, getSession } from '@/lib/session.get'

/**
 * Validates that the session is for a user or an app. This is done by checking
 * the `aud` claim in the session payload. **NOTE:** Keep in mind that the
 * session is not checked weather the user has access to the app or not.
 */
async function validateSession(
  app: string,
  session: Session
): Promise<boolean> {
  app // @note only here for future use

  return [USER_AUDIENCE, APP_AUDIENCE].includes(session.payload.aud)
}

/**
 * Gets the session for a user or an app. This function will throw an error if
 * the session is not valid for a user or an app. **NOTE:** Keep in mind that
 * the session is not checked whether the user has access to the app or not.
 */
export async function getAppSession(
  app: string,
  req?: Parameters<typeof getSession>[0],
  res?: Parameters<typeof getSession>[1]
): Promise<Session> {
  if (!req) {
    req = await ServerActionRequest.make()
  }

  const session = await getSession(req, res)

  if (!(await validateSession(app, session))) {
    return throwNotAuthenticated()
  }

  return session
}

/**
 * Gets the session for a user or an app. This function will return null if
 * the session is not valid for a user or an app. **NOTE:** Keep in mind that
 * the session is not checked whether the user has access to the app or not.
 */
export async function getSoftAppSession(
  app: string,
  req?: Parameters<typeof getSession>[0],
  res?: Parameters<typeof getSession>[1]
): Promise<Session | null> {
  try {
    return await getAppSession(app, req, res)
  } catch {
    return null
  }
}
