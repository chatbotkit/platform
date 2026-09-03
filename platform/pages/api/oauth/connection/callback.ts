import prisma from '@/prisma/client'

import { getContextRequestHost } from '@/lib/context.store'
import debug from '@/lib/debug'
import fetch from '@/lib/egress.fetch'
import { withGet } from '@/lib/method'
import {
  deleteIdpOAuthPendingState,
  generateIdpOAuthCode,
  retrieveIdpOAuthPendingState,
  storeIdpOAuthAuthorizationRequest,
} from '@/lib/oauth.connection.idp'
import { fetchAuthorizationServerMetadata } from '@/lib/oauth.discovery'
import { queryParam } from '@/lib/query.get'
import { badRequest, redirect } from '@/lib/response'

import * as jose from 'jose'

/**
 * Stable IdP callback endpoint for all OAuthConnection-backed flows.
 *
 * This is the single redirect URI registered with every external IdP
 * application, regardless of which OAuthConnection is involved. The
 * `oAuthConnectionId` is recovered from the pending state stored in Redis
 * (keyed by the `state` parameter), so the URL itself never needs to
 * change when connections are added, removed, or reconfigured.
 *
 * After the end-user authenticates with the configured IdP (Okta, Google,
 * etc.), the IdP redirects back here with a `code` and the `state` value CBK
 * set during the authorize step.
 *
 * CBK then:
 * 1. Retrieves the pending state from Redis using `state`.
 * 2. Exchanges the IdP code for IdP tokens using the OAuthConnection credentials.
 * 3. Decodes the IdP id_token to extract the user's `sub` and `email` claims.
 * 4. Validates `allowedDomains` and `requiredClaims` if configured.
 * 5. Issues a short-lived CBK authorization code and stores it in Redis.
 * 6. Redirects back to the caller's `redirect_uri` with the CBK code.
 */
export default withGet(async function (req) {
  const idpCode = queryParam(req, 'code')
  const idpState = queryParam(req, 'state')
  const idpError = queryParam(req, 'error')

  debug('callback received', {
    hasCode: !!idpCode,
    hasState: !!idpState,
    idpError: idpError || null,
    requestHost: getContextRequestHost(),
  }).log('api.oauth.connection.callback')

  // Handle IdP-reported errors before doing any DB lookups

  if (idpError) {
    debug('callback idp reported error', { idpError }).log(
      'api.oauth.connection.callback'
    )

    // @note we don't have the caller redirect_uri without looking up the
    // pending state, but the state may have been tampered with - respond with
    // a safe error page instead of blindly redirecting

    return badRequest({
      error: 'access_denied',
      error_description: `IdP returned error: ${idpError}`,
    })
  }

  if (!idpCode || !idpState) {
    return badRequest({
      error: 'invalid_request',
      error_description: 'Missing code or state parameter',
    })
  }

  // Retrieve the pending state.

  const pendingState = await retrieveIdpOAuthPendingState(idpState)

  if (!pendingState) {
    debug('callback pending state not found', { idpState }).log(
      'api.oauth.connection.callback'
    )

    return badRequest({
      error: 'invalid_request',
      error_description: 'Authorization request not found or expired',
    })
  }

  // The oAuthConnectionId is recovered entirely from the trusted Redis state -
  // it does not need to appear in the URL.

  const oAuthConnectionId = pendingState.oAuthConnectionId

  debug('callback resolved connection', { oAuthConnectionId }).log(
    'api.oauth.connection.callback'
  )

  // Load the OAuthConnection for credentials

  const oAuthConnection = await prisma.oAuthConnection.findUnique({
    where: { id: oAuthConnectionId },
    select: {
      id: true,
      issuer: true,
      clientId: true,
      clientSecret: true,
      allowedDomains: true,
      requiredClaims: true,
    },
  })

  if (!oAuthConnection) {
    const errorUrl = new URL(pendingState.redirectUri)

    errorUrl.searchParams.set('error', 'server_error')
    errorUrl.searchParams.set('error_description', 'OAuth connection not found')

    if (pendingState.state) {
      errorUrl.searchParams.set('state', pendingState.state)
    }

    return redirect(errorUrl)
  }

  if (
    !oAuthConnection.issuer?.trim() ||
    !oAuthConnection.clientId?.trim() ||
    !oAuthConnection.clientSecret?.trim()
  ) {
    const errorUrl = new URL(pendingState.redirectUri)

    errorUrl.searchParams.set('error', 'server_error')
    errorUrl.searchParams.set(
      'error_description',
      'OAuth connection is not fully configured'
    )

    if (pendingState.state) {
      errorUrl.searchParams.set('state', pendingState.state)
    }

    return redirect(errorUrl)
  }

  // Exchange the IdP code for IdP tokens
  //
  // @note CBK is a confidential client (has clientSecret), so standard
  // authorization_code grant without PKCE is used toward the IdP

  // @note use the callbackUrl stored during authorize - this must exactly
  // match what was sent to the IdP or the token exchange will fail with
  // redirect_uri_mismatch (the request context is not available here, so
  // recomputing the URL would produce the wrong host in tunneled dev environments)
  const callbackUrl = pendingState.idpCallbackUrl

  debug('callback token exchange', {
    idpTokenEndpoint: pendingState.idpTokenEndpoint,
    callbackUrl,
    redirectUri: pendingState.redirectUri,
  }).log('api.oauth.connection.callback')

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code: idpCode,
    redirect_uri: callbackUrl,
    client_id: oAuthConnection.clientId,
    client_secret: oAuthConnection.clientSecret,
  })

  let idpTokenResponse: {
    id_token?: string
    access_token?: string
    error?: string
    error_description?: string
  }

  try {
    const response = await fetch(pendingState.idpTokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: tokenBody.toString(),
    })

    idpTokenResponse = (await response.json()) as typeof idpTokenResponse

    if (!response.ok || idpTokenResponse.error) {
      debug('callback token exchange failed', {
        status: response.status,
        error: idpTokenResponse.error,
        error_description: idpTokenResponse.error_description,
      }).log('api.oauth.connection.callback')

      const errorUrl = new URL(pendingState.redirectUri)

      errorUrl.searchParams.set('error', 'access_denied')
      errorUrl.searchParams.set(
        'error_description',
        idpTokenResponse.error_description || 'IdP token exchange failed'
      )

      if (pendingState.state) {
        errorUrl.searchParams.set('state', pendingState.state)
      }

      return redirect(errorUrl)
    }
  } catch {
    const errorUrl = new URL(pendingState.redirectUri)

    errorUrl.searchParams.set('error', 'server_error')
    errorUrl.searchParams.set(
      'error_description',
      'Failed to contact IdP token endpoint'
    )

    if (pendingState.state) {
      errorUrl.searchParams.set('state', pendingState.state)
    }

    return redirect(errorUrl)
  }

  const idToken = idpTokenResponse.id_token

  if (!idToken) {
    const errorUrl = new URL(pendingState.redirectUri)

    errorUrl.searchParams.set('error', 'server_error')
    errorUrl.searchParams.set(
      'error_description',
      'IdP did not return id_token'
    )

    if (pendingState.state) {
      errorUrl.searchParams.set('state', pendingState.state)
    }

    return redirect(errorUrl)
  }

  const idpMetadata = await fetchAuthorizationServerMetadata(
    oAuthConnection.issuer
  )

  if (!idpMetadata?.jwks_uri) {
    const errorUrl = new URL(pendingState.redirectUri)

    errorUrl.searchParams.set('error', 'server_error')
    errorUrl.searchParams.set(
      'error_description',
      'IdP signing keys are not available'
    )

    if (pendingState.state) {
      errorUrl.searchParams.set('state', pendingState.state)
    }

    return redirect(errorUrl)
  }

  let idpClaims: Record<string, unknown>

  try {
    // @note the JWKS document is fetched through the egress boundary rather
    // than `jose.createRemoteJWKSet`, which opens its own connection to the
    // issuer-supplied `jwks_uri` and cannot be routed through our dispatcher
    const jwksResponse = await fetch(new URL(idpMetadata.jwks_uri), {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!jwksResponse.ok) {
      throw new Error(`JWKS request failed with status ${jwksResponse.status}`)
    }

    const jwks = jose.createLocalJWKSet(
      (await jwksResponse.json()) as jose.JSONWebKeySet
    )

    const { payload } = await jose.jwtVerify(idToken, jwks, {
      issuer: oAuthConnection.issuer,
      audience: oAuthConnection.clientId,
    })

    idpClaims = payload as Record<string, unknown>
  } catch {
    const errorUrl = new URL(pendingState.redirectUri)

    errorUrl.searchParams.set('error', 'server_error')
    errorUrl.searchParams.set(
      'error_description',
      'Failed to verify IdP id_token'
    )

    if (pendingState.state) {
      errorUrl.searchParams.set('state', pendingState.state)
    }

    return redirect(errorUrl)
  }

  const idpSub = (idpClaims.sub as string) || ''
  const idpEmail = (idpClaims.email as string) || undefined

  if (!idpSub) {
    const errorUrl = new URL(pendingState.redirectUri)

    errorUrl.searchParams.set('error', 'server_error')
    errorUrl.searchParams.set(
      'error_description',
      'IdP id_token missing sub claim'
    )

    if (pendingState.state) {
      errorUrl.searchParams.set('state', pendingState.state)
    }

    return redirect(errorUrl)
  }

  // Validate allowedDomains (newline-delimited list in DB)

  if (oAuthConnection.allowedDomains) {
    const allowedDomains = oAuthConnection.allowedDomains
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean)

    if (allowedDomains.length > 0) {
      const emailDomain = idpEmail?.split('@')[1]?.toLowerCase()

      const domainAllowed =
        emailDomain &&
        allowedDomains.some((d) => d.toLowerCase() === emailDomain)

      if (!domainAllowed) {
        const errorUrl = new URL(pendingState.redirectUri)

        errorUrl.searchParams.set('error', 'access_denied')
        errorUrl.searchParams.set(
          'error_description',
          'Email domain not allowed'
        )

        if (pendingState.state) {
          errorUrl.searchParams.set('state', pendingState.state)
        }

        return redirect(errorUrl)
      }
    }
  }

  // Validate requiredClaims (key-value pairs that must be present in id_token)

  if (oAuthConnection.requiredClaims) {
    const requiredClaims = oAuthConnection.requiredClaims as Record<
      string,
      unknown
    >

    for (const [claimName, expectedValue] of Object.entries(requiredClaims)) {
      const actualValue = idpClaims[claimName]

      if (
        actualValue === undefined ||
        String(actualValue) !== String(expectedValue)
      ) {
        const errorUrl = new URL(pendingState.redirectUri)

        errorUrl.searchParams.set('error', 'access_denied')
        errorUrl.searchParams.set(
          'error_description',
          `Required claim '${claimName}' not satisfied`
        )

        if (pendingState.state) {
          errorUrl.searchParams.set('state', pendingState.state)
        }

        return redirect(errorUrl)
      }
    }
  }

  // Issue a CBK authorization code and store it in Redis

  const cbkCode = generateIdpOAuthCode()

  debug('callback issuing cbk code', {
    cbkCode: cbkCode.substring(0, 16) + '...',
    idpSub,
    idpEmail,
    redirectUri: pendingState.redirectUri,
  }).log('api.oauth.connection.callback')

  await storeIdpOAuthAuthorizationRequest({
    code: cbkCode,
    clientId: pendingState.clientId,
    redirectUri: pendingState.redirectUri,
    codeChallenge: pendingState.codeChallenge,
    codeChallengeMethod: 'S256',
    scope: pendingState.scope,
    state: pendingState.state,
    idpSub,
    idpEmail,
    context: pendingState.context,
    createdAt: Date.now(),
  })

  await deleteIdpOAuthPendingState(idpState)

  // Redirect back to the caller with the CBK code

  const redirectUrl = new URL(pendingState.redirectUri)

  redirectUrl.searchParams.set('code', cbkCode)

  if (pendingState.state) {
    redirectUrl.searchParams.set('state', pendingState.state)
  }

  return redirect(redirectUrl)
})
