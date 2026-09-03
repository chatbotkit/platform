/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { checkAuthRate } from '@/lib/auth.rate'

import { registerDynamicClient } from '@/lib/oauth.jwt'

import handler from './register'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    mcpserverIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth.rate', () => {
  const actual = jest.requireActual('@/lib/auth.rate')

  return { ...actual, checkAuthRate: jest.fn() }
})

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/host', () => ({
  getExternalAPIHostURL: jest.fn((path) => `https://api.chatbotkit.com${path}`),
  getExternalFrontendHost: jest.fn(() => 'api.chatbotkit.com'),
}))

jest.mock('@/lib/oauth.jwt', () => ({
  registerDynamicClient: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

// @note helper to build a mock request with a json() method
function mockReq(body) {
  return {
    query: { mcpserverIntegrationId: 'integration-123' },
    json: () => Promise.resolve(body),
  }
}

describe('POST /api/v1/integration/mcpserver/[mcpserverIntegrationId]/oauth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    checkAuthRate.mockResolvedValue(true)

    prisma.mcpserverIntegration.findUnique.mockResolvedValue({
      id: 'integration-123',
      oAuthConnectionId: 'oauth-123',
    })

    registerDynamicClient.mockResolvedValue({
      client_id: 'cbk-client-123',
      redirect_uris: ['https://app.example.com/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    })
  })

  it('should reject null request bodies with invalid_request', async () => {
    const req = {
      query: { mcpserverIntegrationId: 'integration-123' },
      json: () => Promise.resolve(null),
    }

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'Invalid JSON body',
    })
    expect(registerDynamicClient).not.toHaveBeenCalled()
  })

  it('should reject array request bodies with invalid_request', async () => {
    const req = {
      query: { mcpserverIntegrationId: 'integration-123' },
      json: () => Promise.resolve([{ redirect_uris: ['https://example.com'] }]),
    }

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'Invalid JSON body',
    })
    expect(registerDynamicClient).not.toHaveBeenCalled()
  })

  it('should register a client and return RFC 7591 response with endpoints', async () => {
    const req = mockReq({
      redirect_uris: ['https://app.example.com/callback'],
      client_name: 'Test App',
    })

    const result = await handler(req)

    expect(result.status).toBe(201)

    const body = JSON.parse(await result.text())

    expect(body.client_id).toBe('cbk-client-123')
    expect(body.token_endpoint_auth_method).toBe('none')
    expect(body.grant_types).toEqual(['authorization_code'])
    expect(body.response_types).toEqual(['code'])
    expect(body.authorization_endpoint).toBe(
      'https://api.chatbotkit.com/v1/integration/mcpserver/integration-123/oauth/authorize'
    )
    expect(body.token_endpoint).toBe(
      'https://api.chatbotkit.com/v1/integration/mcpserver/integration-123/oauth/token'
    )
    expect(registerDynamicClient).toHaveBeenCalledWith(
      'integration-123',
      expect.objectContaining({
        redirect_uris: ['https://app.example.com/callback'],
        client_name: 'Test App',
      })
    )
  })

  it('should return 404 when integration has no OAuth connection', async () => {
    prisma.mcpserverIntegration.findUnique.mockResolvedValue({
      id: 'integration-123',
      oAuthConnectionId: null,
    })

    const req = mockReq({
      redirect_uris: ['https://app.example.com/callback'],
    })

    const result = await handler(req)

    expect(result.status).toBe(404)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'OAuth not available for this MCP server integration',
    })
    expect(registerDynamicClient).not.toHaveBeenCalled()
  })

  it('should reject unsupported grant_types', async () => {
    const req = mockReq({
      redirect_uris: ['https://app.example.com/callback'],
      grant_types: ['implicit'],
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_client_metadata',
      error_description:
        'Unsupported grant_types: implicit. Only authorization_code and refresh_token are supported',
    })
    expect(registerDynamicClient).not.toHaveBeenCalled()
  })

  it('should reject unsupported response_types', async () => {
    const req = mockReq({
      redirect_uris: ['https://app.example.com/callback'],
      response_types: ['token'],
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_client_metadata',
      error_description:
        'Unsupported response_types: token. Only code is supported',
    })
  })

  it('should reject unsupported token_endpoint_auth_method', async () => {
    const req = mockReq({
      redirect_uris: ['https://app.example.com/callback'],
      token_endpoint_auth_method: 'client_secret_basic',
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_client_metadata',
      error_description:
        'Only token_endpoint_auth_method: none is supported (public clients with PKCE)',
    })
  })

  it('should return invalid_redirect_uri when registerDynamicClient throws', async () => {
    registerDynamicClient.mockRejectedValue(
      new Error('Invalid redirect_uri: http://insecure.example.com')
    )

    const req = mockReq({
      redirect_uris: ['http://insecure.example.com'],
    })

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_redirect_uri',
      error_description: 'Invalid redirect_uri: http://insecure.example.com',
    })
  })

  it('should handle malformed JSON body', async () => {
    const req = {
      query: { mcpserverIntegrationId: 'integration-123' },
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    }

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'Invalid JSON body',
    })
  })
  it('answers 429 slow_down when registration is over its per-address limit', async () => {
    checkAuthRate.mockResolvedValue(false)

    const result = await handler(
      mockReq({ redirect_uris: ['https://app.example.com/callback'] })
    )

    expect(result.status).toBe(429)
    expect(registerDynamicClient).not.toHaveBeenCalled()
  })

})
