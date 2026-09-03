/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import {
  isRefreshToken,
  revokeRefreshToken,
  revokeToken,
} from '@/lib/oauth.jwt'

import handler from './revoke'

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

jest.mock('@/lib/oauth.jwt', () => ({
  isRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
  revokeToken: jest.fn(),
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

describe('POST /api/v1/integration/mcpserver/[mcpserverIntegrationId]/oauth/revoke', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    prisma.mcpserverIntegration.findUnique.mockResolvedValue({
      id: 'integration-123',
      oAuthConnectionId: 'oauth-123',
    })

    isRefreshToken.mockReturnValue(false)
  })

  it('should return invalid_request instead of throwing when the form body is missing', async () => {
    const req = mockReq(null)

    const result = await handler(req)

    expect(result.status).toBe(400)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'token parameter is required',
    })
  })

  it('should revoke refresh tokens when the token_type_hint says refresh_token', async () => {
    const req = mockReq({
      token: 'refresh-token-123',
      token_type_hint: 'refresh_token',
    })

    const result = await handler(req)

    expect(revokeRefreshToken).toHaveBeenCalledWith('refresh-token-123')
    expect(revokeToken).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it('should use token inspection when no token_type_hint is provided', async () => {
    isRefreshToken.mockReturnValue(true)

    const req = mockReq({ token: 'refresh-token-123' })

    const result = await handler(req)

    expect(isRefreshToken).toHaveBeenCalledWith('refresh-token-123')
    expect(revokeRefreshToken).toHaveBeenCalledWith('refresh-token-123')
    expect(revokeToken).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it('should return 404 when the integration has no OAuth connection configured', async () => {
    prisma.mcpserverIntegration.findUnique.mockResolvedValue({
      id: 'integration-123',
      oAuthConnectionId: null,
    })

    const req = mockReq({ token: 'some-token' })

    const result = await handler(req)

    expect(result.status).toBe(404)

    const body = JSON.parse(await result.text())

    expect(body).toEqual({
      error: 'invalid_request',
      error_description: 'OAuth not available for this MCP server integration',
    })
  })

  it('should use revokeToken when the token is not a refresh token', async () => {
    isRefreshToken.mockReturnValue(false)

    const req = mockReq({ token: 'access-token-123' })

    const result = await handler(req)

    expect(revokeToken).toHaveBeenCalledWith('access-token-123')
    expect(revokeRefreshToken).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
  })
})
