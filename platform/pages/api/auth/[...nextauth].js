// @ts-check
import _NextAuth from 'next-auth/next'

import defaultAuthAdapter from '@/lib/auth.adapter'
import defaultAuthCallbacks from '@/lib/auth.callbacks'
import defaultAuthOptions from '@/lib/auth.options'
import defaultAuthProviders from '@/lib/auth.providers'
import {
  SIGNIN_EMAIL_ISSUE_PER_EMAIL,
  SIGNIN_EMAIL_ISSUE_PER_IP,
  SIGNIN_EMAIL_VERIFY_PER_EMAIL,
  SIGNIN_EMAIL_VERIFY_PER_IP,
  TOO_MANY_ATTEMPTS_MESSAGE,
  checkAuthRate,
  getClientAddress,
  normalizeSigninEmail,
} from '@/lib/auth.rate'
import {
  getContextNextApiRequest,
  getContextNextApiResponse,
  getContextRequestHost,
} from '@/lib/context.store'
import debug from '@/lib/debug'
import { getHeader } from '@/lib/header'
import {
  tryParse as tryParseJson,
  tryStringify as tryStringifyJson,
} from '@/lib/json'
import { withAny } from '@/lib/method'
import {
  getPartnerAuthInitialAdapter,
  getPartnerAuthInitialCallbacks,
  getPartnerAuthProviders,
} from '@/lib/partner.auth'
import { isPartnerHost } from '@/lib/partner.helpers'
import {
  getPortalAuthInitialAdapter,
  getPortalAuthInitialCallbacks,
  getPortalAuthProviders,
} from '@/lib/portal.auth'
import { isPortalHostname } from '@/lib/portal.hostname'

// @ts-expect-error because NextAuth does not support ESM
const NextAuth = _NextAuth.default

/**
 * @param {string|null} host
 * @returns {Promise<import('next-auth').AuthOptions['adapter']>}
 */
export async function getInitialAdapter(host) {
  switch (true) {
    case host && isPortalHostname(host): {
      return await getPortalAuthInitialAdapter(host)
    }

    case host && isPartnerHost(host): {
      return await getPartnerAuthInitialAdapter(host)
    }

    default: {
      return defaultAuthAdapter
    }
  }
}

/**
 * @param {string|null} host
 * @returns {Promise<import('next-auth').AuthOptions['providers']>}
 */
export async function getProviders(host) {
  switch (true) {
    case host && isPortalHostname(host): {
      return await getPortalAuthProviders(host)
    }

    case host && isPartnerHost(host): {
      return await getPartnerAuthProviders(host)
    }

    default: {
      return defaultAuthProviders
    }
  }
}

/**
 * @param {string|null} host
 * @returns {Promise<import('next-auth').AuthOptions['callbacks']>}
 */
export async function getInitialCallbacks(host) {
  switch (true) {
    case host && isPortalHostname(host): {
      return await getPortalAuthInitialCallbacks(host)
    }

    case host && isPartnerHost(host): {
      return await getPartnerAuthInitialCallbacks(host)
    }

    default: {
      return defaultAuthCallbacks
    }
  }
}

/**
 * Applies the sign-in abuse controls for the email provider. Only the two
 * unauthenticated, attacker-reachable actions are limited: issuing a code
 * (`signin/email`) and verifying one (`callback/email`). Everything else -
 * session reads, CSRF tokens, provider lists, OAuth provider callbacks - is
 * either harmless to repeat or protected by the upstream provider.
 *
 * @param {import('next').NextApiRequest} req
 * @returns {Promise<boolean>} whether the request may proceed
 */
export async function checkSigninRate(req) {
  const action = Array.isArray(req.query?.nextauth)
    ? req.query.nextauth.join('/')
    : String(req.query?.nextauth || '')

  const address = getClientAddress(req)

  switch (action) {
    case 'signin/email': {
      if (req.method !== 'POST') {
        return true
      }

      const email = normalizeSigninEmail(req.body?.email)

      return await checkAuthRate('signin-email-issue', [
        { identity: address, limit: SIGNIN_EMAIL_ISSUE_PER_IP },
        { identity: email, limit: SIGNIN_EMAIL_ISSUE_PER_EMAIL },
      ])
    }

    case 'callback/email': {
      const email = normalizeSigninEmail(req.query?.email ?? req.body?.email)

      return await checkAuthRate('signin-email-verify', [
        { identity: address, limit: SIGNIN_EMAIL_VERIFY_PER_IP },
        { identity: email, limit: SIGNIN_EMAIL_VERIFY_PER_EMAIL },
      ])
    }

    default: {
      return true
    }
  }
}

/**
 * The host that selects the auth surface (portal, partner or platform).
 *
 * @note this must be the serving Host header, never the asserted frontend
 * host: behind the portal gateway the frontend host is the customer's own
 * domain, which no host table recognises, so dispatching on it silently
 * falls back to the platform's providers and adapter on portal domains.
 *
 * @param {import('@/lib/header').AnyRequest} req
 * @returns {string|null}
 */
export function getDispatchHost(req) {
  return getHeader(req, 'host') || getContextRequestHost() || null
}

export default withAny(async function (req) {
  debug(`auth handler`, { url: req.url })

  const dispatchHost = getDispatchHost(req)

  const nextAuthHandler = NextAuth({
    ...defaultAuthOptions,

    // @note the initial adapter is only used to facilitate the creation of the
    // initial session so it must closely follow the actual adapter that will be
    // used elsewhere in the application

    adapter: await getInitialAdapter(dispatchHost),

    // @note providers are only used during the signin

    providers: await getProviders(dispatchHost),

    // @note the initial callbacks are only used to facilitate the creation of
    // the initial session so they must closely follow the actual callbacks that
    // will be used elsewhere in the application

    callbacks: await getInitialCallbacks(dispatchHost),
  })

  const contextReq = getContextNextApiRequest()

  {
    // @note this is an unlikely scenario but it's better to be safe than sorry

    if (!contextReq) {
      throw new Error('Unexpected state: missing context request')
    }
  }

  const contextRes = getContextNextApiResponse()

  {
    // @note this is an unlikely scenario but it's better to be safe than sorry

    if (!contextRes) {
      throw new Error('Unexpected state: missing context response')
    }
  }

  if (!(await checkSigninRate(contextReq))) {
    contextRes.status(429).json({
      message: TOO_MANY_ATTEMPTS_MESSAGE,
      code: 'TOO_MANY_REQUESTS',
    })

    return new Response('', {
      status: 599,
      statusText: 'DO_NOT_USE',
    })
  }

  /**
   * This function is responsible for rewriting absolute URLs to their relative
   * counterparts. This is necessary to ensure that NextAuth works in dynamic
   * environments where the host is not known in advance.
   *
   * @param {string} input
   * @returns {string}
   */
  function fixUrls(input) {
    debug(`fixing urls`, { input })

    // @note only run if there is an input to process

    if (input) {
      // @note do not rewrite google or github urls
      // @todo find a better way to do this

      if (!/google|azure-ad|github/i.test(input)) {
        for (const prefix of ['http://', 'https://']) {
          input = input.replaceAll(`${prefix}${dispatchHost}`, '')

          // just in case we need to handle the double encoding of the prefix up-to
          // 5 times to ensure that we catch all possible cases
          {
            let doubleEncodedPrefix = prefix

            for (let i = 0; i < 5; i++) {
              doubleEncodedPrefix = encodeURIComponent(doubleEncodedPrefix)

              input = input.replaceAll(doubleEncodedPrefix, '')
            }
          }
        }
      }
    }

    debug(`fixed urls`, { input })

    return input
  }

  await nextAuthHandler(
    // @note proxy the context request for more control

    new Proxy(contextReq, {
      get(target, prop, receiver) {
        return Reflect.get(target, prop, receiver)
      },
    }),

    // @note proxy the context response for more control

    new Proxy(contextRes, {
      get(target, prop, receiver) {
        switch (prop) {
          case 'status': {
            return (code) => {
              debug(`setting response status`, { code })

              const statusFn = Reflect.get(target, prop, receiver)

              const status = statusFn(code)

              return new Proxy(status, {
                get(target, prop, receiver) {
                  switch (prop) {
                    case 'setHeader': {
                      return (name, value) => {
                        debug(`setting response header`, { name, value })

                        if (name === 'Location') {
                          value = fixUrls(value)
                        }

                        return Reflect.get(target, prop, receiver)(name, value)
                      }
                    }
                  }

                  return Reflect.get(target, prop, receiver)
                },
              })
            }
          }

          case 'send': {
            return (body) => {
              debug(`sending response`, { body })

              if (typeof body === 'string') {
                body = fixUrls(body)
              } else {
                body = tryParseJson(fixUrls(tryStringifyJson(body)))
              }

              debug(`fixed response`, { body })

              return Reflect.get(target, prop, receiver)(body)
            }
          }

          case 'json': {
            return (body) => {
              debug(`sending json response`, { body })

              body = tryParseJson(fixUrls(tryStringifyJson(body)))

              debug(`fixed response`, { body })

              return Reflect.get(target, prop, receiver)(body)
            }
          }
        }

        return Reflect.get(target, prop, receiver)
      },
    })
  )

  // @note return a signal avoid the handler from returning a Response - this is
  // an internal special case for this specific purpose

  return new Response('', {
    status: 599,
    statusText: 'DO_NOT_USE',
  })
})
