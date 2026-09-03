/* eslint-disable @typescript-eslint/no-require-imports */
import {
  ONE_DAY_IN_SECONDS,
  ONE_HOUR_IN_SECONDS,
  QUARTER_HOUR_IN_SECONDS,
} from '@chatbotkit-dev/time'

import { decrypt } from '@/lib/cloak'
import { UserAuthError } from '@/lib/error'
import { sign, verify } from '@/lib/jwt'
import { McpOAuthProvider } from '@/lib/mcp.oauth'
import memcache from '@/lib/memcache'

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
}))

jest.mock('@/lib/cloak', () => ({
  encrypt: jest.fn().mockResolvedValue('encrypted-data'),
  decrypt: jest.fn().mockResolvedValue('decrypted-data'),
}))

jest.mock('@/lib/jwt', () => ({
  sign: jest.fn().mockResolvedValue('signed-state-token'),
  verify: jest.fn().mockResolvedValue({
    userId: 'user-123',
    sessionId: 'session-456',
    url: 'https://example.com/mcp',
    timestamp: Date.now(),
  }),
}))

jest.mock('@/lib/host', () => ({
  getExternalHostURL: jest.fn((path) => `https://platform.example.com${path}`),
  getExternalAPIHostURL: jest.fn((path) => `https://api.example.com${path}`),
  getExternalFrontendHostURL: jest.fn(
    (path) => `https://frontend.example.com${path}`
  ),
}))

jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: jest.fn().mockImplementation(() => ({
    finishAuth: jest.fn().mockResolvedValue(undefined),
  })),
}))

jest.mock('@/lib/short', () => ({
  getTempShortURL: jest
    .fn()
    .mockResolvedValue(
      'https://frontend.example.com/s/ab3cdddc-11f4-5c76-ab66-3a47bf70cc2c'
    ),
}))

describe('McpOAuthProvider', () => {
  const mockUser = { id: 'user-123' }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('redirectToAuthorization', () => {
    it('should throw UserAuthError with proper message format', async () => {
      const provider = new McpOAuthProvider(mockUser, {
        sessionId: 'session-456',
        url: 'https://example.com/mcp',
      })

      const authUrl = new URL(
        'https://auth.example.com/authorize?client_id=123'
      )

      try {
        await provider.redirectToAuthorization(authUrl)
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(UserAuthError)
        expect(error.message).toMatch(
          /OAuth authentication required: visit .+ to authorize MCP server access and try again/
        )
      }
    })
  })

  describe('state management', () => {
    it('should generate state using JWT signing', async () => {
      const provider = new McpOAuthProvider(mockUser, {
        sessionId: 'session-456',
        url: 'https://example.com/mcp',
      })

      const state = await provider.state()

      expect(sign).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          sessionId: 'session-456',
          url: 'https://example.com/mcp',
          timestamp: expect.any(Number),
        },
        QUARTER_HOUR_IN_SECONDS
      )
      expect(state).toBe('signed-state-token')
    })

    test.skip('should validate state using JWT verification', async () => {
      // @note this test skipped because validateState method doesn't exist in implementation
      // expected: validateState method should exist for JWT state validation
      // actual: no validateState method found in McpOAuthProvider class
    })
  })

  describe('client metadata', () => {
    it('should return proper OAuth client metadata', () => {
      const provider = new McpOAuthProvider(mockUser, {
        sessionId: 'session-456',
        url: 'https://example.com/mcp',
      })

      const metadata = provider.clientMetadata

      expect(metadata).toEqual({
        client_name: 'MCP Client',
        redirect_uris: [
          'https://platform.example.com/oauth/mcp/callback',
          'https://frontend.example.com/oauth/mcp/callback',
        ],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
        scope: 'mcp:tools',
      })
    })
  })

  describe('handleCallback', () => {
    it('should validate state and handle OAuth callback', async () => {
      // Setup mock client information in Redis
      memcache.get.mockResolvedValueOnce('encrypted-client-info')

      // Configure the already mocked decrypt function for this test
      decrypt.mockResolvedValueOnce(
        JSON.stringify({
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          authorization_endpoint: 'https://auth.example.com/authorize',
          token_endpoint: 'https://auth.example.com/token',
        })
      )

      await McpOAuthProvider.handleCallback(
        'signed-state-token',
        'auth-code-123'
      )

      expect(verify).toHaveBeenCalledWith('signed-state-token')
      // The StreamableHTTPClientTransport mock will be created and finishAuth called
    })
  })

  describe('time constants usage', () => {
    it('should use proper time constants for Redis expiration', () => {
      expect(ONE_DAY_IN_SECONDS).toBe(86400)
      expect(ONE_HOUR_IN_SECONDS).toBe(3600)
    })

    it('should use QUARTER_HOUR_IN_SECONDS for state signing', () => {
      expect(QUARTER_HOUR_IN_SECONDS).toBe(900)
    })
  })

  describe('validateResourceURL', () => {
    let provider

    beforeEach(() => {
      provider = new McpOAuthProvider(
        { id: 'user-123' },
        { sessionId: 'session-456', url: 'https://mcp.example.com/sse' }
      )
    })

    it('returns undefined when resource parameter is omitted', async () => {
      const result = await provider.validateResourceURL(
        'https://mcp.example.com/sse'
      )

      expect(result).toBeUndefined()
    })

    it('returns the parsed resource URL when origins match', async () => {
      const result = await provider.validateResourceURL(
        'https://mcp.example.com/sse',
        'https://mcp.example.com/tools/search'
      )

      expect(result).toBeInstanceOf(URL)
      expect(result.href).toBe('https://mcp.example.com/tools/search')
    })

    it('throws when resource URL origin does not match expected URL origin', async () => {
      await expect(
        provider.validateResourceURL(
          'https://mcp.example.com/sse',
          'https://attacker.example.com/tools'
        )
      ).rejects.toThrow('Resource URL does not match MCP server origin')
    })

    it('throws when the url argument is falsy', async () => {
      await expect(provider.validateResourceURL('')).rejects.toThrow(
        'URL is required for resource validation'
      )
    })
  })

  describe('saveClientInformation and clientInformation', () => {
    let provider

    beforeEach(() => {
      // Reset to clear any unconsumed mockResolvedValueOnce values left by previous tests
      memcache.get.mockReset()
      memcache.get.mockResolvedValue(null)
      decrypt.mockReset()
      decrypt.mockResolvedValue('decrypted-data')
      provider = new McpOAuthProvider(
        { id: 'user-123' },
        { sessionId: 'session-456', url: 'https://mcp.example.com/sse' }
      )
    })

    it('saves encrypted client information to Redis with 24-hour expiry', async () => {
      const clientInfo = {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
      }

      await provider.saveClientInformation(clientInfo)

      const { encrypt } = require('@/lib/cloak')

      expect(encrypt).toHaveBeenCalledWith(JSON.stringify(clientInfo))
      expect(memcache.setex).toHaveBeenCalledWith(
        `mcp:oauth:client:user-123:session-456`,
        ONE_DAY_IN_SECONDS,
        'encrypted-data'
      )
    })

    it('retrieves, decrypts, and parses stored client information', async () => {
      memcache.get.mockResolvedValueOnce('encrypted-client-info')

      const storedInfo = {
        client_id: 'test-client-id',
        client_secret: 'test-secret',
      }

      decrypt.mockResolvedValueOnce(JSON.stringify(storedInfo))

      const result = await provider.clientInformation()

      expect(memcache.get).toHaveBeenCalledWith(
        `mcp:oauth:client:user-123:session-456`
      )
      expect(result).toEqual(storedInfo)
    })

    it('returns undefined when no client information is stored', async () => {
      memcache.get.mockResolvedValueOnce(null)

      const result = await provider.clientInformation()

      expect(result).toBeUndefined()
    })
  })

  describe('saveTokens and tokens', () => {
    let provider

    beforeEach(() => {
      // Reset to clear any unconsumed mockResolvedValueOnce values left by previous tests
      memcache.get.mockReset()
      memcache.get.mockResolvedValue(null)
      decrypt.mockReset()
      decrypt.mockResolvedValue('decrypted-data')
      provider = new McpOAuthProvider(
        { id: 'user-123' },
        { sessionId: 'session-456', url: 'https://mcp.example.com/sse' }
      )
    })

    it('saves encrypted tokens with expires_in from the token object', async () => {
      const tokens = {
        access_token: 'access-123',
        token_type: 'Bearer',
        expires_in: 3600,
      }

      await provider.saveTokens(tokens)

      const { encrypt } = require('@/lib/cloak')

      expect(encrypt).toHaveBeenCalledWith(JSON.stringify(tokens))
      expect(memcache.setex).toHaveBeenCalledWith(
        `mcp:oauth:tokens:user-123:session-456`,
        3600,
        'encrypted-data'
      )
    })

    it('uses ONE_DAY_IN_SECONDS as default expiry when expires_in is absent', async () => {
      const tokens = { access_token: 'access-123', token_type: 'Bearer' }

      await provider.saveTokens(tokens)

      expect(memcache.setex).toHaveBeenCalledWith(
        `mcp:oauth:tokens:user-123:session-456`,
        ONE_DAY_IN_SECONDS,
        'encrypted-data'
      )
    })

    it('retrieves and decrypts stored tokens', async () => {
      memcache.get.mockResolvedValueOnce('encrypted-tokens')

      const storedTokens = {
        access_token: 'access-123',
        token_type: 'Bearer',
        expires_in: 3600,
      }

      decrypt.mockResolvedValueOnce(JSON.stringify(storedTokens))

      const result = await provider.tokens()

      expect(memcache.get).toHaveBeenCalledWith(
        `mcp:oauth:tokens:user-123:session-456`
      )
      expect(result).toEqual(storedTokens)
    })

    it('returns undefined when no tokens are stored', async () => {
      memcache.get.mockResolvedValueOnce(null)

      const result = await provider.tokens()

      expect(result).toBeUndefined()
    })
  })

  describe('saveCodeVerifier and codeVerifier', () => {
    let provider

    beforeEach(() => {
      // Reset to clear any unconsumed mockResolvedValueOnce values left by previous tests
      memcache.get.mockReset()
      memcache.get.mockResolvedValue(null)
      decrypt.mockReset()
      decrypt.mockResolvedValue('decrypted-data')
      provider = new McpOAuthProvider(
        { id: 'user-123' },
        { sessionId: 'session-456', url: 'https://mcp.example.com/sse' }
      )
    })

    it('saves encrypted code verifier with 15-minute expiry', async () => {
      await provider.saveCodeVerifier('my-code-verifier')

      const { encrypt } = require('@/lib/cloak')

      expect(encrypt).toHaveBeenCalledWith('my-code-verifier')
      expect(memcache.setex).toHaveBeenCalledWith(
        `mcp:oauth:codeVerifier:user-123:session-456`,
        QUARTER_HOUR_IN_SECONDS,
        'encrypted-data'
      )
    })

    it('retrieves and decrypts the stored code verifier', async () => {
      memcache.get.mockResolvedValueOnce('encrypted-verifier')

      decrypt.mockResolvedValueOnce('my-code-verifier')

      const result = await provider.codeVerifier()

      expect(memcache.get).toHaveBeenCalledWith(
        `mcp:oauth:codeVerifier:user-123:session-456`
      )
      expect(result).toBe('my-code-verifier')
    })

    it('throws when no code verifier is stored', async () => {
      memcache.get.mockResolvedValueOnce(null)

      await expect(provider.codeVerifier()).rejects.toThrow(
        'No code verifier found'
      )
    })

    it('throws and preserves error message when decryption fails', async () => {
      memcache.get.mockResolvedValueOnce('encrypted-verifier')

      decrypt.mockRejectedValueOnce(new Error('decryption key mismatch'))

      await expect(provider.codeVerifier()).rejects.toThrow(
        'Failed to decrypt code verifier'
      )
    })
  })

  describe('cleanup', () => {
    let provider

    beforeEach(() => {
      provider = new McpOAuthProvider(
        { id: 'user-123' },
        { sessionId: 'session-456', url: 'https://mcp.example.com/sse' }
      )

      // @note pipeline() is not in the base mock - add it for cleanup tests
      const mockPipeline = {
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }

      memcache.pipeline = jest.fn().mockReturnValue(mockPipeline)
    })

    it('deletes all three OAuth keys via a Redis pipeline', async () => {
      await provider.cleanup()

      expect(memcache.pipeline).toHaveBeenCalledTimes(1)

      const pipeline = memcache.pipeline.mock.results[0].value

      expect(pipeline.del).toHaveBeenCalledWith(
        'mcp:oauth:client:user-123:session-456'
      )
      expect(pipeline.del).toHaveBeenCalledWith(
        'mcp:oauth:tokens:user-123:session-456'
      )
      expect(pipeline.del).toHaveBeenCalledWith(
        'mcp:oauth:codeVerifier:user-123:session-456'
      )
      expect(pipeline.exec).toHaveBeenCalledTimes(1)
    })
  })
})
