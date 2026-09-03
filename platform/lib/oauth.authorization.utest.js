import fetch from '@/lib/egress.fetch'
import { getExternalFrontendHostURL, getExternalHostURL } from '@/lib/host'
import { trySign } from '@/lib/jwt'
import {
  getAuthorizationCodeGrantCredentials,
  getAuthorizationURL,
  getCallbackURL,
  getClientCredentialsGrantCredentials,
  refreshAccessToken,
} from '@/lib/oauth.authorization'

jest.mock('@/lib/host')
jest.mock('@/lib/jwt')
jest.mock('@/lib/egress.fetch')

const mockGetExternalHostURL = getExternalHostURL
const mockGetExternalFrontendHostURL = getExternalFrontendHostURL
const mockTrySign = trySign
const mockFetch = fetch

describe('getCallbackURL', () => {
  const FALLBACK_URL = 'https://example.com/secrets/oauth/callback'
  const CALLBACK_PATH = '/secrets/oauth/callback'

  beforeEach(() => {
    jest.clearAllMocks()

    mockGetExternalHostURL.mockReturnValue(FALLBACK_URL)
  })

  test('returns the deployment callback URL', async () => {
    const result = await getCallbackURL()

    expect(result).toBe(FALLBACK_URL)
    expect(mockGetExternalHostURL).toHaveBeenCalledWith(CALLBACK_PATH)
  })

  describe('error handling', () => {
    test('throws error when getExternalHostURL throws during fallback', async () => {
      const errorMessage = 'Failed to generate external URL'

      mockGetExternalHostURL.mockImplementation(() => {
        throw new Error(errorMessage)
      })

      await expect(getCallbackURL()).rejects.toThrow(errorMessage)

      expect(mockGetExternalHostURL).toHaveBeenCalledWith(CALLBACK_PATH)
    })
  })
})

describe('getAuthorizationURL', () => {
  const CALLBACK_URL = 'https://example.com/secrets/oauth/callback'
  const STATE_TOKEN = 'signed-state-token'

  beforeEach(() => {
    jest.clearAllMocks()

    mockGetExternalHostURL.mockReturnValue(CALLBACK_URL)
    mockGetExternalFrontendHostURL.mockReturnValue('https://example.com')
    mockTrySign.mockResolvedValue(STATE_TOKEN)
  })

  describe('basic authorization URL generation', () => {
    test('builds URL with required parameters', async () => {
      const options = {
        clientId: 'test-client-id',
        authorizationUrl: 'https://auth.example.com/authorize',
        scope: 'read write',
      }

      const state = { secretId: 'test-secret' }

      const result = await getAuthorizationURL(options, state)

      expect(result.searchParams.get('client_id')).toBe('test-client-id')
      expect(result.searchParams.get('redirect_uri')).toBe(CALLBACK_URL)
      expect(result.searchParams.get('response_type')).toBe('code')
      expect(result.searchParams.get('scope')).toBe('read write')
      expect(result.searchParams.get('state')).toBe(STATE_TOKEN)
    })

    test('handles empty scope', async () => {
      const options = {
        clientId: 'test-client-id',
        authorizationUrl: 'https://auth.example.com/authorize',
      }

      const state = { secretId: 'test-secret' }

      const result = await getAuthorizationURL(options, state)

      expect(result.searchParams.get('scope')).toBe('')
    })

    test('binds the redirect uri into the signed state', async () => {
      const options = {
        clientId: 'test-client-id',
        authorizationUrl: 'https://auth.example.com/authorize',
      }

      const state = { secretId: 'test-secret' }

      await getAuthorizationURL(options, state)

      expect(mockTrySign).toHaveBeenCalledWith(
        { secretId: 'test-secret', redirectUri: CALLBACK_URL },
        expect.any(Number)
      )
    })

    test('throws error when state token signing fails', async () => {
      mockTrySign.mockResolvedValue(null)

      const options = {
        clientId: 'test-client-id',
        authorizationUrl: 'https://auth.example.com/authorize',
      }

      await expect(getAuthorizationURL(options, {})).rejects.toThrow(
        'State token failed'
      )
    })
  })

  describe('PKCE support', () => {
    test('includes code_challenge and code_challenge_method when codeChallenge provided', async () => {
      const options = {
        clientId: 'test-client-id',
        authorizationUrl: 'https://auth.example.com/authorize',
        codeChallenge: 'test-code-challenge-base64url',
      }

      const state = { secretId: 'test-secret' }

      const result = await getAuthorizationURL(options, state)

      expect(result.searchParams.get('code_challenge')).toBe(
        'test-code-challenge-base64url'
      )
      expect(result.searchParams.get('code_challenge_method')).toBe('S256')
    })

    test('uses provided codeChallengeMethod', async () => {
      const options = {
        clientId: 'test-client-id',
        authorizationUrl: 'https://auth.example.com/authorize',
        codeChallenge: 'test-code-challenge',
        codeChallengeMethod: 'S256',
      }

      const state = { secretId: 'test-secret' }

      const result = await getAuthorizationURL(options, state)

      expect(result.searchParams.get('code_challenge_method')).toBe('S256')
    })

    test('does not include PKCE params when codeChallenge not provided', async () => {
      const options = {
        clientId: 'test-client-id',
        authorizationUrl: 'https://auth.example.com/authorize',
      }

      const state = { secretId: 'test-secret' }

      const result = await getAuthorizationURL(options, state)

      expect(result.searchParams.has('code_challenge')).toBe(false)
      expect(result.searchParams.has('code_challenge_method')).toBe(false)
    })
  })

  describe('provider-specific handling', () => {
    test('moves scope to user_scope for Slack when scope includes search:read', async () => {
      const options = {
        clientId: 'test-client-id',
        authorizationUrl: 'https://slack.com/oauth/v2/authorize',
        scope: 'search:read channels:read',
      }

      const state = { secretId: 'test-secret' }

      const result = await getAuthorizationURL(options, state)

      expect(result.searchParams.get('user_scope')).toBe(
        'search:read channels:read'
      )
      expect(result.searchParams.has('scope')).toBe(false)
    })

    test('keeps scope for Slack when scope does not include search:read', async () => {
      const options = {
        clientId: 'test-client-id',
        authorizationUrl: 'https://slack.com/oauth/v2/authorize',
        scope: 'channels:read users:read',
      }

      const state = { secretId: 'test-secret' }

      const result = await getAuthorizationURL(options, state)

      expect(result.searchParams.has('user_scope')).toBe(false)
      expect(result.searchParams.get('scope')).toBe('channels:read users:read')
    })

    test('removes scope parameter for Zoom', async () => {
      const options = {
        clientId: 'test-client-id',
        authorizationUrl: 'https://zoom.us/oauth/authorize',
        scope: 'meeting:read user:read',
      }

      const state = { secretId: 'test-secret' }

      const result = await getAuthorizationURL(options, state)

      expect(result.searchParams.has('scope')).toBe(false)
    })
  })
})

describe('getAuthorizationCodeGrantCredentials', () => {
  const TOKEN_URL = 'https://auth.example.com/token'
  const CALLBACK_URL = 'https://example.com/secrets/oauth/callback'

  beforeEach(() => {
    jest.clearAllMocks()

    mockGetExternalHostURL.mockReturnValue(CALLBACK_URL)
    mockGetExternalFrontendHostURL.mockReturnValue('https://example.com')
  })

  describe('successful token exchange', () => {
    test('exchanges code for tokens with JSON response', async () => {
      const tokenResponse = {
        access_token: 'test-access-token',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        refresh_token_expires_in: 86400,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await getAuthorizationCodeGrantCredentials('auth-code', {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('test-access-token')
      expect(result.refreshToken).toBe('test-refresh-token')
      expect(result.accessTokenExpiresAt).toBeInstanceOf(Date)
      expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date)
    })

    test('handles response without expiration times', async () => {
      const tokenResponse = {
        access_token: 'test-access-token',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await getAuthorizationCodeGrantCredentials('auth-code', {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('test-access-token')
      expect(result.accessTokenExpiresAt).toBeUndefined()
      expect(result.refreshToken).toBeUndefined()
      expect(result.refreshTokenExpiresAt).toBeUndefined()
    })
  })

  describe('PKCE support', () => {
    test('includes code_verifier in request when provided', async () => {
      const tokenResponse = {
        access_token: 'test-access-token',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      await getAuthorizationCodeGrantCredentials('auth-code', {
        clientId: 'test-client-id',
        tokenUrl: TOKEN_URL,
        codeVerifier: 'test-code-verifier',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        TOKEN_URL,
        expect.objectContaining({
          method: 'POST',
          body: expect.any(URLSearchParams),
        })
      )

      const body = mockFetch.mock.calls[0][1].body

      expect(body.get('code_verifier')).toBe('test-code-verifier')
    })

    test('allows missing clientSecret when codeVerifier provided', async () => {
      const tokenResponse = {
        access_token: 'test-access-token',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await getAuthorizationCodeGrantCredentials('auth-code', {
        clientId: 'test-client-id',
        tokenUrl: TOKEN_URL,
        codeVerifier: 'test-code-verifier',
      })

      expect(result.accessToken).toBe('test-access-token')

      const body = mockFetch.mock.calls[0][1].body

      expect(body.has('client_secret')).toBe(false)
      expect(body.get('code_verifier')).toBe('test-code-verifier')
    })

    test('includes both clientSecret and codeVerifier when both provided', async () => {
      const tokenResponse = {
        access_token: 'test-access-token',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      await getAuthorizationCodeGrantCredentials('auth-code', {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: TOKEN_URL,
        codeVerifier: 'test-code-verifier',
      })

      const body = mockFetch.mock.calls[0][1].body

      expect(body.get('client_secret')).toBe('test-client-secret')
      expect(body.get('code_verifier')).toBe('test-code-verifier')
    })
  })

  describe('error handling', () => {
    test('throws error on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid grant',
      })

      await expect(
        getAuthorizationCodeGrantCredentials('auth-code', {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          tokenUrl: TOKEN_URL,
        })
      ).rejects.toThrow('Token request failed')
    })

    test('handles query-string response format', async () => {
      // URLSearchParams accepts most strings, so this is parsed as query params
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'access_token=test-token&expires_in=3600',
      })

      const result = await getAuthorizationCodeGrantCredentials('auth-code', {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('test-token')
    })

    test('throws error on empty response body', async () => {
      // Empty strings are parsed as valid query strings with no parameters
      // but should fail validation because access_token is required
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '',
      })

      await expect(
        getAuthorizationCodeGrantCredentials('auth-code', {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          tokenUrl: TOKEN_URL,
        })
      ).rejects.toThrow('Invalid token response')
    })
  })

  describe('provider-specific handling', () => {
    test('uses Basic authentication for Reddit token endpoint', async () => {
      const tokenResponse = {
        access_token: 'reddit-access-token',
        expires_in: 3600,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      await getAuthorizationCodeGrantCredentials('auth-code', {
        clientId: 'reddit-client-id',
        clientSecret: 'reddit-client-secret',
        tokenUrl: 'https://www.reddit.com/api/v1/access_token',
      })

      const headers = mockFetch.mock.calls[0][1].headers

      expect(headers['Authorization']).toMatch(/^Basic /)
    })

    test('uses Basic authentication for Notion token endpoint', async () => {
      const tokenResponse = {
        access_token: 'notion-access-token',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      await getAuthorizationCodeGrantCredentials('auth-code', {
        clientId: 'notion-client-id',
        clientSecret: 'notion-client-secret',
        tokenUrl: 'https://api.notion.com/v1/oauth/token',
      })

      const headers = mockFetch.mock.calls[0][1].headers

      expect(headers['Authorization']).toMatch(/^Basic /)
    })

    test('extracts authed_user from Slack response', async () => {
      const tokenResponse = {
        ok: true,
        authed_user: {
          access_token: 'slack-user-access-token',
          expires_in: 43200,
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await getAuthorizationCodeGrantCredentials('auth-code', {
        clientId: 'slack-client-id',
        clientSecret: 'slack-client-secret',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
      })

      expect(result.accessToken).toBe('slack-user-access-token')
    })

    test('handles Slack response without authed_user', async () => {
      const tokenResponse = {
        ok: true,
        access_token: 'slack-bot-access-token',
        expires_in: 3600,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await getAuthorizationCodeGrantCredentials('auth-code', {
        clientId: 'slack-client-id',
        clientSecret: 'slack-client-secret',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
      })

      expect(result.accessToken).toBe('slack-bot-access-token')
    })
  })

  describe('additional properties handling', () => {
    test('returns additional_properties from response', async () => {
      const tokenResponse = {
        access_token: 'test-access-token',
        expires_in: 3600,
        additional_properties: {
          custom_field: 'custom_value',
          another_field: 123,
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await getAuthorizationCodeGrantCredentials('auth-code', {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: TOKEN_URL,
      })

      expect(result.additionalProperties).toEqual({
        custom_field: 'custom_value',
        another_field: 123,
      })
    })
  })
})

describe('refreshAccessToken', () => {
  const TOKEN_URL = 'https://auth.example.com/token'

  beforeEach(() => {
    jest.clearAllMocks()

    mockGetExternalFrontendHostURL.mockReturnValue('https://example.com')
  })

  describe('successful token refresh', () => {
    test('refreshes access token with JSON response', async () => {
      const tokenResponse = {
        access_token: 'new-access-token',
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
        refresh_token_expires_in: 86400,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await refreshAccessToken('old-refresh-token', {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('new-access-token')
      expect(result.refreshToken).toBe('new-refresh-token')
      expect(result.accessTokenExpiresAt).toBeInstanceOf(Date)
      expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date)
    })

    test('handles response without new refresh token', async () => {
      const tokenResponse = {
        access_token: 'new-access-token',
        expires_in: 3600,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await refreshAccessToken('old-refresh-token', {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('new-access-token')
      expect(result.refreshToken).toBeUndefined()
    })

    test('sends correct request parameters', async () => {
      const tokenResponse = {
        access_token: 'new-access-token',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      await refreshAccessToken('old-refresh-token', {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: TOKEN_URL,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        TOKEN_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.any(URLSearchParams),
        })
      )

      const body = mockFetch.mock.calls[0][1].body

      expect(body.get('grant_type')).toBe('refresh_token')
      expect(body.get('refresh_token')).toBe('old-refresh-token')
      expect(body.get('client_id')).toBe('test-client-id')
      expect(body.get('client_secret')).toBe('test-client-secret')
    })
  })

  describe('public client support (PKCE)', () => {
    test('allows missing clientSecret for public clients', async () => {
      const tokenResponse = {
        access_token: 'new-access-token',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await refreshAccessToken('old-refresh-token', {
        clientId: 'test-client-id',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('new-access-token')

      const body = mockFetch.mock.calls[0][1].body

      expect(body.has('client_secret')).toBe(false)
      expect(body.get('client_id')).toBe('test-client-id')
    })
  })

  describe('error handling', () => {
    test('throws error on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid refresh token',
      })

      await expect(
        refreshAccessToken('old-refresh-token', {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          tokenUrl: TOKEN_URL,
        })
      ).rejects.toThrow('Token refresh failed')
    })

    test('handles query-string response format', async () => {
      // URLSearchParams accepts most strings, so this is parsed as query params
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'access_token=refreshed-token&expires_in=7200',
      })

      const result = await refreshAccessToken('old-refresh-token', {
        clientId: 'test-client-id',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('refreshed-token')
    })

    test('throws error on empty response body', async () => {
      // Empty strings are parsed as valid query strings with no parameters
      // but should fail validation because access_token is required
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '',
      })

      await expect(
        refreshAccessToken('old-refresh-token', {
          clientId: 'test-client-id',
          tokenUrl: TOKEN_URL,
        })
      ).rejects.toThrow('Invalid token response')
    })
  })

  describe('additional properties handling', () => {
    test('returns additional_properties from response', async () => {
      const tokenResponse = {
        access_token: 'new-access-token',
        expires_in: 3600,
        additional_properties: {
          scope: 'read write',
          token_type: 'Bearer',
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await refreshAccessToken('old-refresh-token', {
        clientId: 'test-client-id',
        tokenUrl: TOKEN_URL,
      })

      expect(result.additionalProperties).toEqual({
        scope: 'read write',
        token_type: 'Bearer',
      })
    })
  })
})

describe('getClientCredentialsGrantCredentials', () => {
  const TOKEN_URL = 'https://auth.example.com/token'

  beforeEach(() => {
    jest.clearAllMocks()

    mockGetExternalFrontendHostURL.mockReturnValue('https://example.com')
  })

  describe('successful token exchange', () => {
    test('exchanges client credentials for access token with JSON response', async () => {
      const tokenResponse = {
        access_token: 'client-credentials-access-token',
        expires_in: 3600,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await getClientCredentialsGrantCredentials({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('client-credentials-access-token')
      expect(result.accessTokenExpiresAt).toBeInstanceOf(Date)
    })

    test('handles response without expiration time', async () => {
      const tokenResponse = {
        access_token: 'client-credentials-access-token',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await getClientCredentialsGrantCredentials({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('client-credentials-access-token')
      expect(result.accessTokenExpiresAt).toBeUndefined()
    })

    test('sends correct request parameters', async () => {
      const tokenResponse = {
        access_token: 'client-credentials-access-token',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      await getClientCredentialsGrantCredentials({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: TOKEN_URL,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        TOKEN_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.any(URLSearchParams),
        })
      )

      const body = mockFetch.mock.calls[0][1].body

      expect(body.get('grant_type')).toBe('client_credentials')
      expect(body.get('client_id')).toBe('test-client-id')
      expect(body.get('client_secret')).toBe('test-client-secret')
    })

    test('allows missing clientSecret', async () => {
      const tokenResponse = {
        access_token: 'client-credentials-access-token',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await getClientCredentialsGrantCredentials({
        clientId: 'test-client-id',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('client-credentials-access-token')

      const body = mockFetch.mock.calls[0][1].body

      expect(body.has('client_secret')).toBe(false)
    })
  })

  describe('error handling', () => {
    test('throws error on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid client credentials',
      })

      await expect(
        getClientCredentialsGrantCredentials({
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          tokenUrl: TOKEN_URL,
        })
      ).rejects.toThrow('Token request failed')
    })

    test('handles query-string response format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'access_token=client-token&expires_in=1800',
      })

      const result = await getClientCredentialsGrantCredentials({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('client-token')
    })

    test('throws error on empty response body', async () => {
      // Empty strings are parsed as valid query strings with no parameters
      // but should fail validation because access_token is required
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '',
      })

      await expect(
        getClientCredentialsGrantCredentials({
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          tokenUrl: TOKEN_URL,
        })
      ).rejects.toThrow('Invalid token response')
    })
  })

  describe('additional properties handling', () => {
    test('returns additional_properties from response', async () => {
      const tokenResponse = {
        access_token: 'client-credentials-access-token',
        expires_in: 3600,
        additional_properties: {
          scope: 'api.read api.write',
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await getClientCredentialsGrantCredentials({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: TOKEN_URL,
      })

      expect(result.additionalProperties).toEqual({
        scope: 'api.read api.write',
      })
    })
  })
})

/**
 * Token Response Validation Tests
 *
 * These tests verify that OAuth token responses are properly validated using Zod schema.
 * Invalid responses should throw errors rather than silently returning bad data.
 */
describe('Token Response Validation', () => {
  const TOKEN_URL = 'https://auth.example.com/token'

  beforeEach(() => {
    jest.clearAllMocks()

    mockGetExternalHostURL.mockReturnValue(
      'https://example.com/secrets/oauth/callback'
    )
    mockGetExternalFrontendHostURL.mockReturnValue('https://example.com')
  })

  describe('access_token validation', () => {
    it('throws error when access_token is null', async () => {
      const tokenResponse = {
        access_token: null,
        expires_in: 3600,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      await expect(
        getAuthorizationCodeGrantCredentials('test-code', {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          tokenUrl: TOKEN_URL,
        })
      ).rejects.toThrow('Invalid token response')
    })

    it('throws error when access_token is missing', async () => {
      const tokenResponse = {
        expires_in: 3600,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      await expect(
        getAuthorizationCodeGrantCredentials('test-code', {
          clientId: 'test-client-id',
          tokenUrl: TOKEN_URL,
        })
      ).rejects.toThrow('Invalid token response')
    })

    it('throws error when access_token is an empty string', async () => {
      const tokenResponse = {
        access_token: '',
        expires_in: 3600,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      await expect(
        getAuthorizationCodeGrantCredentials('test-code', {
          clientId: 'test-client-id',
          tokenUrl: TOKEN_URL,
        })
      ).rejects.toThrow('Invalid token response')
    })

    it('throws error when access_token is an object', async () => {
      const tokenResponse = {
        access_token: { token: 'nested' },
        expires_in: 3600,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      await expect(
        getAuthorizationCodeGrantCredentials('test-code', {
          clientId: 'test-client-id',
          tokenUrl: TOKEN_URL,
        })
      ).rejects.toThrow('Invalid token response')
    })

    it('throws error when access_token is a number', async () => {
      const tokenResponse = {
        access_token: 12345,
        expires_in: 3600,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      await expect(
        getAuthorizationCodeGrantCredentials('test-code', {
          clientId: 'test-client-id',
          tokenUrl: TOKEN_URL,
        })
      ).rejects.toThrow('Invalid token response')
    })
  })

  describe('valid responses', () => {
    it('accepts valid token response with all fields', async () => {
      const tokenResponse = {
        access_token: 'valid-access-token',
        expires_in: 3600,
        refresh_token: 'valid-refresh-token',
        refresh_token_expires_in: 86400,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await getAuthorizationCodeGrantCredentials('test-code', {
        clientId: 'test-client-id',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('valid-access-token')
      expect(result.refreshToken).toBe('valid-refresh-token')
      expect(result.accessTokenExpiresAt).toBeInstanceOf(Date)
      expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date)
    })

    it('accepts valid token response with only required fields', async () => {
      const tokenResponse = {
        access_token: 'valid-access-token',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await getAuthorizationCodeGrantCredentials('test-code', {
        clientId: 'test-client-id',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('valid-access-token')
      expect(result.refreshToken).toBeUndefined()
      expect(result.accessTokenExpiresAt).toBeUndefined()
    })

    it('accepts response with extra fields (passthrough)', async () => {
      const tokenResponse = {
        access_token: 'valid-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read write',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(tokenResponse),
      })

      const result = await getAuthorizationCodeGrantCredentials('test-code', {
        clientId: 'test-client-id',
        tokenUrl: TOKEN_URL,
      })

      expect(result.accessToken).toBe('valid-access-token')
    })
  })
})
