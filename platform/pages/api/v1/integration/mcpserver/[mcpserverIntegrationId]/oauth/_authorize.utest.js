/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { getExternalAPIHostURL } from '@/lib/host'
import { storeMcpIdpOAuthPendingState } from '@/lib/mcp.oauth.idp'
import { fetchAuthorizationServerMetadata } from '@/lib/oauth.discovery'
import {
  getDynamicClient,
  validateClientId,
  validateRedirectUri,
  validateScopes,
} from '@/lib/oauth.jwt'

import handler from './authorize'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    mcpserverIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/cuid', () => ({
  __esModule: true,
  default: jest.fn(() => 'idp-state-123'),
}))

jest.mock('@/lib/host', () => ({
  getExternalFrontendHost: jest.fn(() => 'chatbotkit.com'),
  getExternalAPIHostURL: jest.fn((path) => `https://chatbotkit.com${path}`),
}))

jest.mock('@/lib/mcp.oauth.idp', () => ({
  storeMcpIdpOAuthPendingState: jest.fn(),
}))

jest.mock('@/lib/oauth.discovery', () => ({
  fetchAuthorizationServerMetadata: jest.fn(),
}))

jest.mock('@/lib/oauth.jwt', () => ({
  getDynamicClient: jest.fn(),
  validateClientId: jest.fn(),
  validateRedirectUri: jest.fn(),
  validateScopes: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => {
    const url = new URL(req.url || '', 'http://localhost')

    return url.searchParams.get(param) || req.query?.[param]
  }),
  queryParam: jest.fn((req, param) => {
    const url = new URL(req.url || '', 'http://localhost')

    return url.searchParams.get(param) || req.query?.[param] || undefined
  }),
}))

// @note helper to build a mock request with a url property built from query params
function mockReq(query = {}) {
  const params = new URLSearchParams(query)

  return {
    url: `http://localhost/oauth/authorize?${params.toString()}`,
    query,
  }
}

describe('GET /api/v1/integration/mcpserver/[mcpserverIntegrationId]/oauth/authorize', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    prisma.mcpserverIntegration.findUnique.mockResolvedValue({
      id: 'integration-123',
      oAuthConnectionId: 'oauth-123',
      oAuthConnection: {
        id: 'oauth-123',
        issuer: 'https://issuer.example.com',
        clientId: 'idp-client-123',
        clientSecret: 'idp-secret-456',
        scopes: 'openid email profile',
      },
    })

    validateRedirectUri.mockReturnValue(true)
    validateClientId.mockReturnValue(true)
    validateScopes.mockReturnValue(['mcp:tools'])
    getDynamicClient.mockResolvedValue({
      clientId: 'cbk-client-123',
      redirectUris: ['https://app.example.com/callback'],
    })
    fetchAuthorizationServerMetadata.mockResolvedValue({
      authorization_endpoint: 'https://issuer.example.com/authorize',
      token_endpoint: 'https://issuer.example.com/token',
    })
  })

  it('should reject redirect_uri values that are not registered for the client', async () => {
    const req = mockReq({
      mcpserverIntegrationId: 'integration-123',
      client_id: 'cbk-client-123',
      redirect_uri: 'https://evil.example.com/callback',
      response_type: 'code',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'redirect_uri is not registered for this client',
    })
    expect(storeMcpIdpOAuthPendingState).not.toHaveBeenCalled()
  })

  it('should return invalid_request when redirect_uri format is invalid', async () => {
    validateRedirectUri.mockReturnValue(false)

    const req = mockReq({
      mcpserverIntegrationId: 'integration-123',
      client_id: 'cbk-client-123',
      redirect_uri: 'not-a-valid-url',
      response_type: 'code',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'Invalid redirect_uri',
    })
    expect(validateClientId).not.toHaveBeenCalled()
    expect(getDynamicClient).not.toHaveBeenCalled()
  })

  it('should respond directly for invalid client_id values before attempting any redirect', async () => {
    validateClientId.mockReturnValue(false)

    const req = mockReq({
      mcpserverIntegrationId: 'integration-123',
      client_id: 'not-a-real-client',
      redirect_uri: 'https://evil.example.com/callback',
      response_type: 'code',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_client',
      error_description: 'Invalid client_id format',
    })
    expect(result.headers.get('location')).toBeNull()
    expect(getDynamicClient).not.toHaveBeenCalled()
  })

  it('should respond directly when the client is not registered for the integration', async () => {
    getDynamicClient.mockResolvedValue(null)

    const req = mockReq({
      mcpserverIntegrationId: 'integration-123',
      client_id: 'cbk-client-123',
      redirect_uri: 'https://evil.example.com/callback',
      response_type: 'code',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_client',
      error_description: 'Client not registered for this integration',
    })
    expect(result.headers.get('location')).toBeNull()
    expect(storeMcpIdpOAuthPendingState).not.toHaveBeenCalled()
  })

  it('should reject integrations whose OAuth connection is not fully configured', async () => {
    prisma.mcpserverIntegration.findUnique.mockResolvedValue({
      id: 'integration-123',
      oAuthConnectionId: 'oauth-123',
      oAuthConnection: {
        id: 'oauth-123',
        issuer: null,
        clientId: null,
        scopes: 'openid email profile',
      },
    })

    const req = mockReq({
      mcpserverIntegrationId: 'integration-123',
      client_id: 'cbk-client-123',
      redirect_uri: 'https://app.example.com/callback',
      response_type: 'code',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'OAuth connection is not fully configured',
    })
    expect(fetchAuthorizationServerMetadata).not.toHaveBeenCalled()
    expect(getExternalAPIHostURL).not.toHaveBeenCalled()
  })

  it('should return invalid_request when required OAuth parameters are missing', async () => {
    const req = mockReq({
      mcpserverIntegrationId: 'integration-123',
      // client_id, redirect_uri, response_type all missing
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'Missing required parameters',
    })
    expect(getDynamicClient).not.toHaveBeenCalled()
  })

  it('should redirect to IdP authorization endpoint on success', async () => {
    const req = mockReq({
      mcpserverIntegrationId: 'integration-123',
      client_id: 'cbk-client-123',
      redirect_uri: 'https://app.example.com/callback',
      response_type: 'code',
      scope: 'mcp:tools',
      state: 'state-abc',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
    })

    const result = await handler(req)

    expect(result.status).toBe(302)

    const redirectUrl = new URL(result.headers.get('location'))

    expect(redirectUrl.origin).toBe('https://issuer.example.com')
    expect(redirectUrl.pathname).toBe('/authorize')
    expect(redirectUrl.searchParams.get('client_id')).toBe('idp-client-123')
    expect(redirectUrl.searchParams.get('response_type')).toBe('code')
    expect(redirectUrl.searchParams.get('scope')).toBe('openid email profile')
    expect(redirectUrl.searchParams.get('state')).toBe('idp-state-123')
    expect(redirectUrl.searchParams.get('redirect_uri')).toBe(
      'https://chatbotkit.com/oauth/connection/callback'
    )

    expect(storeMcpIdpOAuthPendingState).toHaveBeenCalledWith(
      'idp-state-123',
      expect.objectContaining({
        context: { mcpserverIntegrationId: 'integration-123' },
        oAuthConnectionId: 'oauth-123',
        clientId: 'cbk-client-123',
        redirectUri: 'https://app.example.com/callback',
        codeChallenge: 'challenge-123',
        codeChallengeMethod: 'S256',
        scope: 'mcp:tools',
        state: 'state-abc',
      })
    )
  })

  it('should return 404 when integration has no OAuth connection', async () => {
    prisma.mcpserverIntegration.findUnique.mockResolvedValue(null)

    const req = mockReq({
      mcpserverIntegrationId: 'integration-123',
      client_id: 'cbk-client-123',
      redirect_uri: 'https://app.example.com/callback',
      response_type: 'code',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
    })

    const result = await handler(req)

    expect(result.status).toBe(404)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'OAuth not available for this MCP server integration',
    })
  })

  it('should redirect with unsupported_response_type for non-code values', async () => {
    const req = mockReq({
      mcpserverIntegrationId: 'integration-123',
      client_id: 'cbk-client-123',
      redirect_uri: 'https://app.example.com/callback',
      response_type: 'token',
      state: 'state-abc',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
    })

    const result = await handler(req)

    expect(result.status).toBe(302)
    expect(result.headers.get('location')).toContain(
      'error=unsupported_response_type'
    )
    expect(result.headers.get('location')).toContain('state=state-abc')
  })

  it('should redirect with invalid_request when PKCE challenge is missing', async () => {
    const req = mockReq({
      mcpserverIntegrationId: 'integration-123',
      client_id: 'cbk-client-123',
      redirect_uri: 'https://app.example.com/callback',
      response_type: 'code',
    })

    const result = await handler(req)

    expect(result.status).toBe(302)
    expect(result.headers.get('location')).toContain('error=invalid_request')
    expect(result.headers.get('location')).toContain('PKCE')
  })

  it('should redirect with invalid_scope when scope validation fails', async () => {
    validateScopes.mockReturnValue(null)

    const req = mockReq({
      mcpserverIntegrationId: 'integration-123',
      client_id: 'cbk-client-123',
      redirect_uri: 'https://app.example.com/callback',
      response_type: 'code',
      scope: 'invalid:scope',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
    })

    const result = await handler(req)

    expect(result.status).toBe(302)
    expect(result.headers.get('location')).toContain('error=invalid_scope')
  })

  it('should return 502 when IdP metadata discovery fails', async () => {
    fetchAuthorizationServerMetadata.mockResolvedValue(null)

    const req = mockReq({
      mcpserverIntegrationId: 'integration-123',
      client_id: 'cbk-client-123',
      redirect_uri: 'https://app.example.com/callback',
      response_type: 'code',
      scope: 'mcp:tools',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
    })

    const result = await handler(req)

    expect(result.status).toBe(502)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'server_error',
      error_description: 'Unable to discover IdP OAuth endpoints from issuer',
    })
  })

  it('should reject integrations whose OAuth connection has issuer and clientId but no clientSecret', async () => {
    prisma.mcpserverIntegration.findUnique.mockResolvedValue({
      id: 'integration-123',
      oAuthConnectionId: 'oauth-123',
      oAuthConnection: {
        id: 'oauth-123',
        issuer: 'https://issuer.example.com',
        clientId: 'idp-client-123',
        clientSecret: null,
        scopes: 'openid email profile',
      },
    })

    const req = mockReq({
      mcpserverIntegrationId: 'integration-123',
      client_id: 'cbk-client-123',
      redirect_uri: 'https://app.example.com/callback',
      response_type: 'code',
      code_challenge: 'challenge-123',
      code_challenge_method: 'S256',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'OAuth connection is not fully configured',
    })
    expect(fetchAuthorizationServerMetadata).not.toHaveBeenCalled()
    expect(storeMcpIdpOAuthPendingState).not.toHaveBeenCalled()
  })
})
