/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './authorization-server'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    mcpserverIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/host', () => ({
  getExternalAPIHostURL: jest.fn((path) => `https://api.chatbotkit.com${path}`),
  getExternalFrontendHost: jest.fn(() => 'api.chatbotkit.com'),
  getExternalFrontendHostURL: jest.fn((path) => `https://app.example${path}`),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  notFound: (data) => ({ status: 404, body: data }),
  ok: (data) => ({ status: 200, body: data }),
}))

describe('GET /api/v1/integration/mcpserver/[mcpserverIntegrationId]/oauth/well-known/authorization-server', () => {
  const req = { query: { mcpserverIntegrationId: 'integration-123' } }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.mcpserverIntegration.findUnique.mockResolvedValue({
      id: 'integration-123',
      oAuthConnectionId: 'oauth-123',
    })
  })

  it('should advertise refresh token and revocation support in discovery metadata', async () => {
    const result = await handler(req)

    expect(result.status).toBe(200)

    expect(result.body.grant_types_supported).toEqual([
      'authorization_code',
      'refresh_token',
    ])
    expect(result.body.revocation_endpoint).toBe(
      'https://api.chatbotkit.com/v1/integration/mcpserver/integration-123/oauth/revoke'
    )
  })

  it('should return all RFC 8414 required fields', async () => {
    const result = await handler(req)

    expect(result.status).toBe(200)

    const base =
      'https://api.chatbotkit.com/v1/integration/mcpserver/integration-123'

    expect(result.body.issuer).toBe(`${base}/mcp`)
    expect(result.body.authorization_endpoint).toBe(`${base}/oauth/authorize`)
    expect(result.body.token_endpoint).toBe(`${base}/oauth/token`)
    expect(result.body.registration_endpoint).toBe(`${base}/oauth/register`)
    expect(result.body.response_types_supported).toEqual(['code'])
    expect(result.body.token_endpoint_auth_methods_supported).toEqual(['none'])
    expect(result.body.code_challenge_methods_supported).toEqual(['S256'])
    expect(result.body.scopes_supported).toEqual(
      expect.arrayContaining(['mcp:tools', 'mcp:resources'])
    )
    // @note the documentation link follows the deployment, not the hosted
    // product
    expect(result.body.service_documentation).toBe(
      'https://docs.cbk.ai/mcp-server-integration'
    )
  })

  it('should return 404 when integration has no OAuth connection', async () => {
    prisma.mcpserverIntegration.findUnique.mockResolvedValue({
      id: 'integration-123',
      oAuthConnectionId: null,
    })

    const result = await handler(req)

    expect(result.status).toBe(404)

    expect(result.body).toEqual({
      error: 'invalid_request',
      error_description: 'OAuth not available for this MCP server integration',
    })
  })

  it('should return 404 when integration does not exist', async () => {
    prisma.mcpserverIntegration.findUnique.mockResolvedValue(null)

    const result = await handler(req)

    expect(result.status).toBe(404)
  })
})
