/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { checkAuthRate } from '@/lib/auth.rate'

import { encodeUint8Array } from '@/lib/b64'
import {
  deleteMcpIdpOAuthAuthorizationRequest,
  retrieveMcpIdpOAuthAuthorizationRequest,
} from '@/lib/mcp.oauth.idp'
import {
  REFRESH_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  rotateRefreshToken,
  signOAuthToken,
  storeTokenMetadata,
  validateRefreshToken,
} from '@/lib/oauth.jwt'

import handler from './token'

jest.mock('@/lib/auth.rate', () => {
  const actual = jest.requireActual('@/lib/auth.rate')

  return { ...actual, checkAuthRate: jest.fn() }
})

jest.mock('@/lib/method', () => ({
  withFormUrlencodedPost: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    mcpserverIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/b64', () => ({
  encodeUint8Array: jest.fn(),
}))

jest.mock('@/lib/mcp.oauth.idp', () => ({
  deleteMcpIdpOAuthAuthorizationRequest: jest.fn(),
  retrieveMcpIdpOAuthAuthorizationRequest: jest.fn(),
}))

jest.mock('@/lib/oauth.jwt', () => ({
  REFRESH_TOKEN_TTL_SECONDS: 2592000,
  generateRefreshToken: jest.fn(),
  rotateRefreshToken: jest.fn(),
  signOAuthToken: jest.fn(),
  storeTokenMetadata: jest.fn(),
  validateRefreshToken: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

// @note helper to build a mock request with a text() method for form-encoded bodies
function mockReq(body, query = { mcpserverIntegrationId: 'integration-123' }) {
  const params = new URLSearchParams(body || {})

  return {
    query,
    text: () => Promise.resolve(params.toString()),
  }
}

describe('POST /api/v1/integration/mcpserver/[mcpserverIntegrationId]/oauth/token', () => {
  const originalCrypto = global.crypto

  beforeEach(() => {
    jest.clearAllMocks()

    checkAuthRate.mockResolvedValue(true)

    prisma.mcpserverIntegration.findUnique.mockResolvedValue({
      id: 'integration-123',
      oAuthConnectionId: 'oauth-123',
    })

    retrieveMcpIdpOAuthAuthorizationRequest.mockResolvedValue({
      context: { mcpserverIntegrationId: 'integration-123' },
      clientId: 'cbk-client-123',
      redirectUri: 'https://app.example.com/callback',
      codeChallenge: 'challenge-123',
      scope: 'mcp:tools',
      idpSub: 'user-123',
    })
    deleteMcpIdpOAuthAuthorizationRequest.mockResolvedValue(true)

    signOAuthToken.mockResolvedValue('access-token-123')
    generateRefreshToken.mockResolvedValue('refresh-token-123')
    validateRefreshToken.mockResolvedValue({
      userId: 'user-123',
      portalId: 'integration-123',
      portalUserId: 'user-123',
      contactId: '',
      scope: 'mcp:tools',
    })
    rotateRefreshToken.mockResolvedValue({
      refreshToken: 'refresh-token-rotated',
    })
    encodeUint8Array.mockReturnValue('challenge-123')

    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: {
        subtle: {
          digest: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
        },
      },
    })
  })

  afterAll(() => {
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: originalCrypto,
    })
  })

  it('should exchange an authorization code for access and refresh tokens', async () => {
    const req = mockReq({
      grant_type: 'authorization_code',
      code: 'cbk-code-123',
      redirect_uri: 'https://app.example.com/callback',
      client_id: 'cbk-client-123',
      code_verifier: 'verifier-123',
    })

    const result = await handler(req)

    expect(retrieveMcpIdpOAuthAuthorizationRequest).toHaveBeenCalledWith(
      'cbk-code-123'
    )
    expect(deleteMcpIdpOAuthAuthorizationRequest).toHaveBeenCalledWith(
      'cbk-code-123'
    )
    expect(signOAuthToken).toHaveBeenCalledWith({
      sub: 'user-123',
      portalId: 'integration-123',
      portalUserId: 'user-123',
      contactId: '',
      scope: 'mcp:tools',
    })
    expect(storeTokenMetadata).toHaveBeenCalledWith('access-token-123', {
      portalId: 'integration-123',
      userId: 'user-123',
      scope: 'mcp:tools',
      createdAt: expect.any(Number),
    })
    expect(generateRefreshToken).toHaveBeenCalledWith({
      userId: 'user-123',
      portalId: 'integration-123',
      portalUserId: 'user-123',
      contactId: '',
      scope: 'mcp:tools',
      clientId: 'cbk-client-123',
    })
    expect(result.status).toBe(200)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      access_token: 'access-token-123',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'refresh-token-123',
      refresh_token_expires_in: REFRESH_TOKEN_TTL_SECONDS,
      scope: 'mcp:tools',
    })
  })

  it('should return invalid_request instead of throwing when the form body is missing', async () => {
    const req = mockReq(null)

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'Missing grant_type parameter',
    })
  })

  it('should reject authorization code exchanges when PKCE verification fails', async () => {
    encodeUint8Array.mockReturnValue('different-challenge')

    const req = mockReq({
      grant_type: 'authorization_code',
      code: 'cbk-code-123',
      redirect_uri: 'https://app.example.com/callback',
      client_id: 'cbk-client-123',
      code_verifier: 'verifier-123',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_grant',
      error_description: 'PKCE verification failed',
    })
    expect(signOAuthToken).not.toHaveBeenCalled()
    expect(generateRefreshToken).not.toHaveBeenCalled()
  })

  it('should return a server error when refresh token rotation fails', async () => {
    rotateRefreshToken.mockResolvedValue(null)

    const req = mockReq({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-token-123',
      client_id: 'cbk-client-123',
    })

    const result = await handler(req)

    expect(validateRefreshToken).toHaveBeenCalledWith(
      'refresh-token-123',
      'cbk-client-123'
    )
    expect(result.status).toBe(500)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'server_error',
      error_description: 'Failed to rotate refresh token',
    })
  })

  it('should return 404 when the integration has no OAuth connection configured', async () => {
    prisma.mcpserverIntegration.findUnique.mockResolvedValue({
      id: 'integration-123',
      oAuthConnectionId: null,
    })

    const req = mockReq({
      grant_type: 'authorization_code',
      code: 'cbk-code-123',
      redirect_uri: 'https://app.example.com/callback',
      client_id: 'cbk-client-123',
      code_verifier: 'verifier-123',
    })

    const result = await handler(req)

    expect(result.status).toBe(404)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'OAuth not available for this MCP server integration',
    })
  })

  it('should return unsupported_grant_type for unrecognised grant types', async () => {
    const req = mockReq({ grant_type: 'client_credentials' })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'unsupported_grant_type',
      error_description:
        'Only authorization_code and refresh_token grant types are supported',
    })
  })

  it('should return invalid_request when required authorization code params are missing', async () => {
    const req = mockReq({
      grant_type: 'authorization_code',
      // code, redirect_uri, client_id omitted
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'Missing required parameters',
    })
  })

  it('should return invalid_request when code_verifier is missing', async () => {
    const req = mockReq({
      grant_type: 'authorization_code',
      code: 'cbk-code-123',
      redirect_uri: 'https://app.example.com/callback',
      client_id: 'cbk-client-123',
      // code_verifier omitted
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'code_verifier is required',
    })
  })

  it('should return invalid_grant when the authorization code is not found', async () => {
    retrieveMcpIdpOAuthAuthorizationRequest.mockResolvedValue(null)

    const req = mockReq({
      grant_type: 'authorization_code',
      code: 'expired-code',
      redirect_uri: 'https://app.example.com/callback',
      client_id: 'cbk-client-123',
      code_verifier: 'verifier-123',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_grant',
      error_description: 'Authorization code not found or expired',
    })
  })

  it('should return invalid_grant when the code was issued for a different integration', async () => {
    retrieveMcpIdpOAuthAuthorizationRequest.mockResolvedValue({
      context: { mcpserverIntegrationId: 'other-integration' },
      clientId: 'cbk-client-123',
      redirectUri: 'https://app.example.com/callback',
      codeChallenge: 'challenge-123',
      scope: 'mcp:tools',
      idpSub: 'user-123',
    })

    const req = mockReq({
      grant_type: 'authorization_code',
      code: 'cbk-code-123',
      redirect_uri: 'https://app.example.com/callback',
      client_id: 'cbk-client-123',
      code_verifier: 'verifier-123',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_grant',
      error_description:
        'Authorization code was not issued for this integration',
    })
  })

  it('should return invalid_grant when the redirect_uri does not match', async () => {
    retrieveMcpIdpOAuthAuthorizationRequest.mockResolvedValue({
      context: { mcpserverIntegrationId: 'integration-123' },
      clientId: 'cbk-client-123',
      redirectUri: 'https://app.example.com/callback',
      codeChallenge: 'challenge-123',
      scope: 'mcp:tools',
      idpSub: 'user-123',
    })

    const req = mockReq({
      grant_type: 'authorization_code',
      code: 'cbk-code-123',
      redirect_uri: 'https://malicious.example.com/callback',
      client_id: 'cbk-client-123',
      code_verifier: 'verifier-123',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_grant',
      error_description: 'redirect_uri does not match',
    })
  })

  it('should not consume the authorization code before redirect_uri validation succeeds', async () => {
    const req = mockReq({
      grant_type: 'authorization_code',
      code: 'cbk-code-123',
      redirect_uri: 'https://malicious.example.com/callback',
      client_id: 'cbk-client-123',
      code_verifier: 'verifier-123',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_grant',
      error_description: 'redirect_uri does not match',
    })
    expect(deleteMcpIdpOAuthAuthorizationRequest).not.toHaveBeenCalled()
  })

  it('should return invalid_grant when the client_id does not match', async () => {
    retrieveMcpIdpOAuthAuthorizationRequest.mockResolvedValue({
      context: { mcpserverIntegrationId: 'integration-123' },
      clientId: 'cbk-client-123',
      redirectUri: 'https://app.example.com/callback',
      codeChallenge: 'challenge-123',
      scope: 'mcp:tools',
      idpSub: 'user-123',
    })

    const req = mockReq({
      grant_type: 'authorization_code',
      code: 'cbk-code-123',
      redirect_uri: 'https://app.example.com/callback',
      client_id: 'wrong-client',
      code_verifier: 'verifier-123',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_grant',
      error_description: 'client_id does not match',
    })
  })

  it('should return invalid_request when client_id is missing from refresh_token grant', async () => {
    const req = mockReq({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-token-123',
      // client_id omitted
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'Missing client_id parameter',
    })
    expect(validateRefreshToken).not.toHaveBeenCalled()
  })

  it('should return invalid_request when refresh_token is missing', async () => {
    const req = mockReq({
      grant_type: 'refresh_token',
      client_id: 'cbk-client-123',
      // refresh_token omitted
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'Missing refresh_token parameter',
    })
  })

  it('should return invalid_grant when the refresh token is invalid or expired', async () => {
    validateRefreshToken.mockResolvedValue(null)

    const req = mockReq({
      grant_type: 'refresh_token',
      refresh_token: 'expired-token',
      client_id: 'cbk-client-123',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_grant',
      error_description: 'Refresh token is invalid or expired',
    })
  })

  it('should return invalid_grant when the refresh token belongs to a different integration', async () => {
    validateRefreshToken.mockResolvedValue({
      userId: 'user-123',
      portalId: 'other-integration',
      portalUserId: 'user-123',
      contactId: '',
      scope: 'mcp:tools',
    })

    const req = mockReq({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-token-123',
      client_id: 'cbk-client-123',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_grant',
      error_description: 'Refresh token was not issued for this integration',
    })
  })

  it('should issue new tokens on a successful refresh token rotation', async () => {
    const req = mockReq({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-token-123',
      client_id: 'cbk-client-123',
    })

    const result = await handler(req)

    expect(validateRefreshToken).toHaveBeenCalledWith(
      'refresh-token-123',
      'cbk-client-123'
    )
    expect(signOAuthToken).toHaveBeenCalledWith({
      sub: 'user-123',
      portalId: 'integration-123',
      portalUserId: 'user-123',
      contactId: '',
      scope: 'mcp:tools',
    })
    expect(rotateRefreshToken).toHaveBeenCalledWith('refresh-token-123')
    expect(result.status).toBe(200)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      access_token: 'access-token-123',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'refresh-token-rotated',
      refresh_token_expires_in: REFRESH_TOKEN_TTL_SECONDS,
      scope: 'mcp:tools',
    })
  })

  it('should return invalid_grant when another request consumes the code first', async () => {
    deleteMcpIdpOAuthAuthorizationRequest.mockResolvedValue(false)

    const req = mockReq({
      grant_type: 'authorization_code',
      code: 'cbk-code-123',
      redirect_uri: 'https://app.example.com/callback',
      client_id: 'cbk-client-123',
      code_verifier: 'verifier-123',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_grant',
      error_description: 'Authorization code not found or expired',
    })
    expect(signOAuthToken).not.toHaveBeenCalled()
  })

  it('should include Cache-Control no-store header on authorization code token response', async () => {
    const req = mockReq({
      grant_type: 'authorization_code',
      code: 'cbk-code-123',
      redirect_uri: 'https://app.example.com/callback',
      client_id: 'cbk-client-123',
      code_verifier: 'verifier-123',
    })

    const result = await handler(req)

    expect(result.status).toBe(200)
    expect(result.headers.get('Cache-Control')).toBe('no-store')
    expect(result.headers.get('Pragma')).toBe('no-cache')
  })

  it('should include Cache-Control no-store header on refresh token response', async () => {
    const req = mockReq({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-token-123',
      client_id: 'cbk-client-123',
    })

    const result = await handler(req)

    expect(result.status).toBe(200)
    expect(result.headers.get('Cache-Control')).toBe('no-store')
    expect(result.headers.get('Pragma')).toBe('no-cache')
  })
})
