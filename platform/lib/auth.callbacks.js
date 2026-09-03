// @ts-check
import { timePlusDays } from '@chatbotkit-dev/time'

import limits from '@/config/limits'

import { USER_AUDIENCE } from '@/lib/audience.consts'
import {
  canDoBilling,
  hasTrialed,
  isSellable,
  primaryTrialPlan,
  userToPlan,
} from '@/lib/billing.core'
import {
  getContextRequestIpAddress,
  getContextRequestUserAgent,
} from '@/lib/context.store'
import debug from '@/lib/debug'
import { isAllowedEmail, normalizeEmail } from '@/lib/email.validation'
import { captureException } from '@/lib/error'
import { logAudit } from '@/lib/log'
import { getRandomId } from '@/lib/string'
import { isChildUser } from '@/lib/user.type'

/**
 * @typedef {import('next-auth').Session} Session
 */

/**
 * EXTEND THIS BUT READ FIRST
 *
 * This function is used to construct the final session object, thus it can be
 * used to extend the session with information that needs to be present in both
 * the server and the client.
 *
 * To extend the session object shape, you must change the next-auth.d.ts file.
 *
 * Keep in mind that the method will be called on every request so it should be
 * optimized as much as possible.
 *
 * @param {{
 *   user: any,
 *   token?: any,
 *   session?: any,
 * }} options
 * @returns {Promise<Session>}
 */
async function constructSessionObject({
  user,

  token: jwtToken,

  session: dbSession,
}) {
  debug(`constructSessionObject`, {
    user,
    token: jwtToken,
    session: dbSession,
  })

  const session = {}

  // setup general information

  session.id = dbSession?.id || jwtToken?.id || getRandomId()

  session.name = dbSession?.name || jwtToken?.name
  session.description = dbSession?.description || jwtToken?.description

  // setup user information

  session.user = {}

  session.user.id = user.id

  session.user.email = normalizeEmail(user.email)
  // session.user.displayEmail = user.email

  // session.user.name = user.name
  // session.user.description = user.description

  session.user.image = user.image || undefined

  // setup parent information

  // @note null, not undefined - the session user is a loaded row, and plan
  // resolution treats undefined parentId as "not loaded, re-fetch"
  session.user.parentId = user.parentId ?? null

  // @note only when the deployment has plans. `session.billing` is the
  // client's single window onto the plan concept - the dashboard's plan badge,
  // upgrade button and trial prompts all read it - so in a planless deployment
  // it must simply not exist, rather than carry an invented plan name.

  // @note billing context exists only where plans are actually sold - a
  // planful deployment with manual billing shows no billing surface
  if (isSellable) {
    session.billing = {}

    session.billing.plan = userToPlan(user)

    // @note whether this user can reach the billing surface at all - the
    // client-side gate for billing navigation (upgradeAvailable is not it:
    // a fully-upgraded subscriber still manages their subscription)
    session.billing.available = canDoBilling(user)

    // @note one field does two things: its presence means a trial is
    // available to this user, its value is the plan the trial runs on - the
    // client's default plan for trial call-to-actions. The billing module
    // itself is server-only and nothing of it rides in the client bundle.
    if (canDoBilling(user) && !hasTrialed(user) && primaryTrialPlan) {
      session.billing.trialPlan = primaryTrialPlan
    }

    session.billing.upgradeAvailable =
      canDoBilling(user) && limits[session.billing.plan]?.upgradable === true
  }

  // setup parent context information

  if (isChildUser(user)) {
    if (user.parentId) {
      // assign display name
      {
        // @note we want to preserve the original name in the session object
        // and use the display name for the user interface

        let displayNameAssigned = false

        if (!displayNameAssigned && user.parentContextName) {
          session.user.displayName = user.parentContextName

          displayNameAssigned = true
        }

        if (!displayNameAssigned && user.meta?.name) {
          session.user.displayName = user.meta.name

          displayNameAssigned = true
        }
      }

      // assign display email
      {
        // @note do not touch the session.user.email and instead use the
        // display email - this is to prevent all kinds of session confusion
        // issues that might arise from changing the email

        let displayEmailAssigned = false

        if (!displayEmailAssigned && user.parentContextEmail) {
          session.user.displayEmail = normalizeEmail(user.parentContextEmail)

          displayEmailAssigned = true
        }

        if (!displayEmailAssigned && user.meta?.email) {
          session.user.displayEmail = normalizeEmail(user.meta.email)

          displayEmailAssigned = true
        }
      }
    }
  }

  // ORIGINAL REMARKS
  //
  // What follows next is the setup of the session object. We use both the jwt
  // token and db session to construct the final session object. Unfortunately
  // this is only done for brevity. In reality, neither the jwt token nor the db
  // session contains the information required to construct the final session
  // object. This was stated in the next-auth documentation stating security
  // reasons - although it is not clear why and it is mostly an oversight from
  // their part. As a result, the options, payload and the audience are just
  // statically set. There are no external factors that can change these values
  // at this point. Perhaps upgrading to a later version of next-auth might
  // solve this issue.

  // REVISED REMARKS
  //
  // We now use pnpm patch to patch the next-auth package to include the
  // required information.

  // setup session options

  session.options = {
    // @note use the jwt token / db session options if available

    ...jwtToken?.options,
    ...dbSession?.options,
  }

  // setup session payload

  session.payload = {
    // @note use the jwt token / db session payload if available

    ...jwtToken?.payload,
    ...dbSession?.payload,

    // @note use the db session audience if available

    aud: dbSession?.audience || jwtToken?.aud || USER_AUDIENCE,
  }

  // setup session expiration

  session.expires = dbSession?.expires || jwtToken?.exp || timePlusDays(30)

  // return the session object

  return session
}

/**
 * @type {import('next-auth').AuthOptions['callbacks']}
 */
export const callbacks = {
  /**
   * This method is implemented but it is not used.
   */
  async jwt({ user, token }) {
    debug(`jwt`, { user, token })

    throw new Error('This method is not used')
  },

  /**
   * This method is implemented and used to retrieve active sessions.
   */
  async session({ user, token, session }) {
    debug(`session`, { user, token, session })

    if (!user && token) {
      // @todo find out if this is even required
      // @ts-ignore
      user = token.user
    }

    if (user) {
      session = await constructSessionObject({ user, token, session })
    }

    return session
  },

  /**
   * This method is implemented and used to sign in the user. It is called
   * when the user signs in with any provider.
   */
  async signIn({ user }) {
    debug(`signIn`, { user })

    if (user.email) {
      if (!(await isAllowedEmail(user.email))) {
        return '/signin?error=InvalidEmail'
      }
    }

    if (user?.id) {
      try {
        const ipAddress = getContextRequestIpAddress()
        const userAgent = getContextRequestUserAgent()

        await logAudit({
          user: { id: user.id },
          action: 'LOGIN',
          oldValues: undefined,
          newValues: {
            email: user.email,
          },
          relations: {
            // sessionId: ret.id, // @todo get the actual session id
          },
          meta: {
            ipAddress,
            userAgent,
          },
        })
      } catch (error) {
        await captureException(error)
      }
    }

    return true
  },

  /**
   * We use the callback url to customize the redirect behavior. This is used
   * when the user signs in with any provider. We always use relative urls to
   * prevent any kind of security issues.
   */
  redirect({ url, baseUrl }) {
    debug(`redirect`, { url, baseUrl })

    const u = new URL(url, baseUrl)

    return u.pathname + u.search
  },
}

export default callbacks
