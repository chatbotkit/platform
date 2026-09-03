/* eslint-disable @typescript-eslint/no-require-imports */
import { revokeOAuthToken } from '@/lib/oauth.revoke'

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/egress.fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  getFetchError: jest.fn(),
}))

jest.mock('@/lib/secret.oauth', () => ({
  getSecretOAuthConfig: jest.fn(),
}))

jest.mock('./host', () => ({
  getExternalAPIHostURL: jest.fn(() => 'https://api.example.com'),
}))

describe('revokeOAuthToken', () => {
  let mockSecret
  let mockFetch
  let mockGetSecretOAuthConfig
  let mockGetFetchError
  let mockCaptureException

  beforeEach(() => {
    jest.clearAllMocks()

    mockSecret = { id: 'secret-123', type: 'oauth' }

    mockFetch = require('@/lib/egress.fetch').default
    mockGetSecretOAuthConfig =
      require('@/lib/secret.oauth').getSecretOAuthConfig
    mockGetFetchError = require('@/lib/fetch').getFetchError
    mockCaptureException = require('@/lib/error').captureException

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    })
  })

  describe('basic functionality', () => {
    it('should successfully revoke token with all credentials', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        revokeUrl: 'https://provider.com/revoke',
        clientId: 'client-id-123',
        clientSecret: 'client-secret-456',
      })

      await revokeOAuthToken(mockSecret, 'access-token-789')

      expect(mockGetSecretOAuthConfig).toHaveBeenCalledWith(mockSecret)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: 'https://provider.com/revoke',
        }),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.stringContaining('token=access-token-789'),
        })
      )

      const fetchCall = mockFetch.mock.calls[0]
      const body = fetchCall[1].body

      expect(body).toContain('token=access-token-789')
      expect(body).toContain('client_id=client-id-123')
      expect(body).toContain('client_secret=client-secret-456')
    })

    it('should revoke token with only clientId', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        revokeUrl: 'https://provider.com/revoke',
        clientId: 'client-id-123',
      })

      await revokeOAuthToken(mockSecret, 'access-token-789')

      const fetchCall = mockFetch.mock.calls[0]
      const body = fetchCall[1].body

      expect(body).toContain('token=access-token-789')
      expect(body).toContain('client_id=client-id-123')
      expect(body).not.toContain('client_secret')
    })

    it('should revoke token with only clientSecret', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        revokeUrl: 'https://provider.com/revoke',
        clientSecret: 'client-secret-456',
      })

      await revokeOAuthToken(mockSecret, 'access-token-789')

      const fetchCall = mockFetch.mock.calls[0]
      const body = fetchCall[1].body

      expect(body).toContain('token=access-token-789')
      expect(body).toContain('client_secret=client-secret-456')
      expect(body).not.toContain('client_id')
    })

    it('should revoke token with only token (no credentials)', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        revokeUrl: 'https://provider.com/revoke',
      })

      await revokeOAuthToken(mockSecret, 'access-token-789')

      const fetchCall = mockFetch.mock.calls[0]
      const body = fetchCall[1].body

      expect(body).toBe('token=access-token-789')
    })
  })

  describe('edge cases', () => {
    it('should return early when revokeUrl is not provided', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        clientId: 'client-id-123',
      })

      await revokeOAuthToken(mockSecret, 'access-token-789')

      expect(mockFetch).not.toHaveBeenCalled()
      expect(mockCaptureException).not.toHaveBeenCalled()
    })

    it('should return early when revokeUrl is null', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        revokeUrl: null,
        clientId: 'client-id-123',
      })

      await revokeOAuthToken(mockSecret, 'access-token-789')

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return early when revokeUrl is empty string', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        revokeUrl: '',
        clientId: 'client-id-123',
      })

      await revokeOAuthToken(mockSecret, 'access-token-789')

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle special characters in token', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        revokeUrl: 'https://provider.com/revoke',
      })

      const specialToken = 'token+with/special=chars&more'

      await revokeOAuthToken(mockSecret, specialToken)

      const fetchCall = mockFetch.mock.calls[0]
      const body = fetchCall[1].body

      expect(body).toContain('token=token%2Bwith%2Fspecial%3Dchars%26more')
    })
  })

  describe('error handling', () => {
    it('should capture exception when fetch fails with non-ok response', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        revokeUrl: 'https://provider.com/revoke',
        clientId: 'client-id-123',
      })

      const mockError = new Error('Revocation failed')

      mockGetFetchError.mockResolvedValue(mockError)

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
      })

      await revokeOAuthToken(mockSecret, 'access-token-789')

      expect(mockGetFetchError).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: false,
          status: 400,
        })
      )
      expect(mockCaptureException).toHaveBeenCalledWith(mockError)
    })

    it('should capture exception when fetch throws', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        revokeUrl: 'https://provider.com/revoke',
      })

      const networkError = new Error('Network error')

      mockFetch.mockRejectedValue(networkError)

      await revokeOAuthToken(mockSecret, 'access-token-789')

      expect(mockCaptureException).toHaveBeenCalledWith(networkError)
    })

    it('should capture exception when getSecretOAuthConfig fails', async () => {
      const configError = new Error('Config not found')

      mockGetSecretOAuthConfig.mockRejectedValue(configError)

      await revokeOAuthToken(mockSecret, 'access-token-789')

      expect(mockCaptureException).toHaveBeenCalledWith(configError)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should not throw when exception is captured', async () => {
      mockGetSecretOAuthConfig.mockRejectedValue(new Error('Config error'))

      await expect(
        revokeOAuthToken(mockSecret, 'access-token-789')
      ).resolves.not.toThrow()
    })
  })

  describe('URL construction', () => {
    it('should construct URL with external API host', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        revokeUrl: '/oauth/revoke',
      })

      await revokeOAuthToken(mockSecret, 'token-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: 'https://api.example.com/oauth/revoke',
        }),
        expect.any(Object)
      )
    })

    it('should handle absolute revokeUrl', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        revokeUrl: 'https://other-provider.com/revoke',
      })

      await revokeOAuthToken(mockSecret, 'token-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: 'https://other-provider.com/revoke',
        }),
        expect.any(Object)
      )
    })
  })

  describe('request format', () => {
    it('should use POST method', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        revokeUrl: 'https://provider.com/revoke',
      })

      await revokeOAuthToken(mockSecret, 'token-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should use application/x-www-form-urlencoded content type', async () => {
      mockGetSecretOAuthConfig.mockResolvedValue({
        revokeUrl: 'https://provider.com/revoke',
      })

      await revokeOAuthToken(mockSecret, 'token-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      )
    })
  })
})
