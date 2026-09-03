/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Pipedream) */
import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { error } from '@/lib/debug'
import fetch from '@/lib/fetch'
import { getExternalFrontendHostURL } from '@/lib/host'
import { trySign, tryVerify } from '@/lib/jwt'
import memcache from '@/lib/memcache'
import { withGet } from '@/lib/method'
import { redirect } from '@/lib/response'
import type {
  ContactState,
  DirectState,
  EphemeralState,
} from '@/lib/secret.manager'
import { getSecretOAuthConfig } from '@/lib/secret.oauth'

import { v4 as uuidv4 } from 'uuid'

export interface TempState {
  userId: string
  secretId: string

  clientId: string

  projectId: string
  environment: string
  externalUserId: string
  expiresAt: string

  state: string
  redirectUri: string
}

export interface CodePayload {
  userId: string
  secretId: string

  clientId: string

  projectId: string
  environment: string
  externalUserId: string
  expiresAt: string

  accountId: string
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function oauthError(
  status: number,
  errorCode: string,
  errorDescription: string
): Response {
  return new Response(
    JSON.stringify({ error: errorCode, error_description: errorDescription }),
    { status, headers: JSON_HEADERS }
  )
}

function redirectWithError(
  redirectUri: string,
  errorCode: string,
  errorDescription: string,
  state?: string
): Response {
  const redirectUrl = new URL(redirectUri)

  redirectUrl.searchParams.append('error', errorCode)
  redirectUrl.searchParams.append('error_description', errorDescription)

  if (state) {
    redirectUrl.searchParams.append('state', state)
  }

  return redirect(redirectUrl)
}

/**
 * Custom OAuth authorization endpoint for Pipedream with interactive Connect
 * authentication flow.
 *
 * This endpoint implements a two-phase interactive OAuth flow:
 *
 * Phase 1 - Initial authorization request:
 * 1. Client requests authorization with client_id, redirect_uri, state, etc.
 * 2. State contains secretId - we retrieve client_secret from database
 * 3. We obtain Pipedream OAuth token (client_credentials)
 * 4. We create a Pipedream Connect token for the user
 * 5. We store callback state in Redis with a unique state ID (15-min TTL)
 * 6. We update the Connect token with callback URL containing the state ID
 * 7. We redirect user to Pipedream Connect UI for account authentication
 * 8. Pipedream redirects back to this endpoint after user authenticates
 *
 * Phase 2 - Callback from Pipedream:
 * 1. Receive callback from Pipedream with state ID parameter
 * 2. Retrieve callback state from Redis using the state ID
 * 3. Generate authorization code with Connect token embedded
 * 4. Redirect to client's redirect_uri with the code
 * 5. Client exchanges code for token via /token endpoint
 *
 * @note Pipedream does not preserve custom URL parameters during the OAuth
 * flow, so we must store state in Redis and pass only the state ID in the
 * callback URL configured on the Connect token itself.
 */
export default withGet(async function (req: Request): Promise<Response> {
  const url = new URL(req.url)

  // @note we need to differentiate between initial request and callback initial
  // request has client_id, redirect_uri; callback has only state

  if (url.searchParams.get('stateId')) {
    // phase 2: handle callback from pipedream

    return handlePipedreamCallback(url)
  } else {
    // phase 1: initial authorization request

    return handleInitialAuthorization(url)
  }
})

/**
 * Phase 1: Handle initial authorization request
 */
async function handleInitialAuthorization(url: URL): Promise<Response> {
  const environment = url.searchParams.get('environment')
  const projectId = url.searchParams.get('projectId')
  const app = url.searchParams.get('app')
  const client_id = url.searchParams.get('client_id')
  const redirect_uri = url.searchParams.get('redirect_uri')
  const state = url.searchParams.get('state')
  const scope = url.searchParams.get('scope')
  const response_type = url.searchParams.get('response_type')

  debug(`received authorization request`, {
    environment,
    projectId,
    app,
    client_id,
    redirect_uri,
    state,
    scope,
    response_type,
  }).log(
    'auxiliary.secret.oauth.pipedream.authorize.handleInitialAuthorization'
  )

  // @note nothing may redirect before the redirect_uri is validated against
  // the signed state below - an error redirect to an unvalidated URI is an
  // open redirect, so everything up to that point answers directly

  if (!redirect_uri) {
    return oauthError(
      400,
      'invalid_request',
      'Missing or invalid redirect_uri parameter'
    )
  }

  if (!state) {
    return oauthError(
      400,
      'invalid_request',
      'Missing or invalid state parameter'
    )
  }

  let payload: (DirectState | EphemeralState | ContactState) & {
    redirectUri?: string
  }

  try {
    const verified = await tryVerify(state)

    if (!verified || typeof verified !== 'object') {
      throw new Error('Invalid state')
    }

    payload = verified as typeof payload // @todo use zod to validate structure

    if (!payload.secretId) {
      throw new Error('Missing secretId in state')
    }
  } catch {
    return oauthError(400, 'invalid_request', 'Invalid or expired state token')
  }

  // @note the signed state carries the exact redirect_uri this authorization
  // URL was minted with (bound in getAuthorizationURL); the request must
  // present that value and nothing else

  if (!payload.redirectUri || payload.redirectUri !== redirect_uri) {
    return oauthError(
      400,
      'invalid_request',
      'The redirect_uri does not match the one bound to the state token'
    )
  }

  /**
   * Helper closure to redirect OAuth errors to the client's redirect_uri
   * instead of returning JSON responses. This follows OAuth 2.0 spec and
   * provides a better user experience. Only callable after the redirect_uri
   * has been validated against the signed state above.
   */
  const redirectError = (
    errorCode: string,
    errorDescription: string
  ): Response => {
    return redirectWithError(redirect_uri, errorCode, errorDescription, state)
  }

  if (!environment) {
    return redirectError(
      'invalid_request',
      'Missing or invalid environment parameter'
    )
  }

  if (!projectId) {
    return redirectError(
      'invalid_request',
      'Missing or invalid projectId parameter'
    )
  }

  if (!app) {
    // @todo validate against allowed / known list to avoid common errors

    return redirectError('invalid_request', 'Missing or invalid app parameter')
  }

  if (!client_id) {
    return redirectError(
      'invalid_request',
      'Missing or invalid client_id parameter'
    )
  }

  if (response_type !== 'code') {
    return redirectError(
      'unsupported_response_type',
      'Only response_type=code is supported'
    )
  }

  const externalUserId: string | null =
    'contact' in payload
      ? `contact:${payload.contact.id}`
      : 'ephemeral' in payload
        ? `namespace:${payload.ephemeral.namespace}`
        : 'direct' in payload
          ? `direct:${payload.direct.id}`
          : null

  if (!externalUserId) {
    return redirectError(
      'invalid_request',
      'Missing external user identifier in state (requires contact.id or ephemeral.namespace)'
    )
  }

  // step 1: obtain oauth access token using client_credentials

  const secret = await prisma.secret.findUnique({
    where: {
      id: payload.secretId,
    },
  })

  if (!secret) {
    return redirectError('invalid_request', 'Secret not found')
  }

  const oauthConfig = await getSecretOAuthConfig(secret)

  const { clientId, clientSecret } = oauthConfig

  if (!clientId || !clientSecret) {
    return redirectError(
      'invalid_request',
      'Missing OAuth credentials in secret configuration'
    )
  }

  // @note bind the transaction to the secret's own OAuth client - the
  // request's client_id must be the one the secret configuration names

  if (client_id !== clientId) {
    return redirectError(
      'invalid_request',
      'The client_id does not match the secret configuration'
    )
  }

  // @note projectId, environment and app are derived from the secret's own
  // configured authorization URL rather than trusted from the request - a
  // substituted projectId would land the connected account in someone else's
  // Pipedream project

  {
    let configuredParams: URLSearchParams

    try {
      configuredParams = new URL(oauthConfig.authorizationUrl || '', url.origin)
        .searchParams
    } catch {
      return redirectError(
        'invalid_request',
        'The secret configuration has no valid authorization URL'
      )
    }

    for (const [name, value] of [
      ['projectId', projectId],
      ['environment', environment],
      ['app', app],
    ]) {
      if (configuredParams.get(name) !== value) {
        return redirectError(
          'invalid_request',
          `The ${name} parameter does not match the secret configuration`
        )
      }
    }
  }

  let oauthAccessToken: string

  try {
    const tokenUrl = new URL('https://api.pipedream.com/v1/oauth/token')

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        // @note the scope comes from the secret's own configuration, not the
        // request query; an unset scope is sent as the empty string, exactly
        // as the query-derived value always was for a minted URL
        scope: oauthConfig.scope || '',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()

      throw new Error(
        `Pipedream OAuth token request failed: ${response.status} ${errorText}`
      )
    }

    const data = await response.json()

    oauthAccessToken = data.access_token

    if (!oauthAccessToken) {
      throw new Error('No access token in Pipedream OAuth response')
    }
  } catch (e) {
    return redirectError(
      'server_error',
      `Failed to obtain OAuth token from Pipedream: ${
        e instanceof Error ? e.message : 'Unknown error'
      }`
    )
  }

  // step 2: create connect token with callback to this endpoint

  // step 2a: delete previous connect accounts for this user (only for the same app)

  try {
    const accountsUrl = new URL(
      `https://api.pipedream.com/v1/connect/${projectId}/accounts`
    )

    accountsUrl.searchParams.append('external_user_id', externalUserId)

    // @note filter by app to only retrieve accounts for the specific
    // integration this prevents us from accidentally deleting accounts for
    // other apps

    accountsUrl.searchParams.append('app', app)

    const response = await fetch(accountsUrl.href, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${oauthAccessToken}`,
        'x-pd-environment': environment,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()

      throw new Error(
        `Pipedream Connect accounts retrieval failed: ${response.status} ${errorText}`
      )
    }

    const data = await response.json()

    if (data.data && Array.isArray(data.data)) {
      for (const account of data.data) {
        // @note only delete accounts that match the current app to avoid
        // deleting accounts for other integrations (e.g., don't delete
        // Zendesk account when authenticating Google Mail)
        if (account.id && account.app === app) {
          const deleteUrl = new URL(
            `https://api.pipedream.com/v1/connect/${projectId}/accounts/${account.id}`
          )

          const deleteResponse = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${oauthAccessToken}`,
              'x-pd-environment': environment,
            },
          })

          if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text()

            // @note log error but continue deleting other accounts

            error(
              `Failed to delete account ${account.id}: ${deleteResponse.status} ${errorText}`
            )
          }
        }
      }
    }
  } catch (e) {
    return redirectError(
      'server_error',
      `Failed to delete previous Connect accounts from Pipedream: ${
        e instanceof Error ? e.message : 'Unknown error'
      }`
    )
  }

  // step 2b: create the connect token

  const stateId = uuidv4()

  let connectLinkUrl: string
  let expiresAt: string

  try {
    const authorizeCallbackUrl = new URL(
      getExternalFrontendHostURL(
        '/api/auxiliary/secret/oauth/pipedream/authorize'
      )
    )

    authorizeCallbackUrl.searchParams.append('stateId', stateId)

    const tokensUrl = new URL(
      `https://api.pipedream.com/v1/connect/${projectId}/tokens`
    )

    const response = await fetch(tokensUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${oauthAccessToken}`,
        'Content-Type': 'application/json',
        'x-pd-environment': environment,
      },
      body: JSON.stringify({
        external_user_id: externalUserId,
        success_redirect_uri: authorizeCallbackUrl.href,
        error_redirect_uri: authorizeCallbackUrl.href,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()

      throw new Error(
        `Pipedream Connect token request failed: ${response.status} ${errorText}`
      )
    }

    const data = await response.json()

    connectLinkUrl = data.connect_link_url
    expiresAt = data.expires_at

    if (!connectLinkUrl) {
      throw new Error('No token or connect_link_url in Pipedream response')
    }
  } catch (e) {
    return redirectError(
      'server_error',
      `Failed to create Connect token from Pipedream: ${
        e instanceof Error ? e.message : 'Unknown error'
      }`
    )
  }

  // step 3: store callback state in redis with short-lived key

  const tempState: TempState = {
    userId: secret.userId,
    secretId: payload.secretId,

    clientId: client_id,

    projectId,
    environment,
    externalUserId,
    expiresAt,

    state: state,
    redirectUri: redirect_uri,
  }

  const redisKey = `pipedream:oauth:state:${stateId}`

  // @note store state in redis with 15 minute expiration to match jwt timeout

  await memcache.set(redisKey, tempState, {
    ex: QUARTER_HOUR_IN_SECONDS,
  })

  // step 4: redirect user to pipedream connect ui

  const pipedreamUrl = new URL(connectLinkUrl)

  pipedreamUrl.searchParams.append('app', app)

  return redirect(pipedreamUrl)
}

/**
 * Phase 2: Handle callback from Pipedream Connect UI
 */
async function handlePipedreamCallback(url: URL): Promise<Response> {
  const stateId = url.searchParams.get('stateId')
  const pipedream_error = url.searchParams.get('error')

  debug(`received Pipedream callback`, {
    stateId,
    pipedream_error,
  }).log('auxiliary.secret.oauth.pipedream.authorize.handlePipedreamCallback')

  if (!stateId) {
    return oauthError(
      400,
      'invalid_request',
      'Missing or invalid state parameter'
    )
  }

  // retrieve callback state from redis

  const redisKey = `pipedream:oauth:state:${stateId}`

  const tempState = await memcache.get<TempState>(redisKey)

  if (!tempState) {
    return oauthError(
      400,
      'invalid_request',
      'Invalid or expired state - not found in cache'
    )
  }

  /**
   * Helper closure to redirect OAuth errors to the client's redirect_uri
   * with proper state parameter. This follows OAuth 2.0 spec for error handling.
   */
  const redirectError = (
    errorCode: string,
    errorDescription: string
  ): Response => {
    return redirectWithError(
      tempState.redirectUri,
      errorCode,
      errorDescription,
      tempState.state
    )
  }

  // @note delete state from redis immediately after retrieval to prevent reuse

  await memcache.del(redisKey)

  if (pipedream_error) {
    return redirectWithError(
      tempState.redirectUri,
      pipedream_error,
      'Pipedream authentication failed',
      tempState.state
    )
  }

  // step 1: obtain oauth access token using client_credentials

  const secret = await prisma.secret.findUnique({
    where: {
      id: tempState.secretId,
    },
  })

  if (!secret) {
    return redirectError('invalid_request', 'Secret not found')
  }

  const { clientId, clientSecret } = await getSecretOAuthConfig(secret)

  if (!clientId || !clientSecret) {
    return redirectError(
      'invalid_request',
      'Missing OAuth credentials in secret configuration'
    )
  }

  let oauthAccessToken: string

  try {
    const tokenUrl = new URL('https://api.pipedream.com/v1/oauth/token')

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: '*', // @todo use appropriate scope
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()

      throw new Error(
        `Pipedream OAuth token request failed: ${response.status} ${errorText}`
      )
    }

    const data = await response.json()

    oauthAccessToken = data.access_token

    if (!oauthAccessToken) {
      throw new Error('No access token in Pipedream OAuth response')
    }
  } catch (e) {
    return redirectError(
      'server_error',
      `Failed to obtain OAuth token from Pipedream: ${
        e instanceof Error ? e.message : 'Unknown error'
      }`
    )
  }

  let accountId: string

  {
    const accountsUrl = new URL(
      `https://api.pipedream.com/v1/connect/${tempState.projectId}/accounts`
    )

    accountsUrl.searchParams.append(
      'external_user_id',
      tempState.externalUserId
    )

    const response = await fetch(accountsUrl.href, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${oauthAccessToken}`,
        'x-pd-environment': tempState.environment,
      },
    })

    if (!response.ok) {
      return redirectError(
        'server_error',
        `Failed to retrieve Connect account from Pipedream: ${
          response.status
        } ${await response.text()}`
      )
    }

    const data = await response.json()

    debug('connect accounts response', {
      externalUserId: tempState.externalUserId,
      environment: tempState.environment,
      accountCount: data.data?.length ?? 0,
      accounts: data.data,
    }).log('auxiliary.secret.oauth.pipedream.authorize.handlePipedreamCallback')

    if (
      !data.data ||
      !Array.isArray(data.data) ||
      data.data.length === 0 ||
      !data.data[0].id
    ) {
      return redirectError(
        'server_error',
        'No Connect account found for user in Pipedream'
      )
    }

    accountId = data.data[0].id
  }

  const codePayload: CodePayload = {
    userId: tempState.userId,
    secretId: tempState.secretId,
    clientId: tempState.clientId,

    projectId: tempState.projectId,
    environment: tempState.environment,
    externalUserId: tempState.externalUserId,
    expiresAt: tempState.expiresAt,

    accountId,
  }

  const code = await trySign(codePayload, QUARTER_HOUR_IN_SECONDS)

  if (!code) {
    return redirectError(
      'server_error',
      'Failed to generate authorization code'
    )
  }

  const redirectUrl = new URL(tempState.redirectUri)

  redirectUrl.searchParams.append('code', code)
  redirectUrl.searchParams.append('state', tempState.state)

  return redirect(redirectUrl)
}
