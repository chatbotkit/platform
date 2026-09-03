/**
 * @jest-environment node
 */
import { mockDeep } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { call, getCallError, getPipedreamAccessToken } from '@/lib/call'

jest.mock('@/prisma/client', () => ({
  __esModule: true,

  default: mockDeep(),
}))

jest.mock('@/lib/cache')
jest.mock('@/lib/fetch')
jest.mock('@/lib/jwt')
jest.mock('@/lib/oauth.authorization')
jest.mock('@/lib/secret.oauth')

describe('call', () => {
  let mockFetch
  let mockTryVerify
  let mockTtlCache
  let mockPrisma
  let mockGetSecretOAuthConfig
  let mockGetClientCredentialsGrantCredentials

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup fetch mock
    mockFetch = jest.requireMock('@/lib/fetch').default
    mockFetch.mockResolvedValue(new Response('OK', { status: 200 }))

    // Setup JWT verification mock
    mockTryVerify = jest.requireMock('@/lib/jwt').tryVerify
    mockTryVerify.mockResolvedValue(null)

    // Setup cache mock
    mockTtlCache = jest.requireMock('@/lib/cache').ttlCache
    mockTtlCache.mockImplementation((key, ttl, fn) => fn())

    // Setup prisma mock
    mockPrisma = prisma

    // Setup OAuth mocks
    mockGetSecretOAuthConfig =
      jest.requireMock('@/lib/secret.oauth').getSecretOAuthConfig
    mockGetClientCredentialsGrantCredentials = jest.requireMock(
      '@/lib/oauth.authorization'
    ).getClientCredentialsGrantCredentials
  })

  describe('basic functionality', () => {
    it('should call fetch with the provided URL and options', async () => {
      const url = 'https://api.example.com/endpoint'
      const options = {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      }

      await call(url, options)

      expect(mockFetch).toHaveBeenCalledWith(url, options)
    })

    it('should work with URL object', async () => {
      const url = new URL('https://api.example.com/endpoint')

      await call(url)

      expect(mockFetch).toHaveBeenCalledWith(url, {})
    })

    it('should work without options parameter', async () => {
      const url = 'https://api.example.com/endpoint'

      await call(url)

      expect(mockFetch).toHaveBeenCalledWith(url, {})
    })

    it('should return the response from fetch', async () => {
      const mockResponse = new Response('Test Response', { status: 200 })

      mockFetch.mockResolvedValue(mockResponse)

      const result = await call('https://api.example.com/endpoint')

      expect(result).toBe(mockResponse)
    })
  })

  describe('authorization header handling', () => {
    it('should pass through when no authorization header exists', async () => {
      const url = 'https://api.example.com/endpoint'
      const options = {
        headers: {
          'content-type': 'application/json',
        },
      }

      await call(url, options)

      // @note when no authorization is present, options are passed through unchanged
      expect(mockFetch).toHaveBeenCalledWith(url, options)
    })

    it('should handle empty authorization header', async () => {
      const url = 'https://api.example.com/endpoint'
      const options = {
        headers: {
          authorization: '',
        },
      }

      await call(url, options)

      expect(mockTryVerify).not.toHaveBeenCalled()
    })

    it('should handle authorization header with no token', async () => {
      const url = 'https://api.example.com/endpoint'
      const options = {
        headers: {
          authorization: 'Bearer ',
        },
      }

      await call(url, options)

      expect(mockTryVerify).not.toHaveBeenCalled()
    })

    it('should handle authorization header with only type', async () => {
      const url = 'https://api.example.com/endpoint'
      const options = {
        headers: {
          authorization: 'Bearer',
        },
      }

      await call(url, options)

      expect(mockTryVerify).not.toHaveBeenCalled()
    })

    it('should attempt to verify token when authorization header exists', async () => {
      const url = 'https://api.example.com/endpoint'
      const token = 'valid.jwt.token'
      const options = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      }

      mockTryVerify.mockResolvedValue(null)

      await call(url, options)

      expect(mockTryVerify).toHaveBeenCalledWith(token)
    })

    it('should handle token verification failure gracefully', async () => {
      const url = 'https://api.example.com/endpoint'
      const options = {
        headers: {
          authorization: 'Bearer invalid.token',
        },
      }

      mockTryVerify.mockResolvedValue(null)

      await call(url, options)

      // @note when token verification fails, options are passed through unchanged
      expect(mockFetch).toHaveBeenCalledWith(url, options)
    })

    it('should handle token payload without type field', async () => {
      const url = 'https://api.example.com/endpoint'
      const options = {
        headers: {
          authorization: 'Bearer valid.token',
        },
      }

      mockTryVerify.mockResolvedValue({ someField: 'value' })

      await call(url, options)

      // @note when token has no type field, options are passed through unchanged
      expect(mockFetch).toHaveBeenCalledWith(url, options)
    })

    it('should handle token payload with unknown type', async () => {
      const url = 'https://api.example.com/endpoint'
      const options = {
        headers: {
          authorization: 'Bearer valid.token',
        },
      }

      mockTryVerify.mockResolvedValue({ type: 'unknown_type' })

      await call(url, options)

      // @note when token has unknown type, options are passed through unchanged
      expect(mockFetch).toHaveBeenCalledWith(url, options)
    })
  })

  describe('Pipedream proxy integration', () => {
    const setupPipedreamToken = (overrides = {}) => {
      return {
        type: 'pipedream_access_token',
        projectId: 'test-project-id',
        externalUserId: 'user-123',
        accountId: 'account-456',
        secretId: 'secret-789',
        environment: 'production',
        ...overrides,
      }
    }

    beforeEach(() => {
      // Setup successful OAuth flow for Pipedream
      mockPrisma.secret.findUnique = jest.fn().mockResolvedValue({
        id: 'secret-789',
        name: 'Test Secret',
      })

      mockGetSecretOAuthConfig.mockResolvedValue({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      })

      mockGetClientCredentialsGrantCredentials.mockResolvedValue({
        accessToken: 'pipedream-access-token',
      })
    })

    it('should transform URL to Pipedream proxy URL', async () => {
      const targetUrl = 'https://api.example.com/endpoint'
      const token = setupPipedreamToken()
      const options = {
        headers: {
          authorization: 'Bearer jwt.token',
        },
      }

      mockTryVerify.mockResolvedValue(token)

      await call(targetUrl, options)

      const calledUrl = mockFetch.mock.calls[0][0]

      expect(calledUrl.toString()).toContain('api.pipedream.com/v1/connect')
      expect(calledUrl.toString()).toContain(token.projectId)
      expect(calledUrl.toString()).toContain('external_user_id=user-123')
      expect(calledUrl.toString()).toContain('account_id=account-456')
    })

    it('should base64 encode the target URL in proxy path', async () => {
      const targetUrl = 'https://api.example.com/endpoint?param=value'
      const token = setupPipedreamToken()
      const options = {
        headers: {
          authorization: 'Bearer jwt.token',
        },
      }

      mockTryVerify.mockResolvedValue(token)

      await call(targetUrl, options)

      const calledUrl = mockFetch.mock.calls[0][0]

      // The URL should be base64 encoded in the path
      expect(calledUrl.toString()).toContain('/proxy/')
      expect(calledUrl.pathname).toContain('/proxy/')
    })

    it('should set Pipedream authorization header', async () => {
      const targetUrl = 'https://api.example.com/endpoint'
      const token = setupPipedreamToken()
      const options = {
        headers: {
          authorization: 'Bearer jwt.token',
        },
      }

      mockTryVerify.mockResolvedValue(token)

      await call(targetUrl, options)

      const calledHeaders = mockFetch.mock.calls[0][1].headers

      expect(calledHeaders.get('authorization')).toBe(
        'Bearer pipedream-access-token'
      )
    })

    it('should set x-pd-environment header', async () => {
      const targetUrl = 'https://api.example.com/endpoint'
      const token = setupPipedreamToken({ environment: 'staging' })
      const options = {
        headers: {
          authorization: 'Bearer jwt.token',
        },
      }

      mockTryVerify.mockResolvedValue(token)

      await call(targetUrl, options)

      const calledHeaders = mockFetch.mock.calls[0][1].headers

      expect(calledHeaders.get('x-pd-environment')).toBe('staging')
    })

    // @note this test highlights a potential bug where headers are prefixed but not removed
    it('should prefix non-authorization and non-x-pd headers with x-pd-proxy-', async () => {
      const targetUrl = 'https://api.example.com/endpoint'
      const token = setupPipedreamToken()
      const options = {
        headers: {
          authorization: 'Bearer jwt.token',
          'content-type': 'application/json',
          'x-custom-header': 'custom-value',
          'user-agent': 'test-agent',
        },
      }

      mockTryVerify.mockResolvedValue(token)

      await call(targetUrl, options)

      const calledHeaders = mockFetch.mock.calls[0][1].headers

      // These should be prefixed
      expect(calledHeaders.get('x-pd-proxy-content-type')).toBe(
        'application/json'
      )
      expect(calledHeaders.get('x-pd-proxy-x-custom-header')).toBe(
        'custom-value'
      )
      expect(calledHeaders.get('x-pd-proxy-user-agent')).toBe('test-agent')

      // Authorization should be replaced, not prefixed
      expect(calledHeaders.get('authorization')).toBe(
        'Bearer pipedream-access-token'
      )
      expect(calledHeaders.has('x-pd-proxy-authorization')).toBe(false)
    })

    it('should remove original headers after prefixing them', async () => {
      const targetUrl = 'https://api.example.com/endpoint'
      const token = setupPipedreamToken()
      const options = {
        headers: {
          authorization: 'Bearer jwt.token',
          'content-type': 'application/json',
          'x-custom-header': 'custom-value',
        },
      }

      mockTryVerify.mockResolvedValue(token)

      await call(targetUrl, options)

      const calledHeaders = mockFetch.mock.calls[0][1].headers

      // Original headers should be removed (except x-pd-* and authorization)
      expect(calledHeaders.has('content-type')).toBe(false)
      expect(calledHeaders.has('x-custom-header')).toBe(false)

      // Only prefixed versions should exist
      expect(calledHeaders.has('x-pd-proxy-content-type')).toBe(true)
      expect(calledHeaders.has('x-pd-proxy-x-custom-header')).toBe(true)
    })

    it('should not prefix x-pd-* headers', async () => {
      const targetUrl = 'https://api.example.com/endpoint'
      const token = setupPipedreamToken()
      const options = {
        headers: {
          authorization: 'Bearer jwt.token',
          'x-pd-custom': 'value',
          'x-pd-another': 'value2',
        },
      }

      mockTryVerify.mockResolvedValue(token)

      await call(targetUrl, options)

      const calledHeaders = mockFetch.mock.calls[0][1].headers

      // x-pd-* headers should not be prefixed
      expect(calledHeaders.has('x-pd-proxy-x-pd-custom')).toBe(false)
      expect(calledHeaders.has('x-pd-proxy-x-pd-another')).toBe(false)

      // They should remain as-is
      expect(calledHeaders.get('x-pd-custom')).toBe('value')
      expect(calledHeaders.get('x-pd-another')).toBe('value2')
    })

    it('should handle URL objects for target URL', async () => {
      const targetUrl = new URL('https://api.example.com/endpoint?test=123')
      const token = setupPipedreamToken()
      const options = {
        headers: {
          authorization: 'Bearer jwt.token',
        },
      }

      mockTryVerify.mockResolvedValue(token)

      await call(targetUrl, options)

      const calledUrl = mockFetch.mock.calls[0][0]

      expect(calledUrl.toString()).toContain('api.pipedream.com/v1/connect')
    })

    describe('relative path handling for PIPEDREAM_RELATIVE_APPS', () => {
      // @note PIPEDREAM_RELATIVE_APPS = ['.zendesk.com', '.gitlab.com', '.zoho.com']
      // These apps require relative URLs instead of absolute URLs

      it('should use relative URL when host ends with .zendesk.com', async () => {
        const targetUrl = 'https://mycompany.zendesk.com/api/v2/tickets'
        const token = setupPipedreamToken()
        const options = {
          headers: {
            authorization: 'Bearer jwt.token',
          },
        }

        mockTryVerify.mockResolvedValue(token)

        await call(targetUrl, options)

        const calledUrl = mockFetch.mock.calls[0][0]
        const pathname = calledUrl.pathname

        // The destination in the proxy path should be base64 encoded relative path
        // not the full absolute URL
        expect(pathname).toContain('/proxy/')

        // Extract the base64 encoded destination from the path
        const proxyPathMatch = pathname.match(/\/proxy\/(.+)$/)

        expect(proxyPathMatch).toBeTruthy()

        // Decode the destination - it should be relative (starting with /)
        const encodedDestination = proxyPathMatch[1]
        const decodedDestination = atob(
          encodedDestination.replace(/-/g, '+').replace(/_/g, '/')
        )

        expect(decodedDestination).toBe('/api/v2/tickets')
        expect(decodedDestination).not.toContain('https://')
        expect(decodedDestination).not.toContain('zendesk.com')
      })

      it('should use relative URL when host ends with .gitlab.com', async () => {
        const targetUrl = 'https://mycompany.gitlab.com/api/v4/projects?page=1'
        const token = setupPipedreamToken()
        const options = {
          headers: {
            authorization: 'Bearer jwt.token',
          },
        }

        mockTryVerify.mockResolvedValue(token)

        await call(targetUrl, options)

        const calledUrl = mockFetch.mock.calls[0][0]
        const pathname = calledUrl.pathname
        const proxyPathMatch = pathname.match(/\/proxy\/(.+)$/)

        expect(proxyPathMatch).toBeTruthy()

        const encodedDestination = proxyPathMatch[1]
        const decodedDestination = atob(
          encodedDestination.replace(/-/g, '+').replace(/_/g, '/')
        )

        expect(decodedDestination).toBe('/api/v4/projects?page=1')
        expect(decodedDestination).not.toContain('https://')
      })

      it('should use relative URL when host ends with .zoho.com', async () => {
        const targetUrl = 'https://crm.zoho.com/crm/v2/Leads'
        const token = setupPipedreamToken()
        const options = {
          headers: {
            authorization: 'Bearer jwt.token',
          },
        }

        mockTryVerify.mockResolvedValue(token)

        await call(targetUrl, options)

        const calledUrl = mockFetch.mock.calls[0][0]
        const pathname = calledUrl.pathname
        const proxyPathMatch = pathname.match(/\/proxy\/(.+)$/)

        expect(proxyPathMatch).toBeTruthy()

        const encodedDestination = proxyPathMatch[1]
        const decodedDestination = atob(
          encodedDestination.replace(/-/g, '+').replace(/_/g, '/')
        )

        expect(decodedDestination).toBe('/crm/v2/Leads')
        expect(decodedDestination).not.toContain('https://')
      })

      it('should use absolute URL for non-relative apps', async () => {
        const targetUrl = 'https://api.example.com/endpoint?foo=bar'
        const token = setupPipedreamToken()
        const options = {
          headers: {
            authorization: 'Bearer jwt.token',
          },
        }

        mockTryVerify.mockResolvedValue(token)

        await call(targetUrl, options)

        const calledUrl = mockFetch.mock.calls[0][0]
        const pathname = calledUrl.pathname
        const proxyPathMatch = pathname.match(/\/proxy\/(.+)$/)

        expect(proxyPathMatch).toBeTruthy()

        const encodedDestination = proxyPathMatch[1]
        const decodedDestination = atob(
          encodedDestination.replace(/-/g, '+').replace(/_/g, '/')
        )

        // For non-relative apps, the full URL should be encoded
        expect(decodedDestination).toBe(
          'https://api.example.com/endpoint?foo=bar'
        )
      })

      it('should preserve query string in relative URL', async () => {
        const targetUrl =
          'https://mycompany.zendesk.com/api/v2/tickets?page=2&per_page=100'
        const token = setupPipedreamToken()
        const options = {
          headers: {
            authorization: 'Bearer jwt.token',
          },
        }

        mockTryVerify.mockResolvedValue(token)

        await call(targetUrl, options)

        const calledUrl = mockFetch.mock.calls[0][0]
        const pathname = calledUrl.pathname
        const proxyPathMatch = pathname.match(/\/proxy\/(.+)$/)

        expect(proxyPathMatch).toBeTruthy()

        const encodedDestination = proxyPathMatch[1]
        const decodedDestination = atob(
          encodedDestination.replace(/-/g, '+').replace(/_/g, '/')
        )

        expect(decodedDestination).toBe('/api/v2/tickets?page=2&per_page=100')
      })

      it('should not match partial domain names (e.g., myzendesk.com)', async () => {
        const targetUrl = 'https://myzendesk.com/api/endpoint'
        const token = setupPipedreamToken()
        const options = {
          headers: {
            authorization: 'Bearer jwt.token',
          },
        }

        mockTryVerify.mockResolvedValue(token)

        await call(targetUrl, options)

        const calledUrl = mockFetch.mock.calls[0][0]
        const pathname = calledUrl.pathname
        const proxyPathMatch = pathname.match(/\/proxy\/(.+)$/)

        expect(proxyPathMatch).toBeTruthy()

        const encodedDestination = proxyPathMatch[1]
        const decodedDestination = atob(
          encodedDestination.replace(/-/g, '+').replace(/_/g, '/')
        )

        // Should use absolute URL since myzendesk.com doesn't end with .zendesk.com
        expect(decodedDestination).toBe('https://myzendesk.com/api/endpoint')
      })
    })

    it('should use cached access token', async () => {
      const targetUrl = 'https://api.example.com/endpoint'
      const token = setupPipedreamToken()
      const options = {
        headers: {
          authorization: 'Bearer jwt.token',
        },
      }

      mockTryVerify.mockResolvedValue(token)
      mockTtlCache.mockImplementation((key, _ttl, _fn) => {
        expect(key).toBe('pipedream_access_token:secret-789')

        return Promise.resolve('cached-token')
      })

      await call(targetUrl, options)

      const calledHeaders = mockFetch.mock.calls[0][1].headers

      expect(calledHeaders.get('authorization')).toBe('Bearer cached-token')
    })
  })

  describe('getPipedreamAccessToken', () => {
    beforeEach(() => {
      mockPrisma.secret.findUnique = jest.fn().mockResolvedValue({
        id: 'secret-123',
        name: 'Test Secret',
      })

      mockGetSecretOAuthConfig.mockResolvedValue({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      })

      mockGetClientCredentialsGrantCredentials.mockResolvedValue({
        accessToken: 'test-access-token',
      })

      // Reset ttlCache to use actual implementation
      mockTtlCache.mockImplementation((key, ttl, fn) => fn())
    })

    it('should fetch access token from OAuth flow', async () => {
      const secretId = 'secret-123'

      const result = await getPipedreamAccessToken(secretId)

      expect(result).toBe('test-access-token')
      expect(mockPrisma.secret.findUnique).toHaveBeenCalledWith({
        where: { id: secretId },
      })
    })

    it('should throw error when secret not found', async () => {
      const secretId = 'non-existent-secret'

      mockPrisma.secret.findUnique.mockResolvedValue(null)

      await expect(getPipedreamAccessToken(secretId)).rejects.toThrow(
        'Secret not found'
      )
    })

    it('should throw error when OAuth config is invalid', async () => {
      const secretId = 'secret-123'

      mockGetSecretOAuthConfig.mockResolvedValue({
        clientId: null,
        clientSecret: null,
      })

      await expect(getPipedreamAccessToken(secretId)).rejects.toThrow(
        'Invalid OAuth configuration for secret'
      )
    })

    it('should throw error when clientId is missing', async () => {
      const secretId = 'secret-123'

      mockGetSecretOAuthConfig.mockResolvedValue({
        clientId: null,
        clientSecret: 'secret',
      })

      await expect(getPipedreamAccessToken(secretId)).rejects.toThrow(
        'Invalid OAuth configuration for secret'
      )
    })

    it('should throw error when clientSecret is missing', async () => {
      const secretId = 'secret-123'

      mockGetSecretOAuthConfig.mockResolvedValue({
        clientId: 'client-id',
        clientSecret: null,
      })

      await expect(getPipedreamAccessToken(secretId)).rejects.toThrow(
        'Invalid OAuth configuration for secret'
      )
    })

    it('should call getClientCredentialsGrantCredentials with correct parameters', async () => {
      const secretId = 'secret-123'

      await getPipedreamAccessToken(secretId)

      expect(mockGetClientCredentialsGrantCredentials).toHaveBeenCalledWith({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: 'https://api.pipedream.com/v1/oauth/token',
      })
    })

    it('should use ttlCache with correct parameters', async () => {
      const secretId = 'secret-123'

      mockTtlCache.mockImplementation((key, ttl, fn) => {
        expect(key).toBe('pipedream_access_token:secret-123')
        expect(ttl).toBe(900) // QUARTER_HOUR_IN_SECONDS = 900

        return fn()
      })

      await getPipedreamAccessToken(secretId)

      expect(mockTtlCache).toHaveBeenCalled()
    })
  })

  describe('getCallError', () => {
    it('should export getCallError function', () => {
      expect(getCallError).toBeDefined()
      expect(typeof getCallError).toBe('function')
    })
  })

  describe('edge cases', () => {
    it('should handle options without headers', async () => {
      const url = 'https://api.example.com/endpoint'
      const options = {
        method: 'GET',
      }

      await call(url, options)

      expect(mockFetch).toHaveBeenCalledWith(url, options)
    })

    it('should handle Headers object in options', async () => {
      const url = 'https://api.example.com/endpoint'
      const headers = new Headers()

      headers.set('content-type', 'application/json')

      const options = {
        headers,
      }

      await call(url, options)

      // @note when no authorization is present, options are passed through unchanged
      expect(mockFetch).toHaveBeenCalledWith(url, options)
    })

    it('should handle array of headers in options', async () => {
      const url = 'https://api.example.com/endpoint'
      const options = {
        headers: [
          ['content-type', 'application/json'],
          ['accept', 'application/json'],
        ],
      }

      await call(url, options)

      // @note when no authorization is present, options are passed through unchanged
      expect(mockFetch).toHaveBeenCalledWith(url, options)
    })

    it('should not modify original options object', async () => {
      const url = 'https://api.example.com/endpoint'
      const originalOptions = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      }

      await call(url, originalOptions)

      // Original options should remain unchanged
      expect(originalOptions.headers).toEqual({
        'content-type': 'application/json',
      })
    })
  })
})
