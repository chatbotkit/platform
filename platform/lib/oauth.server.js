// @ts-check
import {
  accessTokenLifetime,
  allowBearerTokensInQueryString,
  refreshTokenLifetime,
} from '@/config/oauth'

import prisma from '@/prisma/client'

import { digestCredential } from '@/lib/credential.digest'
import memcache from '@/lib/memcache'
import { timingSafeEqual } from '@/lib/webcrypto'

import OAuth2Server from '@node-oauth/oauth2-server'

import crypto from 'crypto'

export { Request, Response } from '@node-oauth/oauth2-server'

/**
 * @implements {OAuth2Server.AuthorizationCodeModel}
 */
class Model {
  /**
   * @param {OAuth2Server.Client} client
   * @param {OAuth2Server.User} user
   * @param {string[]} scope
   * @returns {Promise<string>}
   */
  async generateAccessToken(client, user, scope) {
    client
    user
    scope

    return `oaac-${crypto.randomBytes(32).toString('hex')}`
  }

  /**
   * @param {OAuth2Server.Client} client
   * @param {OAuth2Server.User} user
   * @param {string[]} scope
   * @returns {Promise<string>}
   */
  async generateRefreshToken(client, user, scope) {
    client
    user
    scope

    return `oart-${crypto.randomBytes(32).toString('hex')}`
  }

  /**
   * @param {string} clientId
   * @param {string} [clientSecret]
   * @returns {Promise<OAuth2Server.Client|null>}
   */
  async getClient(clientId, clientSecret) {
    if (!clientId) {
      return null
    }

    const application = await prisma.oAuthApplication.findUnique({
      where: {
        clientId: clientId,
      },
    })

    if (!application) {
      return null
    }

    if (clientSecret) {
      const clientSecretDigest = await digestCredential(clientSecret)

      if (!timingSafeEqual(application.clientSecret, clientSecretDigest)) {
        return null
      }
    }

    /**
     * @type {OAuth2Server.Client}
     */
    const result = {
      id: application.clientId,

      redirectUris: application.redirectUris,

      grants: application.grants,

      accessTokenLifetime:
        Math.max(0, application.accessTokenLifetime || 0) || undefined,
      refreshTokenLifetime:
        Math.max(0, application.refreshTokenLifetime || 0) || undefined,
    }

    return result
  }

  /**
   * @param {string} username
   * @param {string} password
   * @returns {Promise<OAuth2Server.User|null>}
   */
  async getUser(username, password) {
    username
    password

    return null
  }

  /**
   * @param {string} lookupToken
   * @returns {Promise<OAuth2Server.Token|null>}
   */
  async getAccessToken(lookupToken) {
    const accessTokenDigest = await digestCredential(lookupToken)

    const token = await prisma.oAuthApplicationToken.findUnique({
      where: {
        accessToken: accessTokenDigest,
      },

      include: {
        application: true,
      },
    })

    if (!token) {
      return null
    }

    if (!token.accessToken) {
      return null
    }

    /**
     * @type {OAuth2Server.Token}
     */
    const result = {
      accessToken: lookupToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt || undefined,

      ...(Array.isArray(token.scopes) && token.scopes.length
        ? { scope: token.scopes }
        : {}),

      client: {
        id: token.application.clientId,
        grants: token.application.grants,
        redirectUris: token.application.redirectUris,
      },

      user: {
        id: token.userId,
      },
    }

    if (
      token.accessTokenExpiresAt &&
      token.accessTokenExpiresAt.getTime() <= Date.now()
    ) {
      await prisma.oAuthApplicationToken.delete({
        where: {
          id: token.id,
        },
      })

      return null
    }

    return result
  }

  /**
   * @param {string} lookupToken
   * @returns {Promise<OAuth2Server.RefreshToken|null>}
   */
  async getRefreshToken(lookupToken) {
    const refreshTokenDigest = await digestCredential(lookupToken)

    const token = await prisma.oAuthApplicationToken.findUnique({
      where: {
        refreshToken: refreshTokenDigest,
      },

      include: {
        application: true,
      },
    })

    if (!token) {
      return null
    }

    if (!token.refreshToken) {
      return null
    }

    /**
     * @type {OAuth2Server.RefreshToken}
     */
    const result = {
      refreshToken: lookupToken,

      ...(Array.isArray(token.scopes) && token.scopes.length
        ? { scope: token.scopes }
        : {}),

      client: {
        id: token.application.clientId,
        grants: token.application.grants,
        redirectUris: token.application.redirectUris,
      },

      user: {
        id: token.userId,
      },
    }

    if (
      token.refreshTokenExpiresAt &&
      token.refreshTokenExpiresAt.getTime() <= Date.now()
    ) {
      await prisma.oAuthApplicationToken.delete({
        where: {
          id: token.id,
        },
      })

      return null
    }

    return result
  }

  /**
   * @param {OAuth2Server.RefreshToken} token
   * @returns {Promise<boolean>}
   */
  async revokeToken(token) {
    if (!token.refreshToken) {
      return false
    }

    const refreshTokenDigest = await digestCredential(token.refreshToken)

    const { count } = await prisma.oAuthApplicationToken.deleteMany({
      where: {
        refreshToken: refreshTokenDigest,
      },
    })

    return count > 0
  }

  /**
   * @param {OAuth2Server.Token} token
   * @param {OAuth2Server.Client} client
   * @param {OAuth2Server.User} user
   * @returns {Promise<OAuth2Server.Token|null>}
   */
  async saveToken(token, client, user) {
    const accessTokenDigest = await digestCredential(token.accessToken)
    const refreshTokenDigest = token.refreshToken
      ? await digestCredential(token.refreshToken)
      : undefined

    await prisma.oAuthApplicationToken.create({
      data: {
        accessToken: accessTokenDigest,
        accessTokenExpiresAt: token.accessTokenExpiresAt,

        refreshToken: refreshTokenDigest,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,

        scopes: token.scope
          ? Array.isArray(token.scope)
            ? token.scope
            : [token.scope]
          : [],

        user: {
          connect: {
            id: user.id,
          },
        },

        application: {
          connect: {
            clientId: client.id,
          },
        },
      },
    })

    /**
     * @type {OAuth2Server.Token}
     */
    const result = {
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,

      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,

      client: {
        ...client,
      },

      user: {
        ...user,
      },
    }

    return result
  }

  /**
   * @typedef {{
   *   token: string,
   *   redirectUri: string,
   *   scope: string[],
   *   codeChallenge?: string,
   *   codeChallengeMethod?: string,
   *   expiresAt: number,
   *   client: {
   *     id: string,
   *     grants: string[],
   *   },
   *   user: {
   *     id: string
   *   }
   * }} AuthorizationCodeInstance
   */

  /**
   * @param {string} authorizationCode
   * @returns {Promise<OAuth2Server.AuthorizationCode|null>}
   */
  async getAuthorizationCode(authorizationCode) {
    if (!authorizationCode) {
      return null
    }

    const key = `oauth:authorization-code:${authorizationCode}`

    /**
     * @type {AuthorizationCodeInstance|null}
     */
    const authorizationCodeInstance = await memcache.get(key)

    if (!authorizationCodeInstance) {
      return null
    }

    /** @type {OAuth2Server.AuthorizationCode} */
    const result = {
      authorizationCode: authorizationCodeInstance.token,

      redirectUri: authorizationCodeInstance.redirectUri,

      scope: authorizationCodeInstance.scope,

      expiresAt: new Date(authorizationCodeInstance.expiresAt),

      client: {
        id: authorizationCodeInstance.client.id,
        grants: authorizationCodeInstance.client.grants,
      },

      user: {
        id: authorizationCodeInstance.user.id,
      },
    }

    if (result.expiresAt.getTime() <= Date.now()) {
      await this.revokeAuthorizationCode(result)

      return null
    }

    return result
  }

  /**
   * @param {Pick<OAuth2Server.AuthorizationCode,'authorizationCode'|'expiresAt'|'redirectUri'|'scope'>} authorizationCode
   * @param {OAuth2Server.Client} client
   * @param {OAuth2Server.User} user
   * @returns {Promise<OAuth2Server.AuthorizationCode|null>}
   */
  async saveAuthorizationCode(authorizationCode, client, user) {
    const key = `oauth:authorization-code:${authorizationCode.authorizationCode}`

    /**
     * @type {AuthorizationCodeInstance}
     */
    const authorizationCodeInstance = {
      token: authorizationCode.authorizationCode,

      redirectUri: authorizationCode.redirectUri,

      scope: authorizationCode.scope
        ? Array.isArray(authorizationCode.scope)
          ? authorizationCode.scope
          : [authorizationCode.scope]
        : [],

      // codeChallenge: authorizationCode.codeChallenge || "",
      // codeChallengeMethod: authorizationCode.codeChallengeMethod || "",

      expiresAt: authorizationCode.expiresAt.getTime(),

      user: {
        id: user.id,
      },

      client: {
        id: client.id,

        grants: client.grants
          ? Array.isArray(client.grants)
            ? client.grants
            : [client.grants]
          : [],
      },
    }

    const expiresInSeconds = Math.floor(
      (authorizationCode.expiresAt.getTime() - Date.now()) / 1000
    )

    await memcache.set(key, authorizationCodeInstance, {
      ex: expiresInSeconds,
    })

    /**
     * @type {OAuth2Server.AuthorizationCode}
     */
    const result = {
      ...authorizationCode,

      client: {
        ...client,
      },

      user: {
        ...user,
      },
    }

    return result
  }

  /**
   * @param {OAuth2Server.AuthorizationCode} authorizationCode
   * @returns {Promise<boolean>}
   */
  async revokeAuthorizationCode(authorizationCode) {
    const key = `oauth:authorization-code:${authorizationCode.authorizationCode}`

    const result = await memcache.del(key)

    return !!result
  }

  /**
   * The platform defines no OAuth scope model: every OAuth application token
   * deliberately grants full API access, exactly like an API secret key, and
   * the consent screen presents it that way. A request that names scopes is
   * therefore refused (invalid_scope) rather than recorded - a token echoing
   * a scope it does not enforce would tell the client it holds less than it
   * does. A future granular scope model must version these existing
   * full-access grants rather than assigning new meaning to their empty
   * scope.
   *
   * @param {OAuth2Server.User} user
   * @param {OAuth2Server.Client} client
   * @param {string[]} [scope]
   * @returns {Promise<string[]|false>}
   */
  async validateScope(user, client, scope) {
    user
    client

    if (Array.isArray(scope) && scope.length > 0) {
      return false
    }

    return []
  }

  /**
   * See validateScope above: with no scope model, every token carries the
   * full grant. This hook only runs when authenticate() is asked for a
   * specific scope, which the platform never does - API authentication goes
   * through lib/session.get.js instead.
   *
   * @param {OAuth2Server.Token} token
   * @param {string[]} scope
   * @returns {Promise<boolean>}
   */
  async verifyScope(token, scope) {
    token
    scope

    return true
  }
}

export const oauth2 = new OAuth2Server({
  model: new Model(),

  accessTokenLifetime,
  refreshTokenLifetime,

  allowBearerTokensInQueryString,
})

export default oauth2

/**
 * Returns the redirect URI only when it exactly matches one of the redirect
 * URIs registered for the client. Every error or denial redirect must pass
 * this check - redirecting to an unregistered URI is an open redirect, and
 * these paths bypass the registered-client validation the successful
 * authorization flow performs.
 *
 * @param {string|undefined} clientId
 * @param {string|undefined} redirectUri
 * @returns {Promise<string|null>}
 */
export async function getValidatedRedirectUri(clientId, redirectUri) {
  if (!clientId || !redirectUri) {
    return null
  }

  const application = await prisma.oAuthApplication.findUnique({
    where: {
      clientId: clientId,
    },
  })

  if (!application) {
    return null
  }

  if (!application.redirectUris.includes(redirectUri)) {
    return null
  }

  return redirectUri
}

/**
 * @param {import('@node-oauth/oauth2-server').Response} response
 * @param {import('next').NextApiResponse} res
 */
export async function responseToResponse(response, res) {
  res.status(response.status || 200)

  for (const key in response.headers) {
    res.setHeader(key, response.headers[key])
  }

  res.setHeader('cache-control', 'no-store')

  if (response.body) {
    res.setHeader('content-type', 'application/json')

    res.end(JSON.stringify(response.body))
  }
}

/**
 * @param {Error} error
 * @param {import('next').NextApiResponse} res
 * @param {{request: import('@node-oauth/oauth2-server').Request, response: import('@node-oauth/oauth2-server').Response}} context
 */
export async function errorToResponse(error, res, context) {
  if (context.response.status === 302) {
    await responseToResponse(context.response, res)

    return
  }

  const { client_id, redirect_uri } = context.request.query || {}

  // @note redirect only to an exact registered redirect URI of the named
  // client - anything else must fail directly, or the error path becomes an
  // open redirect for arbitrary parseable URIs

  const validatedRedirectUri = await getValidatedRedirectUri(
    Array.isArray(client_id) ? client_id[0] : client_id,
    Array.isArray(redirect_uri) ? redirect_uri[0] : redirect_uri
  )

  if (validatedRedirectUri) {
    const url = new URL(validatedRedirectUri)

    url.searchParams.set('error', error.name)
    url.searchParams.set('error_description', error.message)

    res.status(302)
    res.setHeader('location', url.href)
    res.end()

    return
  }

  res.status(400)
  res.setHeader('content-type', 'application/json')
  res.end(
    JSON.stringify({
      error: error.name || 'invalid_request',
      error_description: error.message || 'The request is invalid',
    })
  )
}

/**
 * @param {Parameters<import('next').GetServerSideProps>[0]} context
 * @returns {import('next').NextApiRequest}
 */
export function getNextApiRequest(context) {
  return /** @type {import('next').NextApiRequest} */ (
    new Proxy(context.req, {
      get(target, prop, receiver) {
        if (prop === 'query') {
          return context.query
        }

        return Reflect.get(target, prop, receiver)
      },
    })
  )
}

/**
 * @param {Parameters<import('next').GetServerSideProps>[0]} context
 * @returns {import('next').NextApiResponse}
 */
export function getNextApiResponse(context) {
  return /** @type {import('next').NextApiResponse} */ (
    new Proxy(context.res, {
      get(target, prop, receiver) {
        if (prop === 'status') {
          return (code) => {
            target.statusCode = code

            return target
          }
        }

        return Reflect.get(target, prop, receiver)
      },
    })
  )
}
