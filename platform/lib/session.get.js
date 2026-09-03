// @ts-check
import { DISTANT_FUTURE } from '@chatbotkit-dev/time'

import admins from '@/config/admins'
import platform from '@/config/platform'
import {
  RUNAS_TEAMID_COOKIE_NAME,
  RUNAS_USERID_COOKIE_NAME,
} from '@/config/cookie'

import prisma from '@/prisma/client'

import { API_AUDIENCE, USER_AUDIENCE } from '@/lib/audience.consts'
import authOptions from '@/lib/auth.options'
import {
  getContextNextApiRequest,
  getContextNextApiResponse,
} from '@/lib/context.store'
import { parse as parseCookie } from '@/lib/cookie'
import { digestCredential } from '@/lib/credential.digest'
import { hasProtection } from '@/lib/csrf'
import cuid from '@/lib/cuid'
import debug from '@/lib/debug'
import { isDevelopment } from '@/lib/env'
import { getHeader } from '@/lib/header'
import {
  captureUnknownException,
  throwNotAuthenticated,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'
import { fastGetTeamById } from '@/lib/team.get'
import {
  getPayloadVerifier,
  isJwtToken,
  isOAuthAccessToken,
  isOAuthRefreshToken,
  isSecretKey,
  verifyToken,
} from '@/lib/token'
import { fastGetUserById, getUserObject } from '@/lib/user.get'

/**
 * The cache strategy for a credential lookup: none by default, so revocation
 * is immediate; a bounded ttl (never swr, which would silently double the
 * window) when the deployment opts into PLATFORM_CREDENTIAL_CACHE_TTL.
 *
 * @returns {{ cacheStrategy?: { ttl: number } }}
 */
function getCredentialCacheStrategy() {
  return platform.credentialCacheTtl > 0
    ? { cacheStrategy: { ttl: platform.credentialCacheTtl } }
    : {}
}

export class ServerActionRequest extends Request {
  constructor(input, init) {
    super(input, init)
  }
}

/**
 * @param {string} [url]
 * @returns {Promise<ServerActionRequest>}
 */
ServerActionRequest.make = async function (url) {
  url = url || 'http://internal' // @todo get it from the context

  const { headers } = await import('next/headers')

  const headersStore = await headers()

  const request = new ServerActionRequest(url, {
    method: 'POST',

    headers: headersStore,
  })

  return request
}

/**
 * To extend this object please change the next-auth.d.ts file.
 *
 * @typedef {import('next-auth').Session} Session
 */

/**
 * Used as a utility to ensure that the session is always correctly validated.
 *
 * @extends {Session}
 */
class ValidSession {
  // the current user is the user before any assumption is done
  #currentUser

  // session-related properties
  #id
  #name
  #description
  #user
  #billing
  #options
  #payload
  #expires

  /**
   * @private
   * @param {Session['user']} currentUser
   * @param {Session} session
   */
  constructor(currentUser, session) {
    this.#currentUser = currentUser

    // @note when the effective user (`session.user`) differs from the original
    // (`currentUser`), an account assumption has happened - a dashboard
    // account/team switch (run-as cookies) or an `x-runas-*` token header.
    // Disambiguate the session id per assumed user so that everything keyed by
    // `session.id` (function caches, pub/sub channels, engine namespaces, the
    // minted-token `sub`) is isolated per account and cannot leak across a
    // switch. Previously only some token paths did this inline while the cookie
    // paths did not, so a switch kept the same `session.id` and poisoned the
    // per-session contact cache across accounts. This is
    // the single source of truth; the `endsWith` guard keeps it idempotent for
    // any caller that still passes an already-suffixed id.
    this.#id =
      session.user &&
      currentUser &&
      session.user.id !== currentUser.id &&
      !String(session.id).endsWith(`/${session.user.id}`)
        ? `${session.id}/${session.user.id}`
        : session.id

    this.#name = session.name
    this.#description = session.description

    this.#user = session.user

    this.#billing = session.billing

    this.#options = session.options

    this.#payload = session.payload
    this.#expires = session.expires
  }

  /**
   * @returns {Session['id']}
   */
  get id() {
    return this.#id
  }

  /**
   * @returns {Session['name']}
   */
  get name() {
    return this.#name
  }

  /**
   * @returns {Session['description']}
   */
  get description() {
    return this.#description
  }

  /**
   * @returns {Session['user']}
   */
  get user() {
    return this.#user
  }

  /**
   * @returns {Session['billing']}
   */
  get billing() {
    return this.#billing
  }

  /**
   * @returns {Session['options']}
   */
  get options() {
    return {
      ...this.#options,

      currentUserId: this.#currentUser.id,
      currentUserEmail: this.#currentUser.email,
    }
  }

  /**
   * @returns {Session['payload']}
   */
  get payload() {
    return this.#payload
  }

  /**
   * @returns {Session['expires']}
   */
  get expires() {
    return this.#expires
  }

  /**
   * @static
   * @param {Session['user']} currentUser
   * @param {Session} session
   * @param {import('@/lib/token').Req} req
   * @returns {Promise<ValidSession>}
   */
  static async getInstance(currentUser, session, req) {
    const verify = await getPayloadVerifier(session.payload)

    await verify(req)

    return new ValidSession(currentUser, session)
  }

  /**
   * @returns {object}
   */
  valueOf() {
    return {
      id: this.id,

      name: this.name,
      description: this.description,

      user: this.user,

      billing: this.billing,
      options: this.options,
      payload: this.payload,
      expires: this.expires,
    }
  }
}

/**
 * This method returns a session or throws authentication error when no session
 * is found, significantly simplifying use and implementation.
 *
 * @param {import('next').NextApiRequest|Request} req
 * @param {import('next').NextApiResponse} [res]
 * @returns {Promise<ValidSession>}
 */
export async function getSession(req, res) {
  debug(`getting session`).log('session.get.getSession')

  // First we handle the case where the user is authenticated via a token. This
  // is the case when the user is using the API.
  {
    const authorizationHeader = getHeader(req, 'authorization')

    if (authorizationHeader) {
      const authorizationToken = authorizationHeader.split(' ')[1]?.trim() || ''

      if (!authorizationToken) {
        debug(`no token found in authorization header`).log(
          'session.get.getSession'
        )

        return throwNotAuthenticated()
      }

      // Handle Secret keys.
      if (isSecretKey(authorizationToken)) {
        const authorizationTokenDigest = await digestCredential(
          authorizationToken
        )

        let token

        // First we check if the token is in the database and if it is we use it
        // to get the user.
        {
          token = await prisma.token.findUnique({
            where: {
              token: authorizationTokenDigest,
            },

            select: {
              id: true,

              config: true,

              user: {
                select: {
                  id: true,

                  email: true,

                  billingCustomerId: true,
                  billingSubscriptionId: true,
                  billingSubscriptionStatus: true,

                  parentId: true,

                  limits: true,

                  meta: true,
                },
              },
            },

            // @note this is the credential check: a cached row keeps a deleted
            // key working for the cache window, so it is uncached unless the
            // deployment explicitly buys that delay

            ...getCredentialCacheStrategy(),
          })

          if (!token) {
            debug(`token not found in database`).log('session.get.getSession')

            return throwNotAuthenticated()
          }
        }

        // We take into account the x-runas-user-id header and if it is present
        // we use it to override the user with the correct "assumed" user.
        {
          const xRunasUserId = getHeader(
            req,
            'x-runas-user-id',
            'x-runas-userid'
          )

          if (xRunasUserId) {
            const user = await fastGetUserById(xRunasUserId)

            if (!user) {
              debug(`runas user not found`).log('session.get.getSession')

              return throwNotAuthenticated()
            }

            if (user.parentId !== token.user.id) {
              debug(`user not authorized to assume`, { user, token }).log(
                'session.get.getSession'
              )

              return throwNotAuthenticated()
            }

            return await ValidSession.getInstance(
              getUserObject(token.user),
              {
                id: token.id,
                user: user,
                options: {},
                payload: { aud: API_AUDIENCE },
                expires: DISTANT_FUTURE.toISOString(),
              },
              req
            )
          }
        }

        // We take into account the x-runas-child-user-email header and if it is
        // present we use it to override the user with the correct "child" user.
        {
          const xRunasChildUserEmail = getHeader(
            req,
            'x-runas-child-user-email'
          )

          if (xRunasChildUserEmail) {
            // @todo do it faster

            const user = await prisma.user.findUnique({
              where: {
                parentId_parentContextEmail: {
                  parentId: token.user.id,
                  parentContextEmail: xRunasChildUserEmail,
                },
              },
            })

            if (!user) {
              debug(`runas user not found`).log('session.get.getSession')

              return throwNotAuthenticated()
            }

            if (user.parentId !== token.user.id) {
              debug(`user not authorized to assume`, {
                user,
                token,
              }).log('session.get.getSession')

              return throwNotAuthenticated()
            }

            return await ValidSession.getInstance(
              getUserObject(token.user),
              {
                // @note the assumed-user suffix is applied centrally in the
                // ValidSession constructor (keyed off currentUser vs user)
                id: token.id,
                user: getUserObject(user),
                options: {},
                payload: { aud: API_AUDIENCE },
                expires: DISTANT_FUTURE.toISOString(),
              },
              req
            )
          }
        }

        // By default we return the user that is associated with the token.
        {
          const user = getUserObject(token.user)

          // @note a token may be bound to a specific contact via its config.
          // When present we propagate it into the session payload so downstream
          // handlers (e.g. conversation/complete) attribute the interaction to
          // that contact as a hard override. @see @/schemas/contactId
          const tokenConfig = /** @type {{ contactId?: string } | null} */ (
            /** @type {unknown} */ (token.config)
          )

          const contactId = tokenConfig?.contactId

          return await ValidSession.getInstance(
            user,
            {
              id: token.id, // @todo allow the user to specify their own session id via the headers
              user: user,
              options: {},
              payload: {
                aud: API_AUDIENCE,

                ...(contactId ? { contactId } : {}),
              },
              expires: DISTANT_FUTURE.toISOString(),
            },
            req
          )
        }
      }

      // Handle OpenAuth Access tokens.
      if (isOAuthAccessToken(authorizationToken)) {
        const authorizationTokenDigest = await digestCredential(
          authorizationToken
        )

        let applicationToken

        // First we check if the token is in the database and if it is we use it
        // to get the user.
        {
          applicationToken = await prisma.oAuthApplicationToken.findUnique({
            where: {
              accessToken: authorizationTokenDigest,
            },

            select: {
              id: true,

              accessTokenExpiresAt: true,

              user: {
                select: {
                  id: true,

                  email: true,

                  billingCustomerId: true,
                  billingSubscriptionId: true,
                  billingSubscriptionStatus: true,

                  parentId: true,

                  limits: true,

                  meta: true,
                },
              },
            },

            // @note see the secret key lookup above

            ...getCredentialCacheStrategy(),
          })

          if (!applicationToken) {
            debug(`token not found in database`).log('session.get.getSession')

            return throwNotAuthenticated()
          }

          // @note the oauth2 model only deletes expired tokens when its own
          // getAccessToken runs, which this direct lookup bypasses - so the
          // expiry must be enforced here too; the cleanup queue removes the
          // row later

          if (
            applicationToken.accessTokenExpiresAt &&
            applicationToken.accessTokenExpiresAt.getTime() <= Date.now()
          ) {
            debug(`token expired`).log('session.get.getSession')

            return throwNotAuthenticated()
          }
        }

        // @todo run-as on an OAuth grant lets a third party reach every child
        // account under the consenting user. Today that is covered by the
        // consent screen's "same access as an API key" wording; introduce a
        // dedicated scope (e.g. `runas`) and honour these headers only when
        // the token carries it.

        // We take into account the x-runas-user-id header and if it is present
        // we use it to override the user with the correct "child" user.
        {
          const xRunasUserId = getHeader(
            req,
            'x-runas-user-id',
            'x-runas-userid'
          )

          if (xRunasUserId) {
            const user = await fastGetUserById(xRunasUserId)

            if (!user) {
              debug(`runas user not found`).log('session.get.getSession')

              return throwNotAuthenticated()
            }

            if (user.parentId !== applicationToken.user.id) {
              debug(`user not authorized to assume`, {
                user,
                token: applicationToken,
              }).log('session.get.getSession')

              return throwNotAuthenticated()
            }

            return await ValidSession.getInstance(
              getUserObject(applicationToken.user),
              {
                id: applicationToken.id,
                user: user,
                options: {},
                payload: { aud: API_AUDIENCE },
                expires: DISTANT_FUTURE.toISOString(),
              },
              req
            )
          }
        }

        // We take into account the x-runas-child-user-email header and if it is
        // present we use it to override the user with the correct "child" user.
        {
          const xRunasChildUserEmail = getHeader(
            req,
            'x-runas-child-user-email'
          )

          if (xRunasChildUserEmail) {
            // @todo do it faster

            const user = await prisma.user.findUnique({
              where: {
                parentId_parentContextEmail: {
                  parentId: applicationToken.user.id,
                  parentContextEmail: xRunasChildUserEmail,
                },
              },
            })

            if (!user) {
              debug(`runas user not found`).log('session.get.getSession')

              return throwNotAuthenticated()
            }

            if (user.parentId !== applicationToken.user.id) {
              debug(`user not authorized to assume`, {
                user,
                token: applicationToken,
              }).log('session.get.getSession')

              return throwNotAuthenticated()
            }

            return await ValidSession.getInstance(
              getUserObject(applicationToken.user),
              {
                // @note the assumed-user suffix is applied centrally in the
                // ValidSession constructor (keyed off currentUser vs user)
                id: applicationToken.id,
                user: getUserObject(user),
                options: {},
                payload: { aud: API_AUDIENCE },
                expires: DISTANT_FUTURE.toISOString(),
              },
              req
            )
          }
        }

        // By default we return the user that is associated with the token.
        {
          const user = getUserObject(applicationToken.user)

          return await ValidSession.getInstance(
            user,
            {
              id: applicationToken.id,
              user: user,
              options: {},
              payload: { aud: API_AUDIENCE },
              expires: DISTANT_FUTURE.toISOString(),
            },
            req
          )
        }
      }

      // Handle OpenAuth Refresh tokens.
      if (isOAuthRefreshToken(authorizationToken)) {
        return throwNotAuthenticated()
      }

      // Handle JWT tokens.
      if (isJwtToken(authorizationToken)) {
        let payload

        try {
          payload = await verifyToken(authorizationToken, req)
        } catch (e) {
          if (e.code !== 'ERR_JWT_EXPIRED') {
            await captureUnknownException(e)
          }

          return throwNotAuthenticated()
        }

        if (!payload.userId) {
          debug(`userId not found in token payload`).log(
            'session.get.getSession'
          )

          return throwNotAuthenticated()
        }

        const user = await fastGetUserById(payload.userId)

        if (!user) {
          debug(`user not found`).log('session.get.getSession')

          return throwNotAuthenticated()
        }

        // @todo When tokens are used it is normally due to the widget and in
        // this case it is open for massive abuse. For this reason wrap the
        // function call to an anti-abuse system to limit the requests before
        // returning.

        // @todo How can we ban tokens - are the SK tokens even good ideas if we
        // are doing database lookups anyway?

        return await ValidSession.getInstance(
          user,
          {
            id: payload.sub || cuid(), // @todo maybe make it identifiable
            user,
            options: {
              ...payload.options,
            },
            payload: {
              // @note it is important to pass the entire payload because
              // specific validation routines rely on information that is passed
              // inside

              ...payload,
            },
            expires: (payload.exp
              ? new Date(payload.exp * 1000)
              : DISTANT_FUTURE
            ).toISOString(),
          },
          req
        )
      }

      // By default we throw an error just in case if everything else fails.
      {
        debug(`token not recognized`).log('session.get.getSession')

        return throwNotAuthenticated()
      }
    }
  }

  // All other cases are handled via next-auth.
  {
    // HTTP methods that are associated with creating, updating and deleting
    // resources are only allowed when the request is made with CSRF protection.
    {
      if (
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
          (req.method || 'GET').trim().toUpperCase() // normalize to ensure good match
        )
      ) {
        if (req instanceof ServerActionRequest) {
          // @note server actions are automatically protected
        } else {
          if (!hasProtection(req)) {
            debug(`csrf protection not found`).log('session.get.getSession')

            // @note not authorized is more semantically correct than using bad
            // request here

            return throwNotAuthorized()
          }
        }
      }
    }

    /** @type {Session|null} */
    let session

    {
      const { getServerSession } = await import('next-auth/next')

      const incomingReq = /** @type {import('next').NextApiRequest} */ (
        getContextNextApiRequest() || req
      )

      const incomingRes = /** @type {import('next').NextApiResponse}*/ (
        res || getContextNextApiResponse()
      )

      session =
        req instanceof ServerActionRequest
          ? await getServerSession(authOptions)
          : await getServerSession(incomingReq, incomingRes, authOptions)
    }

    // We check if the session is valid and if it is not we throw an error.
    {
      if (
        !session ||
        !session.id ||
        !session.user ||
        !session.options ||
        !session.payload
      ) {
        debug(`session not found`, { session }).log('session.get.getSession')

        return throwNotAuthenticated()
      }
    }

    // Get a reference to the original user before any assumption is done.

    /** @type {Readonly<Session['user']>} */
    const currentUser = session.user

    debug(`current user`, { currentUser }).log('session.get.getSession')

    // Only when the audience is the user we handle the user assumption. This is
    // because the user assumption is only allowed for users and not for other
    // audiences.
    {
      if (session.payload.aud === USER_AUDIENCE) {
        // Handle user assumption via environment variable. This method is used
        // for testing purposes only.
        {
          // @note we check that this should only done in development to avoid
          // any potential security issues

          if (isDevelopment) {
            // @note we check for the presence of the variable on a second line
            // to benefit from potential code transformations that could be done
            // by the bundler

            if (process.env.RUNAS_USERID) {
              const user = await fastGetUserById(process.env.RUNAS_USERID)

              if (!user) {
                debug(`runas user not found`).log('session.get.getSession')

                return throwNotFound('RunAs user not found')
              }

              return await ValidSession.getInstance(
                currentUser,
                {
                  ...session,

                  user,
                },
                req
              )
            }
          }
        }

        // @note the order of the following operations is important

        // Handle user assumption via runas token cookies. This method is used
        // for user switching in the dashboard.
        {
          const cookie = getHeader(req, 'cookie')

          const cookies = parseCookie(cookie || '')

          const runAsTeamIdCookie = cookies
            .get(RUNAS_TEAMID_COOKIE_NAME)
            ?.trim()

          debug(`checking runas team cookie`, { runAsTeamIdCookie }).log(
            'session.get.getSession'
          )

          if (runAsTeamIdCookie) {
            const team = await fastGetTeamById(runAsTeamIdCookie)

            if (!team) {
              debug(`runas team not found`).log('session.get.getSession')

              throwNotAuthenticated()
            }

            const user = await fastGetUserById(team.userId)

            if (!user) {
              debug(`runas user not found`).log('session.get.getSession')

              throwNotAuthenticated()
            }

            switch (true) {
              case user.id === session.user.id: {
                debug(`same user, no need to assume`, { user, session }).log(
                  'session.get.getSession'
                )

                break
              }

              case admins.includes(session.user.email): {
                debug(`admin user authorized to assume`, { user, session }).log(
                  'session.get.getSession'
                )

                break
              }

              case team.memberships
                .map((membership) => membership.email)
                .includes(session.user.email): {
                debug(`team member user authorized to assume`, {
                  user,
                  session,
                }).log('session.get.getSession')

                break
              }

              default: {
                debug(`user not authorized to assume`, {
                  user,
                  session,
                }).log('session.get.getSession')

                throwNotAuthenticated()
              }
            }

            session.user = user
          }
        }

        // Handle user assumption via runas user cookies. This method is used
        // for child user switching in the dashboard.
        {
          const cookie = getHeader(req, 'cookie')

          const cookies = parseCookie(cookie || '')

          const runAsUserIdCookie = cookies
            .get(RUNAS_USERID_COOKIE_NAME)
            ?.trim()

          debug(`checking runas user cookie`, { runAsUserIdCookie }).log(
            'session.get.getSession'
          )

          if (runAsUserIdCookie) {
            const user = await fastGetUserById(runAsUserIdCookie)

            if (!user) {
              debug(`runas user not found`).log('session.get.getSession')

              throwNotAuthenticated()
            }

            switch (true) {
              case user.id === session.user.id: {
                debug(`same user, no need to assume`, { user, session }).log(
                  'session.get.getSession'
                )

                break
              }

              case admins.includes(session.user.email): {
                debug(`admin user authorized to assume`, { user, session }).log(
                  'session.get.getSession'
                )

                break
              }

              case user.parentId === session.user.id: {
                debug(`parent user authorized to assume`, {
                  user,
                  session,
                }).log('session.get.getSession')

                break
              }

              default: {
                debug(`user not authorized to assume`, {
                  user,
                  session,
                }).log('session.get.getSession')

                throwNotAuthenticated()
              }
            }

            session.user = user
          }
        }

        // By default we return the session as is.
        {
          return await ValidSession.getInstance(currentUser, session, req)
        }
      }
    }

    // By default we return the session as is.
    {
      return await ValidSession.getInstance(currentUser, session, req)
    }
  }

  // By default we throw and error just in case if everything else fails. This
  // is not expected to happen.
  {
    debug(`session not found`).log('session.get.getSession')

    throwNotAuthenticated()
  }
}

/**
 * This method is the same as getSession with the difference that we return null
 * when the user is not authenticated.
 *
 * @param {import('next').NextApiRequest|Request} req
 * @param {import('next').NextApiResponse} [res]
 * @returns {Promise<ValidSession|null>}
 */
export async function getSoftSession(req, res) {
  try {
    return await getSession(req, res)
  } catch (e) {
    await captureUnknownException(e)

    return null
  }
}

/**
 * @manual Authentication
 * @description Comprehensive guide to authenticating with the ChatBotKit API using secret keys, JWT tokens, and user impersonation for secure programmatic access.
 * @category API
 * @tags authentication, api-keys, jwt, authorization, security
 * @index 1
 *
 * The ChatBotKit API provides multiple authentication mechanisms to ensure
 * secure access to resources. Understanding these authentication methods is
 * essential for building reliable integrations and applications.
 *
 * ## API Secret Keys
 *
 * API secret keys are the primary method for authenticating API requests. These
 * keys provide long-lived access to your account and should be treated as
 * sensitive credentials. Secret keys begin with the prefix `sk-` and are
 * generated through the ChatBotKit dashboard.
 *
 * To authenticate using an API secret key, include it in the `Authorization`
 * header of your HTTP requests:
 *
 * ```http
 * POST /api/v1/dataset/create
 * Authorization: Bearer sk-your-secret-key-here
 * Content-Type: application/json
 *
 * {
 *   "name": "My Dataset",
 *   "description": "Customer support knowledge base"
 * }
 * ```
 *
 * Secret keys provide full access to your account and all associated resources.
 * Store them securely and never expose them in client-side code, public
 * repositories, or logs. Rotate keys regularly and revoke any keys that may
 * have been compromised.
 *
 * ## JWT Tokens
 *
 * JSON Web Tokens (JWTs) provide temporary, scoped access to the API and are
 * ideal for client-side applications or time-limited integrations. JWTs are
 * obtained through the session creation endpoint and contain encoded user
 * information and permissions.
 *
 * To authenticate using a JWT token:
 *
 * ```http
 * GET /api/v1/bot/list
 * Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * ```
 *
 * JWT tokens automatically expire after a predetermined period, enhancing
 * security for temporary access scenarios. They're particularly useful for
 * widget integrations, temporary access grants, and client-side applications
 * where secret keys should not be embedded.
 *
 * ## Running as a Child User
 *
 * For a parent User managing child Users, the API supports running requests
 * as a child User through special request headers. This allows the parent User
 * to make requests on behalf of child Users without requiring
 * separate authentication credentials.
 *
 * ### Run as a User by ID
 *
 * To make requests on behalf of a specific child user, include the
 * `X-RunAs-UserId` header:
 *
 * ```http
 * POST /api/v1/bot/create
 * Authorization: Bearer sk-parent-user-key
 * X-RunAs-UserId: child-user-id-here
 * Content-Type: application/json
 *
 * {
 *   "name": "Child User Bot"
 * }
 * ```
 *
 * ### Run as a User by Email
 *
 * Alternatively, select a child User by its email address using the
 * `X-RunAs-Child-User-Email` header:
 *
 * ```http
 * POST /api/v1/dataset/create
 * Authorization: Bearer sk-parent-user-key
 * X-RunAs-Child-User-Email: child@example.com
 * Content-Type: application/json
 *
 * {
 *   "name": "Child User Dataset"
 * }
 * ```
 *
 * Running as a child User requires that:
 * - The authenticating User is the parent of the target child User
 * - The child User relationship was established through the User API
 * - The parent User has not been restricted from run-as capabilities
 *
 * ## Authentication Errors
 *
 * The API returns appropriate HTTP status codes and error messages when
 * authentication fails:
 *
 * - **401 Unauthorized**: Missing, invalid, or expired credentials
 * - **403 Forbidden**: Valid credentials but insufficient permissions for the
 *   requested operation
 *
 * Error responses never expose sensitive information such as whether a
 * particular user exists or details about why authentication failed, preventing
 * information leakage that could aid unauthorized access attempts.
 *
 * ## Best Practices
 *
 * - **Secure Storage**: Store API keys and tokens in environment variables or
 *   secure credential management systems, never in source code
 * - **Key Rotation**: Regularly rotate API secret keys and revoke unused keys
 * - **Scoped Access**: Use JWT tokens for client-side or time-limited access
 *   rather than embedding secret keys
 * - **Monitor Usage**: Regularly audit API access logs to detect unusual
 *   patterns or unauthorized access attempts
 * - **HTTPS Only**: Always use HTTPS for API requests to protect credentials in
 *   transit
 */
