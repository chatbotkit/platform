import prisma from '@/prisma/client'

import cuid from '@/lib/cuid'
import debug from '@/lib/debug'
import { getExternalAPIHostURL, getExternalFrontendHost } from '@/lib/host'
import { storeMcpIdpOAuthPendingState } from '@/lib/mcp.oauth.idp'
import { withGet } from '@/lib/method'
import { fetchAuthorizationServerMetadata } from '@/lib/oauth.discovery'
import {
  getDynamicClient,
  validateClientId,
  validateRedirectUri,
  validateScopes,
} from '@/lib/oauth.jwt'
import { queryParam, requiredUrlParam } from '@/lib/query.get'
import { badGateway, badRequest, notFound, redirect } from '@/lib/response'

/**
 * OAuth 2.0 Authorization endpoint for MCP server integrations.
 * Implements RFC 6749 Section 3.1.
 *
 * When Claude calls this endpoint it supplies its own OAuth parameters
 * (client_id, redirect_uri, PKCE challenge). CBK looks up the OAuthConnection
 * configured for the integration, discovers the IdP's authorization endpoint,
 * stores the pending state in Redis, and redirects the user's browser to the
 * IdP for authentication.
 *
 * The IdP is configured to call back to the stable generic callback URL:
 * `/oauth/connection/callback`
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-3.1
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
 */
export default withGet(async function (req) {
  const mcpserverIntegrationId = requiredUrlParam(req, 'mcpserverIntegrationId')

  debug('authorize request received', { mcpserverIntegrationId }).log(
    'api.v1.integration.mcpserver.oauth.authorize'
  )

  const mcpserverIntegration = await prisma.mcpserverIntegration.findUnique({
    where: { id: mcpserverIntegrationId },
    select: {
      id: true,
      oAuthConnectionId: true,
      oAuthConnection: {
        select: {
          id: true,
          issuer: true,
          clientId: true,
          clientSecret: true,
          scopes: true,
        },
      },
    },
  })

  if (!mcpserverIntegration?.oAuthConnection) {
    return notFound({
      error: 'invalid_request',
      error_description: 'OAuth not available for this MCP server integration',
    })
  }

  const oAuthConnection = mcpserverIntegration.oAuthConnection

  if (
    !oAuthConnection.issuer?.trim() ||
    !oAuthConnection.clientId?.trim() ||
    !oAuthConnection.clientSecret?.trim()
  ) {
    return badRequest({
      error: 'invalid_request',
      error_description: 'OAuth connection is not fully configured',
    })
  }

  // Extract OAuth parameters

  const clientId = queryParam(req, 'client_id')
  const redirectUri = queryParam(req, 'redirect_uri')
  const responseType = queryParam(req, 'response_type')
  const scope = queryParam(req, 'scope')
  const state = queryParam(req, 'state')
  const codeChallenge = queryParam(req, 'code_challenge')
  const codeChallengeMethod = queryParam(req, 'code_challenge_method')

  debug('authorize oauth params', {
    clientId,
    redirectUri,
    responseType,
    scope,
    state,
    hasPkce: !!codeChallenge,
    codeChallengeMethod,
  }).log('api.v1.integration.mcpserver.oauth.authorize')

  // Validate required parameters

  if (!clientId || !redirectUri || !responseType) {
    return badRequest({
      error: 'invalid_request',
      error_description: 'Missing required parameters',
    })
  }

  // Validate redirect_uri

  if (!validateRedirectUri(redirectUri)) {
    return badRequest({
      error: 'invalid_request',
      error_description: 'Invalid redirect_uri',
    })
  }

  // Validate client_id

  if (!validateClientId(clientId)) {
    return badRequest({
      error: 'invalid_client',
      error_description: 'Invalid client_id format',
    })
  }

  // Validate client is registered for this integration before sending any
  // redirect-based OAuth errors. Until redirect_uri is proven to belong to a
  // registered client, responding directly avoids turning this endpoint into an
  // open redirect.

  const registeredClient = await getDynamicClient(
    mcpserverIntegrationId,
    clientId
  )

  if (!registeredClient) {
    return badRequest({
      error: 'invalid_client',
      error_description: 'Client not registered for this integration',
    })
  }

  if (!registeredClient.redirectUris.includes(redirectUri)) {
    return badRequest({
      error: 'invalid_request',
      error_description: 'redirect_uri is not registered for this client',
    })
  }

  // Validate response_type

  if (responseType !== 'code') {
    const errorUrl = new URL(redirectUri)

    errorUrl.searchParams.set('error', 'unsupported_response_type')
    errorUrl.searchParams.set(
      'error_description',
      'Only authorization_code flow is supported'
    )

    if (state) {
      errorUrl.searchParams.set('state', state)
    }

    return redirect(errorUrl)
  }

  // Validate PKCE

  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    const errorUrl = new URL(redirectUri)

    errorUrl.searchParams.set('error', 'invalid_request')
    errorUrl.searchParams.set('error_description', 'PKCE with S256 is required')

    if (state) {
      errorUrl.searchParams.set('state', state)
    }

    return redirect(errorUrl)
  }

  // Validate scopes

  const validatedScopes = validateScopes(scope)

  if (validatedScopes === null) {
    const errorUrl = new URL(redirectUri)

    errorUrl.searchParams.set('error', 'invalid_scope')
    errorUrl.searchParams.set('error_description', 'Invalid scope requested')

    if (state) {
      errorUrl.searchParams.set('state', state)
    }

    return redirect(errorUrl)
  }

  // Discover the IdP's authorization and token endpoints

  const idpMetadata = await fetchAuthorizationServerMetadata(
    oAuthConnection.issuer
  )

  if (!idpMetadata?.authorization_endpoint || !idpMetadata?.token_endpoint) {
    return badGateway({
      error: 'server_error',
      error_description: 'Unable to discover IdP OAuth endpoints from issuer',
    })
  }

  // Generate a random state value to correlate IdP callback with our pending
  // state (different from Claude's state, which we preserve separately)

  const idpState = cuid()

  // The callback URL is the same for all connections - the oAuthConnectionId
  // is recovered from the Redis pending state via the `state` parameter

  const callbackUrl = getExternalAPIHostURL(
    `/oauth/connection/callback`,
    getExternalFrontendHost()
  )

  debug('authorize idp redirect', {
    idpState,
    callbackUrl,
    idpAuthorizationEndpoint: idpMetadata.authorization_endpoint,
    externalFrontendHost: getExternalFrontendHost(),
  }).log('api.v1.integration.mcpserver.oauth.authorize')

  // Store pending state - retrieved in the callback

  await storeMcpIdpOAuthPendingState(idpState, {
    oAuthConnectionId: oAuthConnection.id,
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod: 'S256',
    scope: validatedScopes.join(' '),
    state: state || undefined,
    idpTokenEndpoint: idpMetadata.token_endpoint,
    idpCallbackUrl: callbackUrl,
    context: { mcpserverIntegrationId },
    createdAt: Date.now(),
  })

  // Build IdP authorization URL
  //
  // @note CBK acts as a confidential client toward the IdP (has client_secret),
  // so no PKCE is required toward the IdP. The PKCE above is between Claude
  // and CBK.

  const idpAuthUrl = new URL(idpMetadata.authorization_endpoint)

  idpAuthUrl.searchParams.set('client_id', oAuthConnection.clientId)
  idpAuthUrl.searchParams.set('redirect_uri', callbackUrl)
  idpAuthUrl.searchParams.set('response_type', 'code')
  idpAuthUrl.searchParams.set('scope', oAuthConnection.scopes)
  idpAuthUrl.searchParams.set('state', idpState)

  debug('authorize redirecting to idp', {
    idpAuthUrl: idpAuthUrl.toString(),
  }).log('api.v1.integration.mcpserver.oauth.authorize')

  return redirect(idpAuthUrl)
})

/**
 * @manual MCP Server Integration
 * @index 55
 *
 * ## OAuth Authentication for MCP Server Integrations
 *
 * MCP Server Integrations support OAuth 2.0 authentication, enabling AI clients
 * such as Claude to authenticate end users through your existing identity provider
 * (IdP) before accessing the MCP server. This allows your bot and skillsets to
 * operate on behalf of individual users using their own credentials rather than
 * a shared static access token.
 *
 * When OAuth is configured, the MCP server exposes a complete OAuth 2.0
 * Authorization Server interface per the MCP specification. Clients discover
 * the OAuth endpoints automatically via the well-known metadata URLs, register
 * themselves using dynamic client registration (RFC 7591), and then initiate the
 * authorization code flow with PKCE (RFC 7636). ChatBotKit acts as an
 * intermediary: it validates the client, proxies the authorization request to
 * your configured IdP, and issues its own short-lived JWT access token once the
 * IdP confirms the user's identity.
 *
 * ### Configuring OAuth
 *
 * To enable OAuth for an MCP server integration you must attach an OAuth
 * connection that points to your identity provider. The connection requires:
 *
 * - **issuer** - The IdP's issuer URL. ChatBotKit uses OIDC discovery
 *   (`.well-known/openid-configuration`) to locate the authorization and token
 *   endpoints automatically.
 * - **clientId** and **clientSecret** - The OAuth application credentials
 *   registered with your IdP.
 * - **scopes** - The scopes to request from the IdP on behalf of the user (for
 *   example `openid profile email`).
 *
 * Create or update an MCP server integration with an OAuth connection ID:
 *
 * ```http
 * POST /api/v1/integration/mcpserver/{mcpserverIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "oAuthConnectionId": "clx9k0j2m0000abcdefghijk"
 * }
 * ```
 *
 * ### OAuth Flow Overview
 *
 * Once an OAuth connection is attached to an MCP server integration, the
 * following sequence takes place when an AI client connects:
 *
 * 1. **Discovery** - The client fetches the well-known Authorization Server
 *    Metadata from:
 *    `/.well-known/oauth-authorization-server/api/v1/integration/mcpserver/{id}/mcp`
 *    This response advertises all OAuth endpoints scoped to the integration.
 *
 * 2. **Dynamic Registration** - The client registers itself by posting its
 *    redirect URIs and metadata to the registration endpoint:
 *    `POST /api/v1/integration/mcpserver/{id}/oauth/register`
 *    Registration is per-integration and requires no user authentication.
 *
 * 3. **Authorization Request** - The client redirects the user to:
 *    `GET /api/v1/integration/mcpserver/{id}/oauth/authorize`
 *    ChatBotKit validates the client and PKCE parameters, then redirects the
 *    user's browser to your configured IdP for authentication.
 *
 * 4. **IdP Callback** - Your IdP authenticates the user and redirects back to
 *    the standard ChatBotKit OAuth callback URL. ChatBotKit exchanges the IdP
 *    authorization code for IdP tokens, then issues a short-lived ChatBotKit
 *    JWT access token and a refresh token to the original client.
 *
 * 5. **Token Exchange** - The client exchanges the authorization code for
 *    access and refresh tokens:
 *    `POST /api/v1/integration/mcpserver/{id}/oauth/token`
 *    PKCE verification is performed here.
 *
 * 6. **Authenticated MCP Access** - The client includes the ChatBotKit JWT
 *    in the `Authorization: Bearer` header for all subsequent MCP requests.
 *    The MCP endpoint verifies the token and associates the session with the
 *    authenticated user.
 *
 * 7. **Token Revocation** - When the session ends, the client can revoke the
 *    refresh token:
 *    `POST /api/v1/integration/mcpserver/{id}/oauth/revoke`
 *
 * ### Security Considerations
 *
 * - PKCE with the S256 challenge method is mandatory for all authorization
 *   requests. Plain PKCE is not supported.
 * - Only clients registered via dynamic registration are accepted. Unregistered
 *   `client_id` values are rejected before any redirect-based response is issued,
 *   preventing this endpoint from acting as an open redirect.
 * - The static access token configured on the integration is still required in
 *   addition to the OAuth flow. The OAuth token identifies the user; the static
 *   token authorizes access to the integration endpoint itself.
 * - ChatBotKit acts as a confidential client toward the IdP, so no PKCE is
 *   used on the IdP leg of the flow. Your IdP client credentials are stored
 *   server-side and never exposed to end users or MCP clients.
 *
 * ### Token Lifetimes
 *
 * Access tokens issued by ChatBotKit are short-lived (one hour). Clients should
 * use the refresh token to obtain new access tokens without requiring the user
 * to re-authenticate. Refresh token rotation is applied on every use - each
 * successful refresh invalidates the previous refresh token and issues a new one.
 */
