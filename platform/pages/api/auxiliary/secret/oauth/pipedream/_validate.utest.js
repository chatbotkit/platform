import prisma from '@/prisma/client'

import fetch from '@/lib/fetch'
import { tryVerify } from '@/lib/jwt'
import { getSecretOAuthConfig } from '@/lib/secret.oauth'

import handler from './validate'

/**
 * @jest-environment node
 */
/**
 * Unit tests for Pipedream OAuth validate (token introspection) endpoint.
 *
 * Covers RFC 7662 introspection semantics: Bearer parsing, JWT validation,
 * secret/credential lookup, Pipedream account health checks, and edge cases.
 */

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
  withFormUrlencodedPost: (fn) => fn,
}))
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

const createRequest = (method = 'GET', headers = {}) => {
  return new Request(
    'https://example.com/api/auxiliary/secret/oauth/pipedream/validate',
    { method, headers }
  )
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Pipedream OAuth validate - authorization header parsing', () => {
  it('should return inactive when Authorization header is missing', async () => {
    const response = await handler(createRequest())

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })

  it('should return inactive when Authorization header is not Bearer', async () => {
    const response = await handler(
      createRequest('GET', { Authorization: 'Basic abc123' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })

  it('should return inactive when Bearer token is empty', async () => {
    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer ' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })

  it('should return inactive when Authorization has too many parts', async () => {
    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer token extra' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })
})

describe('Pipedream OAuth validate - JWT validation', () => {
  it('should return inactive when token verification fails', async () => {
    mockTryVerify.mockRejectedValue(new Error('Invalid token'))

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer invalid_jwt' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })

  it('should return inactive when tryVerify returns null', async () => {
    mockTryVerify.mockResolvedValue(null)

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer some_token' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })

  it('should return inactive for invalid token type', async () => {
    mockTryVerify.mockResolvedValue({
      type: 'unknown_type',
      secretId: 'secret_123',
    })

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer some_token' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })
})

describe('Pipedream OAuth validate - secret and credential lookup', () => {
  const validPayload = {
    type: 'pipedream_access_token',
    secretId: 'secret_123',
    userId: 'user_123',
    projectId: 'proj_123',
    environment: 'development',
    externalUserId: 'contact:abc',
    accountId: 'account_123',
    clientId: 'client_123',
  }

  beforeEach(() => {
    mockTryVerify.mockResolvedValue(validPayload)
  })

  it('should return inactive when secret is not found', async () => {
    prisma.secret.findUnique.mockResolvedValue(null)

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer valid_token' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })

  it('should return inactive when OAuth config has no clientId', async () => {
    prisma.secret.findUnique.mockResolvedValue({
      id: 'secret_123',
      userId: 'user_123',
    })
    getSecretOAuthConfig.mockResolvedValue({
      clientId: null,
      clientSecret: 'secret',
    })

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer valid_token' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })

  it('should return inactive when OAuth config has no clientSecret', async () => {
    prisma.secret.findUnique.mockResolvedValue({
      id: 'secret_123',
      userId: 'user_123',
    })
    getSecretOAuthConfig.mockResolvedValue({
      clientId: 'client',
      clientSecret: null,
    })

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer valid_token' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })
})

describe('Pipedream OAuth validate - account health check', () => {
  const validPayload = {
    type: 'pipedream_access_token',
    secretId: 'secret_123',
    userId: 'user_123',
    projectId: 'proj_123',
    environment: 'development',
    externalUserId: 'contact:abc',
    accountId: 'account_123',
    clientId: 'client_123',
  }

  beforeEach(() => {
    mockTryVerify.mockResolvedValue(validPayload)
    prisma.secret.findUnique.mockResolvedValue({
      id: 'secret_123',
      userId: 'user_123',
    })
    getSecretOAuthConfig.mockResolvedValue({
      clientId: 'pd_client_id',
      clientSecret: 'pd_client_secret',
    })
  })

  it('should return active true for healthy account', async () => {
    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'oauth_token' }),
    })

    // Account details
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ healthy: true, dead: false }),
    })

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer valid_token' })
    )

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body).toEqual({ active: true })
  })

  it('should return inactive for unhealthy account', async () => {
    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'oauth_token' }),
    })

    // Account details - unhealthy
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ healthy: false, dead: false }),
    })

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer valid_token' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })

  it('should return inactive for dead account', async () => {
    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'oauth_token' }),
    })

    // Account details - dead
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ healthy: true, dead: true }),
    })

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer valid_token' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })

  it('should return inactive when account is 404', async () => {
    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'oauth_token' }),
    })

    // Account not found
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    })

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer valid_token' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })

  it('should return inactive when Pipedream OAuth token request fails', async () => {
    // OAuth token fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer valid_token' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })

  it('should return inactive when account retrieval fails with non-404 error', async () => {
    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'oauth_token' }),
    })

    // Account retrieval fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer valid_token' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })

  it('should also accept refresh tokens for introspection', async () => {
    mockTryVerify.mockResolvedValue({
      ...validPayload,
      type: 'pipedream_refresh_token',
    })

    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'oauth_token' }),
    })

    // Account details
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ healthy: true, dead: false }),
    })

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer refresh_token_jwt' })
    )

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body).toEqual({ active: true })
  })

  it('should return inactive when Pipedream OAuth returns no access_token', async () => {
    // OAuth token - returns empty
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const response = await handler(
      createRequest('GET', { Authorization: 'Bearer valid_token' })
    )

    expect(response.status).toBe(401)

    const body = await response.json()

    expect(body).toEqual({ active: false })
  })

  it('should call Pipedream API with correct project and account IDs', async () => {
    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'oauth_token' }),
    })

    // Account details
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ healthy: true, dead: false }),
    })

    await handler(createRequest('GET', { Authorization: 'Bearer valid_token' }))

    // Verify account retrieval URL includes project and account IDs
    const accountCall = mockFetch.mock.calls[1]

    expect(accountCall[0].href).toContain('proj_123')
    expect(accountCall[0].href).toContain('account_123')
    expect(accountCall[1].headers.Authorization).toBe('Bearer oauth_token')
    expect(accountCall[1].headers['x-pd-environment']).toBe('development')
  })
})
