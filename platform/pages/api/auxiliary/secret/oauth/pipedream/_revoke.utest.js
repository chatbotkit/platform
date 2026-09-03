import prisma from '@/prisma/client'

import fetch from '@/lib/fetch'
import { tryVerify } from '@/lib/jwt'
import { getSecretOAuthConfig } from '@/lib/secret.oauth'

import handler from './revoke'

/**
 * @jest-environment node
 */
/**
 * Unit tests for Pipedream OAuth revoke (token revocation) endpoint.
 *
 * Covers RFC 7009 semantics: parameter validation, JWT verification,
 * secret/credential lookup, Pipedream account deletion, and the
 * requirement to return 200 OK even for invalid tokens.
 */

jest.mock('@/lib/method', () => ({ withFormUrlencodedPost: (fn) => fn }))
jest.mock('@/lib/fetch', () => jest.fn())
jest.mock('@/lib/jwt', () => ({
  tryVerify: jest.fn(),
}))
jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    secret: {
      findUnique: jest.fn(),
    },
  },
}))
jest.mock('@/lib/secret.oauth', () => ({
  getSecretOAuthConfig: jest.fn(),
}))

const mockFetch = fetch
const mockTryVerify = tryVerify

const createRequest = (body = {}, method = 'POST') => {
  return new Request(
    'https://example.com/api/auxiliary/secret/oauth/pipedream/revoke',
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
    }
  )
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Pipedream OAuth revoke - parameter validation', () => {
  it('should reject missing token parameter', async () => {
    const response = await handler(createRequest({}))

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_request')
    expect(body.error_description).toContain('token')
  })

  it('should reject non-string token parameter', async () => {
    const response = await handler(createRequest({ token: 12345 }))

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_request')
  })
})

describe('Pipedream OAuth revoke - RFC 7009 compliance', () => {
  it('should return 200 OK for invalid tokens (per RFC 7009)', async () => {
    mockTryVerify.mockRejectedValue(new Error('Invalid token'))

    const response = await handler(createRequest({ token: 'invalid_jwt' }))

    expect(response.status).toBe(200)
  })

  it('should return 200 OK for tokens with wrong type (per RFC 7009)', async () => {
    mockTryVerify.mockResolvedValue({
      type: 'unknown_type',
      secretId: 'secret_123',
    })

    const response = await handler(createRequest({ token: 'wrong_type_token' }))

    expect(response.status).toBe(200)
  })

  it('should return 200 OK when secret is not found (per RFC 7009)', async () => {
    mockTryVerify.mockResolvedValue({
      type: 'pipedream_access_token',
      secretId: 'secret_123',
      projectId: 'proj_123',
      accountId: 'account_456',
      environment: 'development',
    })
    prisma.secret.findUnique.mockResolvedValue(null)

    const response = await handler(createRequest({ token: 'valid_jwt' }))

    expect(response.status).toBe(200)
  })

  it('should return 200 OK when OAuth credentials are missing (per RFC 7009)', async () => {
    mockTryVerify.mockResolvedValue({
      type: 'pipedream_access_token',
      secretId: 'secret_123',
      projectId: 'proj_123',
      accountId: 'account_456',
      environment: 'development',
    })
    prisma.secret.findUnique.mockResolvedValue({ id: 'secret_123' })
    getSecretOAuthConfig.mockResolvedValue({
      clientId: null,
      clientSecret: null,
    })

    const response = await handler(createRequest({ token: 'valid_jwt' }))

    expect(response.status).toBe(200)
  })

  it('should return 200 OK when Pipedream OAuth token request fails (per RFC 7009)', async () => {
    mockTryVerify.mockResolvedValue({
      type: 'pipedream_access_token',
      secretId: 'secret_123',
      projectId: 'proj_123',
      accountId: 'account_456',
      environment: 'development',
    })
    prisma.secret.findUnique.mockResolvedValue({ id: 'secret_123' })
    getSecretOAuthConfig.mockResolvedValue({
      clientId: 'pd_client',
      clientSecret: 'pd_secret',
    })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    const response = await handler(createRequest({ token: 'valid_jwt' }))

    expect(response.status).toBe(200)
  })

  it('should return 200 OK when tryVerify returns null', async () => {
    mockTryVerify.mockResolvedValue(null)

    const response = await handler(createRequest({ token: 'expired_token' }))

    expect(response.status).toBe(200)
  })
})

describe('Pipedream OAuth revoke - account deletion', () => {
  const tokenPayload = {
    type: 'pipedream_access_token',
    secretId: 'secret_123',
    userId: 'user_123',
    projectId: 'proj_123',
    environment: 'development',
    externalUserId: 'contact:abc',
    accountId: 'account_456',
    clientId: 'client_123',
  }

  beforeEach(() => {
    mockTryVerify.mockResolvedValue(tokenPayload)
    prisma.secret.findUnique.mockResolvedValue({ id: 'secret_123' })
    getSecretOAuthConfig.mockResolvedValue({
      clientId: 'pd_client',
      clientSecret: 'pd_secret',
    })
  })

  it('should delete the Pipedream account on successful revocation', async () => {
    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'pd_oauth_token' }),
    })

    // Delete account
    mockFetch.mockResolvedValueOnce({ ok: true })

    const response = await handler(createRequest({ token: 'valid_jwt' }))

    expect(response.status).toBe(200)

    // Verify DELETE was called with correct URL
    const deleteCall = mockFetch.mock.calls[1]

    expect(deleteCall[0].href).toContain('proj_123')
    expect(deleteCall[0].href).toContain('account_456')
    expect(deleteCall[1].method).toBe('DELETE')
    expect(deleteCall[1].headers.Authorization).toBe('Bearer pd_oauth_token')
    expect(deleteCall[1].headers['x-pd-environment']).toBe('development')
  })

  it('should return 200 OK when account deletion returns 404 (already deleted)', async () => {
    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'pd_oauth_token' }),
    })

    // Delete account - 404
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    })

    const response = await handler(createRequest({ token: 'valid_jwt' }))

    expect(response.status).toBe(200)
  })

  it('should return 200 OK when account deletion fails with 500 (per RFC 7009)', async () => {
    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'pd_oauth_token' }),
    })

    // Delete account - fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    const response = await handler(createRequest({ token: 'valid_jwt' }))

    expect(response.status).toBe(200)
  })

  it('should also revoke refresh tokens', async () => {
    mockTryVerify.mockResolvedValue({
      ...tokenPayload,
      type: 'pipedream_refresh_token',
    })

    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'pd_oauth_token' }),
    })

    // Delete account
    mockFetch.mockResolvedValueOnce({ ok: true })

    const response = await handler(createRequest({ token: 'refresh_jwt' }))

    expect(response.status).toBe(200)

    // Verify deletion was still attempted
    expect(mockFetch).toHaveBeenCalledTimes(2)

    const deleteCall = mockFetch.mock.calls[1]

    expect(deleteCall[1].method).toBe('DELETE')
  })

  it('should return 200 OK when Pipedream returns no access_token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const response = await handler(createRequest({ token: 'valid_jwt' }))

    expect(response.status).toBe(200)
  })
})
