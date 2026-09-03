/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './protected-resource'

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
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  notFound: (data) => ({ status: 404, body: data }),
  ok: (data) => ({ status: 200, body: data }),
}))

describe('GET /api/v1/integration/mcpserver/[mcpserverIntegrationId]/oauth/well-known/protected-resource', () => {
  const req = { query: { mcpserverIntegrationId: 'integration-123' } }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.mcpserverIntegration.findUnique.mockResolvedValue({
      id: 'integration-123',
      oAuthConnectionId: 'oauth-123',
    })
  })

  it('should return RFC 9728 protected resource metadata', async () => {
    const result = await handler(req)

    expect(result.status).toBe(200)

    const mcpUrl =
      'https://api.chatbotkit.com/v1/integration/mcpserver/integration-123/mcp'

    expect(result.body.resource).toBe(mcpUrl)
    expect(result.body.authorization_servers).toEqual([mcpUrl])
    expect(result.body.bearer_methods_supported).toEqual(['header'])
    expect(result.body.scopes_supported).toEqual(
      expect.arrayContaining(['mcp:tools', 'mcp:resources'])
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
