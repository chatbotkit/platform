import prisma from '@/prisma/client'

import fetch from '@/lib/fetch'
import { sign, tryVerify } from '@/lib/jwt'
import { getSecretOAuthConfig } from '@/lib/secret.oauth'

import handler from './token'

/**
 * @jest-environment node
 */
/**
 * Unit tests for Pipedream OAuth token endpoint.
 *
 * Covers authorization_code and refresh_token grant types, parameter
 * validation, JWT verification, credential lookup, and Pipedream API
 * interactions.
 */

jest.mock('@/lib/method', () => ({ withFormUrlencodedPost: (fn) => fn }))
jest.mock('@/lib/fetch', () => jest.fn())
jest.mock('@/lib/jwt', () => ({
  sign: jest.fn(),
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
const mockSign = sign
const mockTryVerify = tryVerify

const createRequest = (body = {}) => {
  return new Request(
    'https://example.com/api/auxiliary/secret/oauth/pipedream/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Pipedream OAuth token - grant type validation', () => {
  it('should reject unsupported grant types', async () => {
    const response = await handler(
      createRequest({ grant_type: 'client_credentials' })
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('unsupported_grant_type')
  })
})

describe('Pipedream OAuth token - authorization_code grant', () => {
  const codePayload = {
    secretId: 'secret_123',
    userId: 'user_123',
    projectId: 'proj_123',
    environment: 'development',
    externalUserId: 'contact:abc',
    accountId: 'account_456',
    clientId: 'client_123',
  }

  it('should reject missing code parameter', async () => {
    const response = await handler(
      createRequest({
        grant_type: 'authorization_code',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_request')
    expect(body.error_description).toContain('code')
  })

  it('should reject missing client_id parameter', async () => {
    const response = await handler(
      createRequest({
        grant_type: 'authorization_code',
        code: 'valid_code',
      })
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_request')
    expect(body.error_description).toContain('client_id')
  })

  it('should reject invalid code (verification fails)', async () => {
    mockTryVerify.mockRejectedValue(new Error('Invalid code'))

    const response = await handler(
      createRequest({
        grant_type: 'authorization_code',
        code: 'invalid_code',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_grant')
  })

  it('should reject code when tryVerify returns null', async () => {
    mockTryVerify.mockResolvedValue(null)

    const response = await handler(
      createRequest({
        grant_type: 'authorization_code',
        code: 'expired_code',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_grant')
  })

  it('should reject client_id mismatch', async () => {
    mockTryVerify.mockResolvedValue(codePayload)

    const response = await handler(
      createRequest({
        grant_type: 'authorization_code',
        code: 'valid_code',
        client_id: 'wrong_client',
      })
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_grant')
    expect(body.error_description).toContain('Client ID mismatch')
  })

  it('should return tokens on successful authorization_code grant', async () => {
    mockTryVerify.mockResolvedValue(codePayload)
    mockSign.mockResolvedValueOnce('access_token_jwt')
    mockSign.mockResolvedValueOnce('refresh_token_jwt')

    const response = await handler(
      createRequest({
        grant_type: 'authorization_code',
        code: 'valid_code',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.token_type).toBe('Bearer')
    expect(body.access_token).toBe('access_token_jwt')
    expect(body.refresh_token).toBe('refresh_token_jwt')
    expect(body.expires_in).toBeDefined()
    expect(body.refresh_token_expires_in).toBeDefined()
  })

  it('should return server_error when refresh token signing fails', async () => {
    mockTryVerify.mockResolvedValue(codePayload)
    mockSign.mockResolvedValueOnce('access_token_jwt')
    mockSign.mockResolvedValueOnce(null)

    const response = await handler(
      createRequest({
        grant_type: 'authorization_code',
        code: 'valid_code',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(500)

    const body = await response.json()

    expect(body.error).toBe('server_error')
  })

  it('should sign access token with correct payload', async () => {
    mockTryVerify.mockResolvedValue(codePayload)
    mockSign.mockResolvedValueOnce('access_token_jwt')
    mockSign.mockResolvedValueOnce('refresh_token_jwt')

    await handler(
      createRequest({
        grant_type: 'authorization_code',
        code: 'valid_code',
        client_id: 'client_123',
      })
    )

    const accessPayload = mockSign.mock.calls[0][0]

    expect(accessPayload.type).toBe('pipedream_access_token')
    expect(accessPayload.secretId).toBe('secret_123')
    expect(accessPayload.accountId).toBe('account_456')
    expect(accessPayload.clientId).toBe('client_123')

    const refreshPayload = mockSign.mock.calls[1][0]

    expect(refreshPayload.type).toBe('pipedream_refresh_token')
    expect(refreshPayload.secretId).toBe('secret_123')
  })
})

describe('Pipedream OAuth token - refresh_token grant', () => {
  const refreshPayload = {
    type: 'pipedream_refresh_token',
    secretId: 'secret_123',
    userId: 'user_123',
    projectId: 'proj_123',
    environment: 'development',
    externalUserId: 'contact:abc',
    accountId: 'account_456',
    clientId: 'client_123',
  }

  it('should reject missing refresh_token parameter', async () => {
    const response = await handler(
      createRequest({
        grant_type: 'refresh_token',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_request')
    expect(body.error_description).toContain('refresh_token')
  })

  it('should reject missing client_id parameter', async () => {
    const response = await handler(
      createRequest({
        grant_type: 'refresh_token',
        refresh_token: 'some_token',
      })
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_request')
    expect(body.error_description).toContain('client_id')
  })

  it('should reject invalid refresh token', async () => {
    mockTryVerify.mockRejectedValue(new Error('Invalid'))

    const response = await handler(
      createRequest({
        grant_type: 'refresh_token',
        refresh_token: 'bad_token',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_grant')
  })

  it('should reject token with wrong type', async () => {
    mockTryVerify.mockResolvedValue({
      ...refreshPayload,
      type: 'pipedream_access_token',
    })

    const response = await handler(
      createRequest({
        grant_type: 'refresh_token',
        refresh_token: 'access_token_jwt',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_grant')
  })

  it('should reject client_id mismatch', async () => {
    mockTryVerify.mockResolvedValue(refreshPayload)

    const response = await handler(
      createRequest({
        grant_type: 'refresh_token',
        refresh_token: 'valid_refresh',
        client_id: 'wrong_client',
      })
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_grant')
    expect(body.error_description).toContain('Client ID mismatch')
  })

  it('should reject when secret is not found', async () => {
    mockTryVerify.mockResolvedValue(refreshPayload)
    prisma.secret.findUnique.mockResolvedValue(null)

    const response = await handler(
      createRequest({
        grant_type: 'refresh_token',
        refresh_token: 'valid_refresh',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_grant')
    expect(body.error_description).toContain('Secret not found')
  })

  it('should reject when OAuth credentials are missing', async () => {
    mockTryVerify.mockResolvedValue(refreshPayload)
    prisma.secret.findUnique.mockResolvedValue({ id: 'secret_123' })
    getSecretOAuthConfig.mockResolvedValue({
      clientId: null,
      clientSecret: null,
    })

    const response = await handler(
      createRequest({
        grant_type: 'refresh_token',
        refresh_token: 'valid_refresh',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.error).toBe('invalid_grant')
    expect(body.error_description).toContain('OAuth credentials')
  })

  it('should return server_error when Pipedream OAuth token request fails', async () => {
    mockTryVerify.mockResolvedValue(refreshPayload)
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

    const response = await handler(
      createRequest({
        grant_type: 'refresh_token',
        refresh_token: 'valid_refresh',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(500)

    const body = await response.json()

    expect(body.error).toBe('server_error')
  })

  it('should return new tokens on successful refresh', async () => {
    mockTryVerify.mockResolvedValue(refreshPayload)
    prisma.secret.findUnique.mockResolvedValue({ id: 'secret_123' })
    getSecretOAuthConfig.mockResolvedValue({
      clientId: 'pd_client',
      clientSecret: 'pd_secret',
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'pd_oauth_token' }),
    })

    mockSign.mockResolvedValueOnce('new_access_token')
    mockSign.mockResolvedValueOnce('new_refresh_token')

    const response = await handler(
      createRequest({
        grant_type: 'refresh_token',
        refresh_token: 'valid_refresh',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.token_type).toBe('Bearer')
    expect(body.access_token).toBe('new_access_token')
    expect(body.refresh_token).toBe('new_refresh_token')
    expect(body.expires_in).toBeDefined()
    expect(body.refresh_token_expires_in).toBeDefined()
  })

  it('should return server_error when new refresh token signing fails', async () => {
    mockTryVerify.mockResolvedValue(refreshPayload)
    prisma.secret.findUnique.mockResolvedValue({ id: 'secret_123' })
    getSecretOAuthConfig.mockResolvedValue({
      clientId: 'pd_client',
      clientSecret: 'pd_secret',
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'pd_oauth_token' }),
    })

    mockSign.mockResolvedValueOnce('new_access_token')
    mockSign.mockResolvedValueOnce(null)

    const response = await handler(
      createRequest({
        grant_type: 'refresh_token',
        refresh_token: 'valid_refresh',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(500)

    const body = await response.json()

    expect(body.error).toBe('server_error')
  })

  it('should return server_error when Pipedream returns no access_token', async () => {
    mockTryVerify.mockResolvedValue(refreshPayload)
    prisma.secret.findUnique.mockResolvedValue({ id: 'secret_123' })
    getSecretOAuthConfig.mockResolvedValue({
      clientId: 'pd_client',
      clientSecret: 'pd_secret',
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const response = await handler(
      createRequest({
        grant_type: 'refresh_token',
        refresh_token: 'valid_refresh',
        client_id: 'client_123',
      })
    )

    expect(response.status).toBe(500)

    const body = await response.json()

    expect(body.error).toBe('server_error')
  })
})
