import { swrCache } from '@/lib/cache'
import fetch from '@/lib/egress.fetch'
import { sha256 } from '@/lib/webcrypto'

import { obtainAccessToken, validateAccessToken } from './oauth.token'

jest.mock('@/lib/cache')
jest.mock('@/lib/egress.fetch')
jest.mock('@/lib/webcrypto')
jest.mock('@/lib/host', () => ({
  getExternalAPIHostURL: jest.fn((path = '/') =>
    new URL(path, 'https://chatbotkit.com').toString()
  ),
}))

describe('validateAccessToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    sha256.mockImplementation((str) => Promise.resolve(`hashed-${str}`))
    swrCache.mockImplementation((key, ttl, fn) => fn())
  })

  test('returns null when no validateUrl is provided', async () => {
    const result = await validateAccessToken({ accessToken: 'token123' })

    expect(result).toBeNull()
  })

  test('handles generic URL with successful response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
    })

    const result = await validateAccessToken({
      accessToken: 'token123',
      oAuthIntegration: {
        validateUrl: 'https://api.example.com/validate',
      },
    })

    expect(result).toBe('valid')

    expect(fetch).toHaveBeenCalledWith('https://api.example.com/validate', {
      headers: { Authorization: 'Bearer token123' },
    })
  })

  test('handles generic URL with unsuccessful response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
    })

    const result = await validateAccessToken({
      accessToken: 'token123',
      oAuthIntegration: {
        validateUrl: 'https://api.example.com/validate',
      },
    })

    expect(result).toBe('invalid')
  })

  test('uses swrCache with correct parameters', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    sha256.mockResolvedValueOnce('hashed-token')

    await validateAccessToken({
      accessToken: 'token123',
      oAuthIntegration: {
        validateUrl: 'https://api.example.com/validate',
      },
    })

    expect(swrCache).toHaveBeenCalledWith(
      expect.stringContaining(
        'oauth:revalidate:swr:https://api.example.com/validate:hashed-token'
      ),
      expect.any(Number),
      expect.any(Function)
    )
  })

  test('handles slack://auth.test validation URL with valid response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ ok: true })),
    })

    const result = await validateAccessToken({
      accessToken: 'valid-token',
      oAuthIntegration: {
        validateUrl: 'slack://auth.test',
      },
    })

    expect(result).toBe('valid')

    expect(fetch).toHaveBeenCalledWith('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Bearer valid-token',
      },
    })
  })

  test('handles slack://auth.test validation URL with invalid response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ ok: false })),
    })

    const result = await validateAccessToken({
      accessToken: 'invalid-token',
      oAuthIntegration: {
        validateUrl: 'slack://auth.test',
      },
    })

    expect(result).toBe('invalid')
  })

  test('handles slack://auth.test with non-JSON response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('not-json'),
    })

    const result = await validateAccessToken({
      accessToken: 'token',
      oAuthIntegration: {
        validateUrl: 'slack://auth.test',
      },
    })

    expect(result).toBe('invalid')
  })

  test('handles slack://auth.test with unsuccessful HTTP response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve(''),
    })

    const result = await validateAccessToken({
      accessToken: 'expired-token',
      oAuthIntegration: {
        validateUrl: 'slack://auth.test',
      },
    })

    expect(result).toBe('invalid')
  })

  test('handles atlassian://oauth/token/accessible-resources with valid response (array with items)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () =>
        Promise.resolve(JSON.stringify([{ id: '1', name: 'Resource' }])),
    })

    const result = await validateAccessToken({
      accessToken: 'atlassian-valid-token',
      oAuthIntegration: {
        validateUrl: 'atlassian://oauth/token/accessible-resources',
      },
    })

    expect(result).toBe('valid')

    expect(fetch).toHaveBeenCalledWith(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      {
        headers: {
          Authorization: 'Bearer atlassian-valid-token',
        },
      }
    )
  })

  test('handles atlassian://oauth/token/accessible-resources with valid response (empty array)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(JSON.stringify([])),
    })

    const result = await validateAccessToken({
      accessToken: 'atlassian-empty-array',
      oAuthIntegration: {
        validateUrl: 'atlassian://oauth/token/accessible-resources',
      },
    })

    expect(result).toBe('invalid')
  })

  test('handles atlassian://oauth/token/accessible-resources with non-JSON response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('not-json'),
    })

    const result = await validateAccessToken({
      accessToken: 'atlassian-non-json',
      oAuthIntegration: {
        validateUrl: 'atlassian://oauth/token/accessible-resources',
      },
    })

    expect(result).toBe('invalid')
  })

  test('handles atlassian://oauth/token/accessible-resources with unsuccessful HTTP response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve(''),
    })

    const result = await validateAccessToken({
      accessToken: 'atlassian-invalid-token',
      oAuthIntegration: {
        validateUrl: 'atlassian://oauth/token/accessible-resources',
      },
    })

    expect(result).toBe('invalid')
  })
})

describe('obtainAccessToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should resolve relative tokenUrl to absolute URL before fetching', async () => {
    const expiredAccessTokenExpiresAt = new Date(Date.now() - 1000)
    const updateToken = jest.fn()

    fetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            access_token: 'new-access-token',
            expires_in: 3600,
          })
        ),
    })

    await obtainAccessToken({
      accessToken: 'expired-access-token',
      accessTokenExpiresAt: expiredAccessTokenExpiresAt,
      refreshToken: 'valid-refresh-token',
      oAuthIntegration: {
        clientId: 'test-client-id',
        tokenUrl: '/api/auxiliary/secret/oauth/pipedream/token',
      },
      updateToken,
    })

    // @note fetch must be called with an absolute URL - relative URLs throw TypeError in Node.js
    expect(fetch).toHaveBeenCalledWith(
      'https://chatbotkit.com/api/auxiliary/secret/oauth/pipedream/token',
      expect.any(Object)
    )
  })

  it('should resolve relative tokenUrl to absolute URL for client_credentials grant', async () => {
    const updateToken = jest.fn()

    fetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            access_token: 'new-cc-token',
            expires_in: 3600,
          })
        ),
    })

    await obtainAccessToken({
      oAuthIntegration: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: '/api/auxiliary/secret/oauth/pipedream/token',
        grantType: 'client_credentials',
      },
      updateToken,
    })

    // @note fetch must be called with an absolute URL - relative URLs throw TypeError in Node.js
    expect(fetch).toHaveBeenCalledWith(
      'https://chatbotkit.com/api/auxiliary/secret/oauth/pipedream/token',
      expect.any(Object)
    )
  })

  it('should refresh token without clientSecret for PKCE/public clients', async () => {
    // @note this mimics Sentry MCP which uses PKCE (public client) without clientSecret
    const expiredAccessTokenExpiresAt = new Date(Date.now() - 1000)
    const updateToken = jest.fn()

    fetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            access_token: 'new-access-token',
            expires_in: 3600,
          })
        ),
    })

    const result = await obtainAccessToken({
      accessToken: 'expired-access-token',
      accessTokenExpiresAt: expiredAccessTokenExpiresAt,
      refreshToken: 'valid-refresh-token',
      oAuthIntegration: {
        clientId: 'test-client-id',
        // @note no clientSecret - this is a PKCE/public client
        tokenUrl: 'https://mcp.sentry.dev/oauth/token',
      },
      updateToken,
    })

    expect(result).toBe('new-access-token')
    expect(fetch).toHaveBeenCalledWith('https://mcp.sentry.dev/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: expect.any(URLSearchParams),
    })
    expect(updateToken).toHaveBeenCalled()
  })

  it('should refresh token with clientSecret for confidential clients', async () => {
    const expiredAccessTokenExpiresAt = new Date(Date.now() - 1000)
    const updateToken = jest.fn()

    fetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            access_token: 'new-access-token',
            expires_in: 3600,
          })
        ),
    })

    const result = await obtainAccessToken({
      accessToken: 'expired-access-token',
      accessTokenExpiresAt: expiredAccessTokenExpiresAt,
      refreshToken: 'valid-refresh-token',
      oAuthIntegration: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: 'https://oauth.example.com/token',
      },
      updateToken,
    })

    expect(result).toBe('new-access-token')
    expect(updateToken).toHaveBeenCalled()
  })

  it('should return null when refresh token is expired', async () => {
    const expiredRefreshTokenExpiresAt = new Date(Date.now() - 1000)
    const updateToken = jest.fn()

    const result = await obtainAccessToken({
      accessToken: 'expired-access-token',
      accessTokenExpiresAt: new Date(Date.now() - 1000),
      refreshToken: 'expired-refresh-token',
      refreshTokenExpiresAt: expiredRefreshTokenExpiresAt,
      oAuthIntegration: {
        clientId: 'test-client-id',
        tokenUrl: 'https://oauth.example.com/token',
      },
      updateToken,
    })

    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(updateToken).not.toHaveBeenCalled()
  })

  it('should return null when token response has empty access_token', async () => {
    const expiredAccessTokenExpiresAt = new Date(Date.now() - 1000)
    const updateToken = jest.fn()

    fetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            // @note missing or empty access_token
            expires_in: 3600,
          })
        ),
    })

    const result = await obtainAccessToken({
      accessToken: 'expired-access-token',
      accessTokenExpiresAt: expiredAccessTokenExpiresAt,
      refreshToken: 'valid-refresh-token',
      oAuthIntegration: {
        clientId: 'test-client-id',
        tokenUrl: 'https://oauth.example.com/token',
      },
      updateToken,
    })

    // @note should return null when access_token is missing
    expect(result).toBeNull()
  })

  it('should return null when token response is parsable but missing access_token', async () => {
    // @note query strings like "error=invalid_grant" are parsable but lack access_token
    const expiredAccessTokenExpiresAt = new Date(Date.now() - 1000)
    const updateToken = jest.fn()

    fetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve('error=invalid_grant&error_description=Token+expired'),
    })

    const result = await obtainAccessToken({
      accessToken: 'expired-access-token',
      accessTokenExpiresAt: expiredAccessTokenExpiresAt,
      refreshToken: 'valid-refresh-token',
      oAuthIntegration: {
        clientId: 'test-client-id',
        tokenUrl: 'https://oauth.example.com/token',
      },
      updateToken,
    })

    expect(result).toBeNull()
    expect(updateToken).not.toHaveBeenCalled()
  })
})
