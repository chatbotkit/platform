import '@/lib/scope.server'

import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { encode as b64encode } from '@/lib/b64'
import { ttlCache } from '@/lib/cache'
import debug from '@/lib/debug'
import fetch, { getFetchError, withRetry, withTimeout } from '@/lib/fetch'
import { tryVerify } from '@/lib/jwt'
import { getClientCredentialsGrantCredentials } from '@/lib/oauth.authorization'
import { getSecretOAuthConfig } from '@/lib/secret.oauth'

/**
 *
 */
const PIPEDREAM_RELATIVE_APPS = ['.zendesk.com', '.gitlab.com', '.zoho.com']

/**
 * Gets fetch error.
 */
export const getCallError = getFetchError

/**
 * Gets Pipedream access token without caching.
 */
async function getPipedreamAccessTokenNow(secretId: string): Promise<string> {
  debug('getting pipedream access token for secret', { secretId }).log(
    'call.getPipedreamAccessTokenNow'
  )

  const secret = await prisma.secret.findUnique({
    where: { id: secretId },

    // @todo maybe add caching at the database level
  })

  if (!secret) {
    throw new Error('Secret not found')
  }

  const { clientId, clientSecret } = await getSecretOAuthConfig(secret)

  if (!clientId || !clientSecret) {
    throw new Error('Invalid OAuth configuration for secret')
  }

  const credentials = await getClientCredentialsGrantCredentials({
    clientId: clientId,
    clientSecret: clientSecret,
    tokenUrl: 'https://api.pipedream.com/v1/oauth/token',
  })

  return credentials.accessToken
}

/**
 * Gets Pipedream access token with caching.
 */
export function getPipedreamAccessToken(secretId: string): Promise<string> {
  debug(`call.getPipedreamAccessToken`, { secretId }).log(
    'call.getPipedreamAccessToken'
  )

  return ttlCache(
    `pipedream_access_token:${secretId}`,
    QUARTER_HOUR_IN_SECONDS,
    () => getPipedreamAccessTokenNow(secretId)
  )
}

/**
 * This function is a simple wrapper around the fetch API with ability to send
 * requests through specialized proxy servers.
 */
export async function call(
  url: string | URL,
  options: RequestInit = {}
): Promise<Response> {
  debug(`call`, { url, options }).log('call.call')

  // @note do not modify the options object directly to avoid side effects
  // unless further down when necessary

  if ('headers' in options) {
    const headers = new Headers(options.headers)

    if (headers.has('authorization')) {
      const auth = headers.get('authorization')

      if (auth) {
        const [, token] = auth.split(' ')

        if (token) {
          const payload = await tryVerify(token)

          debug(`token payload`, { payload }).log('call.call')

          if (payload) {
            if ('type' in payload) {
              switch (payload.type) {
                // @todo the 'pipedream_access_token' const needs to be
                // centralized for better maintainability

                case 'pipedream_access_token': {
                  const targetUrl = new URL(url)

                  let destination = targetUrl.href

                  if (
                    PIPEDREAM_RELATIVE_APPS.some((app) =>
                      targetUrl.host.endsWith(app)
                    )
                  ) {
                    destination = targetUrl.pathname + targetUrl.search
                  }

                  const proxyUrl = new URL(
                    `https://api.pipedream.com/v1/connect/${
                      payload.projectId
                    }/proxy/${b64encode(destination, true)}`
                  )

                  proxyUrl.searchParams.set(
                    'external_user_id',
                    payload.externalUserId
                  )

                  proxyUrl.searchParams.set('account_id', payload.accountId)

                  url = proxyUrl

                  headers.set(
                    'authorization',
                    `Bearer ${await getPipedreamAccessToken(payload.secretId)}`
                  )

                  headers.set('x-pd-environment', payload.environment)

                  // @note collect headers to proxy, then remove originals to
                  // avoid duplicates

                  const headersToProxy: Array<[string, string]> = []

                  for (const name of headers.keys()) {
                    if (name === 'authorization') {
                      continue
                    }

                    if (name.startsWith('x-pd-')) {
                      continue
                    }

                    const value = headers.get(name)

                    if (value) {
                      headersToProxy.push([name, value])
                    }
                  }

                  // @note set prefixed headers and remove originals

                  for (const [name, value] of headersToProxy) {
                    headers.set(`x-pd-proxy-${name}`, value)
                    headers.delete(name)
                  }

                  options = {
                    ...options,

                    headers,
                  }

                  break
                }

                default: {
                  debug(`unknown type found in token payload`, {
                    type: payload.type,
                  }).log('call.call')
                }
              }
            } else {
              debug(`no type found in token payload`).log('call.call')
            }
          }
        } else {
          debug(`no token found after splitting authorization header`).log(
            'call.call'
          )
        }
      } else {
        debug(`no token found in authorization header`).log('call.call')
      }
    } else {
      debug(`no authorization header found`).log('call.call')
    }

    debug(`using headers`, { headers: Array.from(headers.entries()) }).log(
      'call.call'
    )

    // @note don not needless set the header here if no modifications were made
  }

  debug(`fetching`, { url, options }).log('call.call')

  return fetch(url, options)
}

/**
 * A wrapper around the fetch API with automatic retries and timeouts.
 */
export default call

/**
 * A version of call with both timeout and retry capabilities.
 */
export const callPlusPlus = withRetry(withTimeout(call))
