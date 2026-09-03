// @ts-check
import { ONE_MINUTE_IN_SECONDS } from '@chatbotkit-dev/time'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { swrCache } from '@/lib/cache'
import debug from '@/lib/debug'
import fetch from '@/lib/egress.fetch'
import { getExternalAPIHostURL } from '@/lib/host'
import { isParsable as isParsableJson, parse as parseJson } from '@/lib/json'
import { isParsable as isParsableQuery, parse as parseQuery } from '@/lib/query'
import { sha256 } from '@/lib/webcrypto'

/**
 * @param {{
 *   accessToken: string,
 *   oAuthIntegration?: {
 *     validateUrl?: string?,
 *   }?,
 * }} options
 * @returns {Promise<null|'valid'|'invalid'>}
 */
export async function validateAccessToken(options) {
  debug(`validateAccessToken`, { options }).log(
    'oauth.token.validateAccessToken'
  )

  if (!options?.oAuthIntegration?.validateUrl) {
    debug(`no validateUrl provided`).log('oauth.token.validateAccessToken')

    return null
  }

  const validateUrl = new URL(
    options.oAuthIntegration.validateUrl,
    getExternalAPIHostURL()
  )

  return await swrCache(
    `oauth:revalidate:swr:${validateUrl.href}:${await sha256(
      options.accessToken
    )}`,
    ONE_MINUTE_IN_SECONDS,
    async () => {
      switch (validateUrl.href) {
        // @todo it will be useful to abstract away these requests - perhaps we
        // should use an auxiliary service for that

        case 'slack://auth.test': {
          const response = await fetch('https://slack.com/api/auth.test', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${options.accessToken}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          })

          if (!response.ok) {
            debug(`unsuccessful response`, {
              status: response.status,
              statusText: response.statusText,
            }).log('oauth.token.validateAccessToken')

            return 'invalid'
          } else {
            debug(`successful response`, {
              status: response.status,
              statusText: response.statusText,
            }).log('oauth.token.validateAccessToken')
          }

          const data = await response.text()

          let info

          try {
            info = JSON.parse(data)
          } catch {
            debug(`response is not parsable as JSON`, {
              data,
            }).log('oauth.token.validateAccessToken')

            info = {}
          }

          if (info.ok) {
            return 'valid'
          } else {
            debug(`invalid response`, {
              info,
            }).log('oauth.token.validateAccessToken')

            return 'invalid'
          }
        }

        // @todo it will be useful to abstract away these requests - perhaps we
        // should use an auxiliary service for that

        case 'atlassian://oauth/token/accessible-resources': {
          const response = await fetch(
            'https://api.atlassian.com/oauth/token/accessible-resources',
            {
              headers: {
                Authorization: `Bearer ${options.accessToken}`,
              },
            }
          )

          if (!response.ok) {
            debug(`unsuccessful response`, {
              status: response.status,
              statusText: response.statusText,
            }).log('oauth.token.validateAccessToken')

            return 'invalid'
          } else {
            debug(`successful response`, {
              status: response.status,
              statusText: response.statusText,
            }).log('oauth.token.validateAccessToken')
          }

          const data = await response.text()

          let info

          try {
            info = JSON.parse(data)
          } catch {
            debug(`response is not parsable as JSON`, {
              data,
            }).log('oauth.token.validateAccessToken')

            info = {}
          }

          if (Array.isArray(info) && info.length > 0) {
            return 'valid'
          } else {
            debug(`invalid response`, {
              info,
            }).log('oauth.token.validateAccessToken')

            return 'invalid'
          }
        }

        default: {
          const response = await fetch(validateUrl.href, {
            headers: {
              Authorization: `Bearer ${options.accessToken}`,
            },
          })

          // @note a valid token usually returns a 2xx status code - any other
          // code usually indicates the token is invalid

          return response.ok ? 'valid' : 'invalid'
        }
      }
    }
  )
}

/**
 * @param {{
 *   accessToken?: string?,
 *   accessTokenExpiresAt?: (Date|number|string)?,
 *   refreshToken?: string?,
 *   refreshTokenExpiresAt?: (Date|number|string)?,
 *   oAuthIntegration?: {
 *     clientId?: string?,
 *     clientSecret?: string?,
 *     tokenUrl?: string?,
 *     validateUrl?: string?,
 *     grantType?: string?,
 *   }?,
 *   updateToken: (accessToken: string, accessTokenExpiresAt?: Date, refreshToken?: string, refreshTokenExpiresAt?: Date) => Promise<void>,
 * }} options
 * @returns {Promise<string|null>}
 */
export async function obtainAccessToken(options) {
  debug(`obtainAccessToken`, { options }).log('oauth.token.getAccessToken')

  // check the access token first

  if (options.accessToken) {
    if (options.accessTokenExpiresAt) {
      if (new Date(options.accessTokenExpiresAt) > new Date()) {
        return options.accessToken
      } else {
        debug(`access token expired`, {
          accessTokenExpiresAt: new Date(options.accessTokenExpiresAt),
          now: new Date(),
        }).log('oauth.token.getAccessToken')
      }
    } else {
      return options.accessToken
    }
  } else {
    debug(`no access token`).log('oauth.token.getAccessToken')
  }

  // check the refresh token

  if (options.refreshToken) {
    if (options.refreshTokenExpiresAt) {
      if (new Date(options.refreshTokenExpiresAt) < new Date()) {
        debug(`refresh token expired`, {
          refreshTokenExpiresAt: new Date(options.refreshTokenExpiresAt),
          now: new Date(),
        }).log('oauth.token.getAccessToken')

        return null
      }
    }

    if (!options.oAuthIntegration) {
      debug(`no oAuthIntegration`).log('oauth.token.getAccessToken')

      return null
    }

    if (!options.oAuthIntegration.tokenUrl) {
      debug(`no tokenUrl`).log('oauth.token.getAccessToken')

      return null
    }

    if (!options.oAuthIntegration.clientId) {
      debug(`no clientId`).log('oauth.token.getAccessToken')

      return null
    }

    // @note clientSecret is optional for PKCE/public clients

    const body = {
      grant_type: 'refresh_token',
      refresh_token: options.refreshToken,
      client_id: options.oAuthIntegration.clientId,
    }

    // @note only include client_secret if provided (confidential clients)

    if (options.oAuthIntegration.clientSecret) {
      body.client_secret = options.oAuthIntegration.clientSecret
    }

    const tokenUrl = getExternalAPIHostURL(options.oAuthIntegration.tokenUrl)

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body),
    })

    if (!response.ok) {
      // @note before troubleshooting any further, make sure you check that you
      // are using the right client ID and client secret as it is the case that
      // platform secrets (for example) can have multiple variations depending
      // on the environment (development, staging, production, etc.)

      // @todo an alternative approach is to to always refresh the token with
      // the known client id that issued it - perhaps this is something we can
      // store in memory (encrypted) and use it upon refresh

      debug(`unsuccessful response`, {
        status: response.status,
        statusText: response.statusText,
      }).log('oauth.token.getAccessToken')

      return null
    }

    const text = await response.text()

    let info

    {
      switch (true) {
        case isParsableJson(text): {
          info = parseJson(text)

          break
        }

        case isParsableQuery(text): {
          info = parseQuery(text)

          break
        }

        default: {
          throw new Error('Response is not parsable')
        }
      }
    }

    // @note validate that the response contains a valid access_token

    if (!info.access_token) {
      debug(`token response missing access_token`, { info }).log(
        'oauth.token.getAccessToken'
      )

      return null
    }

    await options.updateToken(
      info.access_token,
      info.expires_in
        ? new Date(Date.now() + info.expires_in * 1000)
        : undefined,

      info.refresh_token || undefined,
      info.refresh_token_expires_in
        ? new Date(Date.now() + info.refresh_token_expires_in * 1000)
        : undefined
    )

    return info.access_token
  } else {
    debug(`no refresh token`).log('oauth.token.getAccessToken')
  }

  // check grant type is client_credentials

  if (options.oAuthIntegration?.grantType === 'client_credentials') {
    if (options.oAuthIntegration?.tokenUrl) {
      if (options.oAuthIntegration?.clientId) {
        if (options.oAuthIntegration?.clientSecret) {
          const ccTokenUrl = getExternalAPIHostURL(
            options.oAuthIntegration.tokenUrl
          )

          const response = await fetch(ccTokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: options.oAuthIntegration.clientId,
              client_secret: options.oAuthIntegration.clientSecret,
            }),
          })

          if (!response.ok) {
            debug(`unsuccessful response`, {
              status: response.status,
              statusText: response.statusText,
            }).log('oauth.token.getAccessToken')

            return null
          }

          const text = await response.text()

          let info

          {
            switch (true) {
              case isParsableJson(text): {
                info = parseJson(text)

                break
              }

              case isParsableQuery(text): {
                info = parseQuery(text)

                break
              }

              default: {
                throw new Error('Response is not parsable')
              }
            }
          }

          // @note validate that the response contains a valid access_token

          if (!info.access_token) {
            debug(`token response missing access_token`, { info }).log(
              'oauth.token.getAccessToken'
            )

            return null
          }

          await options.updateToken(
            info.access_token,
            info.expires_in
              ? new Date(Date.now() + info.expires_in * 1000)
              : undefined
          )

          return info.access_token
        } else {
          debug(`no clientSecret`).log('oauth.token.getAccessToken')
        }
      } else {
        debug(`no clientId`).log('oauth.token.getAccessToken')
      }
    } else {
      debug(`no tokenUrl`).log('oauth.token.getAccessToken')
    }
  }

  return null
}

/**
 * @param {{
 *   accessToken?: string?,
 *   accessTokenExpiresAt?: (Date|number|string)?,
 *   refreshToken?: string?,
 *   refreshTokenExpiresAt?: (Date|number|string)?,
 *   oAuthIntegration?: {
 *     clientId?: string?,
 *     clientSecret?: string?,
 *     tokenUrl?: string?,
 *     validateUrl?: string?,
 *   }?,
 *   updateToken: (accessToken: string, accessTokenExpiresAt?: Date, refreshToken?: string, refreshTokenExpiresAt?: Date) => Promise<void>,
 *   revokeToken?: (accessToken: string) => Promise<void>,
 * }} options
 * @returns {Promise<string|null>}
 */
export async function getAccessToken(options) {
  debug(`getAccessToken`, { options }).log('oauth.token.getAccessToken')

  const accessToken = await obtainAccessToken(options)

  if (!accessToken) {
    debug(`no access token obtained`).log('oauth.token.getAccessToken')

    if (options.accessToken) {
      if (options.revokeToken) {
        await options.revokeToken(options.accessToken)
      }
    }

    return null
  }

  const validation = await validateAccessToken({
    accessToken: accessToken,

    oAuthIntegration: {
      ...options.oAuthIntegration,
    },
  })

  debug(`validation result`, { validation }).log('oauth.token.getAccessToken')

  switch (validation) {
    case null: {
      debug(`no validation URL provided`).log('oauth.token.getAccessToken')

      return accessToken
    }

    case 'valid': {
      debug(`access token is valid`).log('oauth.token.getAccessToken')

      return accessToken
    }

    case 'invalid': {
      debug(`access token is invalid`).log('oauth.token.getAccessToken')

      if (options.revokeToken) {
        await options.revokeToken(accessToken)
      }

      return null
    }

    default: {
      assertUnreachable(validation)
    }
  }
}
