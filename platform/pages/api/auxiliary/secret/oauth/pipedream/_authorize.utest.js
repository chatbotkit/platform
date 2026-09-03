import prisma from '@/prisma/client'

import fetch from '@/lib/fetch'
import { tryVerify } from '@/lib/jwt'
import memcache from '@/lib/memcache'
import { getSecretOAuthConfig } from '@/lib/secret.oauth'

import handler from './authorize'

/**
 * @jest-environment node
 */
/**
 * Unit tests for Pipedream OAuth authorize endpoint
 *
 * These tests focus on the account deletion logic that filters by app
 * to prevent accidentally deleting accounts for other integrations.
 */

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
  withFormUrlencodedPost: (fn) => fn,
}))
jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid-v4') }))
jest.mock('@/lib/fetch', () => jest.fn())
jest.mock('@/lib/jwt', () => ({
  trySign: jest.fn(),
  tryVerify: jest.fn(),
}))
jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
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
jest.mock('@/lib/host', () => ({
  getExternalFrontendHostURL: jest.fn((path) => `https://example.com${path}`),
}))

const mockFetch = fetch
const mockTryVerify = tryVerify

/**
 * Build a Request object from query params and method.
 */
const createRequest = (query = {}, method = 'GET') => {
  const url = new URL(
    'https://example.com/api/auxiliary/secret/oauth/pipedream/authorize'
  )

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value))
    }
  }

  return new Request(url, { method })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Pipedream OAuth authorize - account deletion filtering', () => {
  describe('handleInitialAuthorization', () => {
    const baseQuery = {
      environment: 'development',
      projectId: 'proj_test123',
      app: 'google_mail',
      client_id: 'pipedream_client_id',
      redirect_uri: 'https://callback.example.com/oauth',
      state: 'test_state_token',
      response_type: 'code',
    }

    const mockSecret = {
      id: 'secret_123',
      userId: 'user_123',
    }

    const mockContactState = {
      secretId: 'secret_123',
      contact: { id: 'contact_abc' },
      redirectUri: 'https://callback.example.com/oauth',
    }

    beforeEach(() => {
      mockTryVerify.mockResolvedValue(mockContactState)

      prisma.secret.findUnique.mockResolvedValue(mockSecret)

      getSecretOAuthConfig.mockResolvedValue({
        clientId: 'pipedream_client_id',
        clientSecret: 'pipedream_client_secret',
        authorizationUrl:
          'https://example.com/api/auxiliary/secret/oauth/pipedream/authorize?projectId=proj_test123&environment=development&app=google_mail',
      })
    })

    it('should only delete accounts matching the requested app', async () => {
      const req = createRequest(baseQuery)

      // OAuth token request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test_access_token' }),
      })

      // List accounts - returns accounts for multiple apps
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'account_1', app: 'google_mail' },
            { id: 'account_2', app: 'zendesk' }, // different app - should NOT be deleted
            { id: 'account_3', app: 'google_mail' },
          ],
        }),
      })

      // Delete account_1 (matches google_mail)
      mockFetch.mockResolvedValueOnce({ ok: true })

      // Delete account_3 (matches google_mail)
      mockFetch.mockResolvedValueOnce({ ok: true })

      // Create connect token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          connect_link_url: 'https://pipedream.com/connect/link',
          expires_at: '2026-01-13T00:00:00Z',
        }),
      })

      await handler(req)

      // Verify list accounts request includes app filter
      const listAccountsCall = mockFetch.mock.calls[1]

      expect(listAccountsCall[0]).toContain('app=google_mail')

      // Verify only google_mail accounts were deleted (2 deletes, not 3)
      const deleteCalls = mockFetch.mock.calls.filter(
        (call) => call[1]?.method === 'DELETE'
      )

      expect(deleteCalls).toHaveLength(2)

      // Verify the correct account IDs were deleted
      expect(deleteCalls[0][0].href).toContain('account_1')
      expect(deleteCalls[1][0].href).toContain('account_3')

      // Verify zendesk account was NOT deleted
      const allCallUrls = mockFetch.mock.calls.map(
        (call) => call[0]?.href || call[0]
      )

      expect(allCallUrls.join(',')).not.toContain('account_2')
    })

    it('should not delete any accounts when app filter returns empty list', async () => {
      const req = createRequest(baseQuery)

      // OAuth token request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test_access_token' }),
      })

      // List accounts - returns empty (no existing accounts for this app)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })

      // Create connect token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          connect_link_url: 'https://pipedream.com/connect/link',
          expires_at: '2026-01-13T00:00:00Z',
        }),
      })

      await handler(req)

      // Verify no DELETE calls were made
      const deleteCalls = mockFetch.mock.calls.filter(
        (call) => call[1]?.method === 'DELETE'
      )

      expect(deleteCalls).toHaveLength(0)
    })

    it('should handle accounts with mismatched app property gracefully', async () => {
      const req = createRequest(baseQuery)

      // OAuth token request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test_access_token' }),
      })

      // List accounts - API returned accounts despite app filter
      // (defensive coding: API might not filter correctly)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'account_1', app: 'google_mail' },
            { id: 'account_2', app: 'slack' }, // wrong app - should NOT be deleted
          ],
        }),
      })

      // Delete account_1 (only matching account)
      mockFetch.mockResolvedValueOnce({ ok: true })

      // Create connect token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          connect_link_url: 'https://pipedream.com/connect/link',
          expires_at: '2026-01-13T00:00:00Z',
        }),
      })

      await handler(req)

      // Verify only 1 delete call was made (for matching app)
      const deleteCalls = mockFetch.mock.calls.filter(
        (call) => call[1]?.method === 'DELETE'
      )

      expect(deleteCalls).toHaveLength(1)
      expect(deleteCalls[0][0].href).toContain('account_1')
    })

    it('should continue processing when account deletion fails', async () => {
      const req = createRequest(baseQuery)

      // OAuth token request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test_access_token' }),
      })

      // List accounts
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'account_1', app: 'google_mail' },
            { id: 'account_2', app: 'google_mail' },
          ],
        }),
      })

      // First delete fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })

      // Second delete succeeds
      mockFetch.mockResolvedValueOnce({ ok: true })

      // Create connect token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          connect_link_url: 'https://pipedream.com/connect/link',
          expires_at: '2026-01-13T00:00:00Z',
        }),
      })

      const response = await handler(req)

      // Should redirect successfully despite first delete failure
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toContain(
        'pipedream.com/connect'
      )

      // Verify both delete attempts were made
      const deleteCalls = mockFetch.mock.calls.filter(
        (call) => call[1]?.method === 'DELETE'
      )

      expect(deleteCalls).toHaveLength(2)
    })
  })
})

describe('Pipedream OAuth authorize - parameter validation', () => {
  beforeEach(() => {
    // @note the state must verify and bind the redirect_uri before any
    // redirect error is possible

    mockTryVerify.mockResolvedValue({
      secretId: 'secret_123',
      contact: { id: 'contact_abc' },
      redirectUri: 'https://example.com/callback',
    })
  })

  it('should reject missing environment parameter', async () => {
    const req = createRequest({
      projectId: 'proj_test',
      app: 'google_mail',
      client_id: 'client_123',
      redirect_uri: 'https://example.com/callback',
      state: 'test_state',
      response_type: 'code',
    })

    const response = await handler(req)

    expect(response.status).toBe(302)

    const location = response.headers.get('Location')

    expect(location).toContain('error=invalid_request')
    expect(location).toContain('environment')
  })

  it('should reject missing app parameter', async () => {
    const req = createRequest({
      environment: 'development',
      projectId: 'proj_test',
      client_id: 'client_123',
      redirect_uri: 'https://example.com/callback',
      state: 'test_state',
      response_type: 'code',
    })

    const response = await handler(req)

    expect(response.status).toBe(302)

    const location = response.headers.get('Location')

    expect(location).toContain('error=invalid_request')
    expect(location).toContain('app')
  })

  it('should reject invalid response_type', async () => {
    const req = createRequest({
      environment: 'development',
      projectId: 'proj_test',
      app: 'google_mail',
      client_id: 'client_123',
      redirect_uri: 'https://example.com/callback',
      state: 'test_state',
      response_type: 'token', // invalid - should be 'code'
    })

    const response = await handler(req)

    expect(response.status).toBe(302)

    const location = response.headers.get('Location')

    expect(location).toContain('error=unsupported_response_type')
  })
})

describe('Pipedream OAuth authorize - external user ID generation', () => {
  const configForApp = (app) => ({
    clientId: 'client_123',
    clientSecret: 'pipedream_client_secret',
    authorizationUrl: `https://example.com/api/auxiliary/secret/oauth/pipedream/authorize?projectId=proj_test123&environment=development&app=${app}`,
  })

  beforeEach(() => {
    prisma.secret.findUnique.mockResolvedValue({
      id: 'secret_123',
      userId: 'user_123',
    })
  })

  it('should generate contact-based external user ID', async () => {
    const contactState = {
      secretId: 'secret_123',
      contact: { id: 'contact_xyz' },
      redirectUri: 'https://example.com/callback',
    }

    mockTryVerify.mockResolvedValue(contactState)
    getSecretOAuthConfig.mockResolvedValue(configForApp('google_mail'))

    const req = createRequest({
      environment: 'development',
      projectId: 'proj_test123',
      app: 'google_mail',
      client_id: 'client_123',
      redirect_uri: 'https://example.com/callback',
      state: 'test_state',
      response_type: 'code',
    })

    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'test_token' }),
    })

    // List accounts
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    })

    // Create connect token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        connect_link_url: 'https://pipedream.com/connect/link',
        expires_at: '2026-01-13T00:00:00Z',
      }),
    })

    await handler(req)

    // Verify external_user_id uses contact format
    const listAccountsCall = mockFetch.mock.calls[1][0]

    expect(listAccountsCall).toContain('external_user_id=contact%3Acontact_xyz')
  })

  it('should generate ephemeral namespace-based external user ID', async () => {
    const ephemeralState = {
      secretId: 'secret_123',
      ephemeral: { namespace: 'ns_abc123' },
      redirectUri: 'https://example.com/callback',
    }

    mockTryVerify.mockResolvedValue(ephemeralState)
    getSecretOAuthConfig.mockResolvedValue(configForApp('zendesk'))

    const req = createRequest({
      environment: 'development',
      projectId: 'proj_test123',
      app: 'zendesk',
      client_id: 'client_123',
      redirect_uri: 'https://example.com/callback',
      state: 'test_state',
      response_type: 'code',
    })

    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'test_token' }),
    })

    // List accounts
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    })

    // Create connect token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        connect_link_url: 'https://pipedream.com/connect/link',
        expires_at: '2026-01-13T00:00:00Z',
      }),
    })

    await handler(req)

    // Verify external_user_id uses namespace format
    const listAccountsCall = mockFetch.mock.calls[1][0]

    expect(listAccountsCall).toContain('external_user_id=namespace%3Ans_abc123')
  })

  it('should generate direct-based external user ID', async () => {
    const directState = {
      secretId: 'secret_123',
      direct: { id: 'direct_456' },
      redirectUri: 'https://example.com/callback',
    }

    mockTryVerify.mockResolvedValue(directState)
    getSecretOAuthConfig.mockResolvedValue(configForApp('slack'))

    const req = createRequest({
      environment: 'development',
      projectId: 'proj_test123',
      app: 'slack',
      client_id: 'client_123',
      redirect_uri: 'https://example.com/callback',
      state: 'test_state',
      response_type: 'code',
    })

    // OAuth token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'test_token' }),
    })

    // List accounts
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    })

    // Create connect token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        connect_link_url: 'https://pipedream.com/connect/link',
        expires_at: '2026-01-13T00:00:00Z',
      }),
    })

    await handler(req)

    // Verify external_user_id uses direct format
    const listAccountsCall = mockFetch.mock.calls[1][0]

    expect(listAccountsCall).toContain('external_user_id=direct%3Adirect_456')
  })
})

describe('Pipedream OAuth authorize - redirect and client binding', () => {
  const boundQuery = {
    environment: 'development',
    projectId: 'proj_test123',
    app: 'google_mail',
    client_id: 'client_123',
    redirect_uri: 'https://example.com/callback',
    state: 'test_state',
    response_type: 'code',
  }

  const boundConfig = {
    clientId: 'client_123',
    clientSecret: 'pipedream_client_secret',
    authorizationUrl:
      'https://example.com/api/auxiliary/secret/oauth/pipedream/authorize?projectId=proj_test123&environment=development&app=google_mail',
  }

  const boundState = {
    secretId: 'secret_123',
    contact: { id: 'contact_abc' },
    redirectUri: 'https://example.com/callback',
  }

  const mockHappyPipedream = () => {
    // OAuth token, list accounts, create connect token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'test_token' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        connect_link_url: 'https://pipedream.com/connect/link',
        expires_at: '2026-01-13T00:00:00Z',
      }),
    })
  }

  beforeEach(() => {
    prisma.secret.findUnique.mockResolvedValue({
      id: 'secret_123',
      userId: 'user_123',
    })
    getSecretOAuthConfig.mockResolvedValue(boundConfig)
    mockTryVerify.mockResolvedValue(boundState)
  })

  it('answers directly when the state is missing', async () => {
    const req = createRequest({ ...boundQuery, state: undefined })

    const response = await handler(req)

    expect(response.status).toBe(400)
    expect(response.headers.get('Location')).toBeNull()

    const body = await response.json()

    expect(body.error).toBe('invalid_request')
  })

  it('answers directly when the state does not verify', async () => {
    mockTryVerify.mockResolvedValue(null)

    const req = createRequest(boundQuery)

    const response = await handler(req)

    expect(response.status).toBe(400)
    expect(response.headers.get('Location')).toBeNull()

    const body = await response.json()

    expect(body.error).toBe('invalid_request')
    expect(body.error_description).toContain('state')
  })

  it('answers directly when the state carries no bound redirect uri', async () => {
    mockTryVerify.mockResolvedValue({
      secretId: 'secret_123',
      contact: { id: 'contact_abc' },
    })

    const req = createRequest(boundQuery)

    const response = await handler(req)

    expect(response.status).toBe(400)
    expect(response.headers.get('Location')).toBeNull()

    const body = await response.json()

    expect(body.error_description).toContain('redirect_uri')
  })

  it('answers directly when the redirect_uri does not match the bound value', async () => {
    const req = createRequest({
      ...boundQuery,
      redirect_uri: 'https://attacker.example.net/callback',
    })

    const response = await handler(req)

    expect(response.status).toBe(400)
    expect(response.headers.get('Location')).toBeNull()

    const body = await response.json()

    expect(body.error_description).toContain('redirect_uri')
  })

  it('answers directly when a missing parameter would otherwise redirect to an unvalidated uri', async () => {
    mockTryVerify.mockResolvedValue(null)

    const req = createRequest({
      ...boundQuery,
      environment: undefined,
      redirect_uri: 'https://attacker.example.net/callback',
    })

    const response = await handler(req)

    expect(response.status).toBe(400)
    expect(response.headers.get('Location')).toBeNull()
  })

  it('redirects the error when client_id does not match the secret configuration', async () => {
    const req = createRequest({
      ...boundQuery,
      client_id: 'client_impostor',
    })

    const response = await handler(req)

    expect(response.status).toBe(302)

    const location = response.headers.get('Location')

    expect(location).toContain('https://example.com/callback')
    expect(location).toContain('error=invalid_request')
    expect(location).toContain('client_id')
  })

  it('redirects the error when projectId does not match the configured authorization URL', async () => {
    const req = createRequest({
      ...boundQuery,
      projectId: 'proj_attacker',
    })

    const response = await handler(req)

    expect(response.status).toBe(302)

    const location = response.headers.get('Location')

    expect(location).toContain('https://example.com/callback')
    expect(location).toContain('error=invalid_request')
    expect(location).toContain('projectId')
  })

  it('redirects the error when environment does not match the configured authorization URL', async () => {
    const req = createRequest({
      ...boundQuery,
      environment: 'production',
    })

    const response = await handler(req)

    expect(response.status).toBe(302)

    const location = response.headers.get('Location')

    expect(location).toContain('error=invalid_request')
    expect(location).toContain('environment')
  })

  it('redirects the error when app does not match the configured authorization URL', async () => {
    const req = createRequest({
      ...boundQuery,
      app: 'zendesk',
    })

    const response = await handler(req)

    expect(response.status).toBe(302)

    const location = response.headers.get('Location')

    expect(location).toContain('error=invalid_request')
    expect(location).toContain('app')
  })

  it('uses the configured scope for the client credentials request, not the query', async () => {
    getSecretOAuthConfig.mockResolvedValue({
      ...boundConfig,
      scope: 'connect:tokens:create',
    })

    mockHappyPipedream()

    const req = createRequest({
      ...boundQuery,
      scope: 'connect:everything admin',
    })

    await handler(req)

    const tokenRequestBody = JSON.parse(mockFetch.mock.calls[0][1].body)

    expect(tokenRequestBody.scope).toBe('connect:tokens:create')
  })

  it('sends an empty scope when the configuration names none, matching the legacy behavior', async () => {
    mockHappyPipedream()

    const req = createRequest({
      ...boundQuery,
      scope: 'connect:everything admin',
    })

    await handler(req)

    const tokenRequestBody = JSON.parse(mockFetch.mock.calls[0][1].body)

    expect(tokenRequestBody.scope).toBe('')
  })

  it('completes the flow when every bound value matches', async () => {
    mockHappyPipedream()

    const req = createRequest(boundQuery)

    const response = await handler(req)

    expect(response.status).toBe(302)

    const location = response.headers.get('Location')

    expect(location).toContain('https://pipedream.com/connect/link')
  })

  it('answers a replayed callback directly once the state has been consumed', async () => {
    // @note phase 2 deletes the state from the cache immediately after
    // retrieval, so a replayed callback finds nothing and must not redirect

    memcache.get.mockResolvedValue(null)

    const req = createRequest({ stateId: 'used-state-id' })

    const response = await handler(req)

    expect(response.status).toBe(400)
    expect(response.headers.get('Location')).toBeNull()

    const body = await response.json()

    expect(body.error).toBe('invalid_request')
  })

  it('consumes the callback state before acting on it', async () => {
    memcache.get.mockResolvedValue({
      userId: 'user_123',
      secretId: 'secret_123',
      clientId: 'client_123',
      projectId: 'proj_test123',
      environment: 'development',
      externalUserId: 'contact:contact_abc',
      expiresAt: '2026-01-13T00:00:00Z',
      state: 'test_state',
      redirectUri: 'https://example.com/callback',
    })

    // @note fail the token request so the test stops early - the deletion
    // must already have happened by then

    mockFetch.mockResolvedValue({
      ok: false,
      text: async () => 'boom',
    })

    const req = createRequest({ stateId: 'live-state-id' })

    await handler(req)

    expect(memcache.del).toHaveBeenCalledWith(
      'pipedream:oauth:state:live-state-id'
    )
  })
})
