import * as jwt from '@/lib/jwt'
import memcache from '@/lib/memcache'
import { sha256 } from '@/lib/webcrypto'

import {
  ALLOWED_SCOPES,
  REFRESH_TOKEN_PREFIX,
  deleteAuthorizationRequest,
  deleteRefreshToken,
  generateRefreshToken,
  hasScope,
  isRefreshToken,
  isTokenRevoked,
  retrieveAuthorizationRequest,
  retrieveRefreshToken,
  revokeRefreshToken,
  revokeToken,
  rotateRefreshToken,
  signOAuthToken,
  storeAuthorizationRequest,
  storeTokenMetadata,
  validateClientId,
  validateRedirectUri,
  validateRefreshToken,
  validateScopes,
  verifyOAuthToken,
} from './oauth.jwt'

jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getdel: jest.fn(),
    ttl: jest.fn(),
  },
}))

jest.mock('@/lib/jwt', () => ({
  __esModule: true,
  sign: jest.fn(),
  tryVerify: jest.fn(),
}))

describe('oauth.jwt', () => {
  describe('validateRedirectUri', () => {
    it('should accept https URLs', () => {
      expect(validateRedirectUri('https://example.com/callback')).toBe(true)
      expect(validateRedirectUri('https://app.example.com:8443/oauth')).toBe(
        true
      )
    })

    it('should accept http://localhost URLs', () => {
      expect(validateRedirectUri('http://localhost/callback')).toBe(true)
      expect(validateRedirectUri('http://localhost:3000/auth')).toBe(true)
      expect(validateRedirectUri('http://127.0.0.1/callback')).toBe(true)
      expect(validateRedirectUri('http://127.0.0.1:8080/oauth')).toBe(true)
    })

    it('should reject http URLs for non-localhost', () => {
      expect(validateRedirectUri('http://example.com/callback')).toBe(false)
      expect(validateRedirectUri('http://192.168.1.1/callback')).toBe(false)
    })

    it('should reject URLs with fragments', () => {
      expect(validateRedirectUri('https://example.com/callback#fragment')).toBe(
        false
      )
      expect(validateRedirectUri('http://localhost/callback#test')).toBe(false)
    })

    it('should reject invalid URLs', () => {
      expect(validateRedirectUri('not-a-url')).toBe(false)
      expect(validateRedirectUri('')).toBe(false)
      expect(validateRedirectUri('javascript:alert(1)')).toBe(false)
    })

    it('should reject other protocols', () => {
      expect(validateRedirectUri('ftp://example.com/callback')).toBe(false)
      expect(validateRedirectUri('file:///etc/passwd')).toBe(false)
    })
  })

  describe('validateClientId', () => {
    it('should accept non-empty strings', () => {
      expect(validateClientId('my-client-id')).toBe(true)
      expect(validateClientId('client123')).toBe(true)
      expect(validateClientId('a')).toBe(true)
    })

    it('should reject empty or whitespace-only strings', () => {
      expect(validateClientId('')).toBe(false)
      expect(validateClientId('   ')).toBe(false)
      expect(validateClientId('\t\n')).toBe(false)
    })

    it('should reject non-string values', () => {
      expect(validateClientId(null)).toBe(false)
      expect(validateClientId(undefined)).toBe(false)
      expect(validateClientId(123)).toBe(false)
    })
  })

  describe('validateScopes', () => {
    it('should return default scopes when no scope requested', () => {
      expect(validateScopes(null)).toEqual([...ALLOWED_SCOPES])
      expect(validateScopes(undefined)).toEqual([...ALLOWED_SCOPES])
      expect(validateScopes('')).toEqual([...ALLOWED_SCOPES])
    })

    it('should accept valid scopes', () => {
      expect(validateScopes('mcp:tools')).toEqual(['mcp:tools'])
      expect(validateScopes('mcp:resources')).toEqual(['mcp:resources'])
      expect(validateScopes('mcp:tools mcp:resources')).toEqual([
        'mcp:tools',
        'mcp:resources',
      ])
    })

    it('should reject invalid scopes', () => {
      expect(validateScopes('invalid:scope')).toBeNull()
      expect(validateScopes('mcp:tools invalid:scope')).toBeNull()
      expect(validateScopes('admin')).toBeNull()
    })

    it('should handle whitespace', () => {
      expect(validateScopes('  mcp:tools  ')).toEqual(['mcp:tools'])
      expect(validateScopes('mcp:tools   mcp:resources')).toEqual([
        'mcp:tools',
        'mcp:resources',
      ])
    })

    it('should return default scopes for empty string after trimming', () => {
      expect(validateScopes('   ')).toEqual([...ALLOWED_SCOPES])
    })
  })

  describe('hasScope', () => {
    it('should return true when scope is present', () => {
      expect(hasScope('mcp:tools', 'mcp:tools')).toBe(true)
      expect(hasScope('mcp:tools mcp:resources', 'mcp:tools')).toBe(true)
      expect(hasScope('mcp:tools mcp:resources', 'mcp:resources')).toBe(true)
    })

    it('should return false when scope is absent', () => {
      expect(hasScope('mcp:tools', 'mcp:resources')).toBe(false)
      expect(hasScope('mcp:resources', 'mcp:tools')).toBe(false)
      expect(hasScope('', 'mcp:tools')).toBe(false)
    })

    it('should handle single scope', () => {
      expect(hasScope('mcp:tools', 'mcp:tools')).toBe(true)
    })
  })

  describe('Authorization Request Management', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should store authorization request in Redis', async () => {
      const request = {
        code: 'auth_code_123',
        clientId: 'client_abc',
        redirectUri: 'https://example.com/callback',
        codeChallenge: 'challenge_xyz',
        codeChallengeMethod: 'S256',
        scope: 'mcp:tools mcp:resources',
        portalId: 'portal_1',
        portalUserId: 'portal_user_1',
        userId: 'user_1',
        contactId: 'contact_1',
        createdAt: Date.now(),
      }

      memcache.set.mockResolvedValue('OK')

      await storeAuthorizationRequest(request, 600)

      expect(memcache.set).toHaveBeenCalledWith(
        'apps:oauth:authcode:auth_code_123',
        JSON.stringify(request),
        { ex: 600 }
      )
    })

    it('should retrieve authorization request from Redis', async () => {
      const request = {
        code: 'auth_code_456',
        clientId: 'client_def',
        redirectUri: 'https://example.com/callback',
        codeChallenge: 'challenge_abc',
        codeChallengeMethod: 'S256',
        scope: 'mcp:tools',
        portalId: 'portal_2',
        portalUserId: 'portal_user_2',
        userId: 'user_2',
        contactId: 'contact_2',
        createdAt: Date.now(),
      }

      memcache.get.mockResolvedValue(JSON.stringify(request))

      const retrieved = await retrieveAuthorizationRequest('auth_code_456')

      expect(memcache.get).toHaveBeenCalledWith(
        'apps:oauth:authcode:auth_code_456'
      )
      expect(retrieved).toEqual(request)
    })

    it('should return null when authorization request not found', async () => {
      memcache.get.mockResolvedValue(null)

      const retrieved = await retrieveAuthorizationRequest('nonexistent_code')

      expect(retrieved).toBeNull()
    })

    it('should delete authorization request from Redis', async () => {
      memcache.del.mockResolvedValue(1)

      await deleteAuthorizationRequest('auth_code_789')

      expect(memcache.del).toHaveBeenCalledWith(
        'apps:oauth:authcode:auth_code_789'
      )
    })

    it('should handle Redis objects in addition to strings', async () => {
      const request = {
        code: 'auth_code_obj',
        clientId: 'client_obj',
        redirectUri: 'https://example.com/callback',
        codeChallenge: 'challenge_obj',
        codeChallengeMethod: 'S256',
        scope: 'mcp:resources',
        portalId: 'portal_3',
        portalUserId: 'portal_user_3',
        userId: 'user_3',
        contactId: 'contact_3',
        createdAt: Date.now(),
      }

      // @note Redis might return parsed object instead of string
      memcache.get.mockResolvedValue(request)

      const retrieved = await retrieveAuthorizationRequest('auth_code_obj')

      expect(retrieved).toEqual(request)
    })
  })

  describe('Token Management', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should sign OAuth token with correct claims', async () => {
      const claims = {
        sub: 'user_123',
        portalId: 'portal_abc',
        portalUserId: 'portal_user_abc',
        contactId: 'contact_abc',
        scope: 'mcp:tools mcp:resources',
      }

      jwt.sign.mockResolvedValue('mocked_jwt_token')

      const token = await signOAuthToken(claims, 3600)

      expect(jwt.sign).toHaveBeenCalledWith(claims, 3600, 'mcp')
      expect(token).toBe('mocked_jwt_token')
    })

    it('should verify valid OAuth token', async () => {
      const payload = {
        sub: 'user_456',
        portalId: 'portal_def',
        portalUserId: 'portal_user_def',
        contactId: 'contact_def',
        scope: 'mcp:tools',
        aud: 'mcp',
      }

      jwt.tryVerify.mockResolvedValue(payload)

      const verified = await verifyOAuthToken('valid_jwt_token')

      expect(jwt.tryVerify).toHaveBeenCalledWith('valid_jwt_token')
      expect(verified).toEqual(payload)
    })

    it('should reject token with wrong audience', async () => {
      const payload = {
        sub: 'user_789',
        portalId: 'portal_ghi',
        portalUserId: 'portal_user_ghi',
        contactId: 'contact_ghi',
        scope: 'mcp:resources',
        aud: 'wrong_audience',
      }

      jwt.tryVerify.mockResolvedValue(payload)

      const verified = await verifyOAuthToken('invalid_aud_token')

      expect(verified).toBeNull()
    })

    it('should return null for invalid token', async () => {
      jwt.tryVerify.mockResolvedValue(null)

      const verified = await verifyOAuthToken('invalid_token')

      expect(verified).toBeNull()
    })
  })

  describe('Token Metadata', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should store token metadata in Redis', async () => {
      const accessToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature'
      const metadata = {
        portalId: 'portal_xyz',
        userId: 'user_xyz',
        scope: 'mcp:tools mcp:resources',
        createdAt: Date.now(),
      }

      memcache.set.mockResolvedValue('OK')

      await storeTokenMetadata(accessToken, metadata, 3600)

      // @note keyed by a digest of the whole token, never by a prefix (the
      // first 16 characters of every JWT this platform signs are the same
      // encoded JOSE header) and never by raw bearer material
      const digest = await sha256(accessToken)

      expect(memcache.set).toHaveBeenCalledWith(
        `apps:oauth:token:${digest}`,
        JSON.stringify(metadata),
        { ex: 3600 }
      )
      expect(memcache.set.mock.calls[0][0]).not.toContain('eyJhbGciOiJIUzI1')
    })

    it('keys each token separately even when they share the JOSE header', async () => {
      const header = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      const tokenA = `${header}.userA.sigA`
      const tokenB = `${header}.userB.sigB`
      const forged = `${header}.forged.sig`

      memcache.set.mockResolvedValue('OK')

      await storeTokenMetadata(tokenA, { portalId: 'a', userId: 'ua', scope: '', createdAt: 1 }, 60)
      await storeTokenMetadata(tokenB, { portalId: 'b', userId: 'ub', scope: '', createdAt: 1 }, 60)

      const [keyA, keyB] = memcache.set.mock.calls.map((call) => call[0])

      expect(keyA).not.toBe(keyB)

      // @note revoking a forged token with the shared prefix touches nothing:
      // its key exists for no stored record
      memcache.get.mockResolvedValue(null)

      await expect(revokeToken(forged)).resolves.toBe(false)
      expect(memcache.get).toHaveBeenCalledWith(
        `apps:oauth:token:${await sha256(forged)}`
      )
      expect(memcache.set).toHaveBeenCalledTimes(2)
    })

    it('should check if token is not revoked', async () => {
      const accessToken = 'abcdefghijklmnopqrstuvwxyz'
      const metadata = {
        portalId: 'portal_check',
        userId: 'user_check',
        scope: 'mcp:tools',
        createdAt: Date.now(),
        revoked: false,
      }

      memcache.get.mockResolvedValue(JSON.stringify(metadata))

      const revoked = await isTokenRevoked(accessToken)

      expect(memcache.get).toHaveBeenCalledWith(
        `apps:oauth:token:${await sha256(accessToken)}`
      )
      expect(revoked).toBe(false)
    })

    it('should check if token is revoked', async () => {
      const accessToken = 'zyxwvutsrqponmlkjihgfedcba'
      const metadata = {
        portalId: 'portal_revoked',
        userId: 'user_revoked',
        scope: 'mcp:resources',
        createdAt: Date.now(),
        revoked: true,
      }

      memcache.get.mockResolvedValue(JSON.stringify(metadata))

      const revoked = await isTokenRevoked(accessToken)

      expect(revoked).toBe(true)
    })

    it('should return false when metadata not found', async () => {
      const accessToken = 'nonexistent_token_abc'

      memcache.get.mockResolvedValue(null)

      const revoked = await isTokenRevoked(accessToken)

      expect(revoked).toBe(false)
    })

    it('should handle Redis objects in addition to strings', async () => {
      const accessToken = 'object_token_12345'
      const metadata = {
        portalId: 'portal_obj',
        userId: 'user_obj',
        scope: 'mcp:tools',
        createdAt: Date.now(),
        revoked: false,
      }

      // @note Redis might return parsed object
      memcache.get.mockResolvedValue(metadata)

      const revoked = await isTokenRevoked(accessToken)

      expect(revoked).toBe(false)
    })
  })

  describe('Token Revocation', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should revoke a token successfully', async () => {
      const accessToken = 'token_to_revoke_abc123'
      const metadata = {
        portalId: 'portal_revoke',
        userId: 'user_revoke',
        scope: 'mcp:tools mcp:resources',
        createdAt: Date.now(),
      }

      memcache.get.mockResolvedValue(JSON.stringify(metadata))
      memcache.ttl.mockResolvedValue(3000)
      memcache.set.mockResolvedValue('OK')

      const result = await revokeToken(accessToken)

      expect(result).toBe(true)
      expect(memcache.set).toHaveBeenCalledWith(
        `apps:oauth:token:${await sha256(accessToken)}`,
        JSON.stringify({ ...metadata, revoked: true }),
        { ex: 3000 }
      )
    })

    it('should return false when token not found', async () => {
      const accessToken = 'nonexistent_token_xyz'

      memcache.get.mockResolvedValue(null)

      const result = await revokeToken(accessToken)

      expect(result).toBe(false)
      expect(memcache.set).not.toHaveBeenCalled()
    })

    it('should preserve TTL when revoking token', async () => {
      const accessToken = 'token_with_ttl_123'
      const metadata = {
        portalId: 'portal_ttl',
        userId: 'user_ttl',
        scope: 'mcp:resources',
        createdAt: Date.now(),
      }

      memcache.get.mockResolvedValue(JSON.stringify(metadata))
      memcache.ttl.mockResolvedValue(1800)
      memcache.set.mockResolvedValue('OK')

      await revokeToken(accessToken)

      // @note token prefix is first 16 chars: 'token_with_ttl_1'
      expect(memcache.ttl).toHaveBeenCalledWith(
        `apps:oauth:token:${await sha256(accessToken)}`
      )
      expect(memcache.set).toHaveBeenCalledWith(
        `apps:oauth:token:${await sha256(accessToken)}`,
        expect.any(String),
        { ex: 1800 }
      )
    })

    it('should handle token with no TTL', async () => {
      const accessToken = 'token_no_ttl_456'
      const metadata = {
        portalId: 'portal_no_ttl',
        userId: 'user_no_ttl',
        scope: 'mcp:tools',
        createdAt: Date.now(),
      }

      memcache.get.mockResolvedValue(JSON.stringify(metadata))
      memcache.ttl.mockResolvedValue(-1)
      memcache.set.mockResolvedValue('OK')

      await revokeToken(accessToken)

      // @note should set without expiry when TTL is -1, token prefix is 16 chars
      expect(memcache.set).toHaveBeenCalledWith(
        `apps:oauth:token:${await sha256(accessToken)}`,
        expect.any(String)
      )
    })

    it('should handle Redis objects in addition to strings', async () => {
      const accessToken = 'token_object_789'
      const metadata = {
        portalId: 'portal_obj_rev',
        userId: 'user_obj_rev',
        scope: 'mcp:tools',
        createdAt: Date.now(),
      }

      memcache.get.mockResolvedValue(metadata)
      memcache.ttl.mockResolvedValue(2400)
      memcache.set.mockResolvedValue('OK')

      const result = await revokeToken(accessToken)

      expect(result).toBe(true)
    })
  })

  describe('isRefreshToken', () => {
    it('should return true for tokens with cbk_rt_ prefix', () => {
      expect(isRefreshToken('cbk_rt_abc123')).toBe(true)
      expect(isRefreshToken('cbk_rt_xyz')).toBe(true)
      expect(isRefreshToken(`${REFRESH_TOKEN_PREFIX}test`)).toBe(true)
    })

    it('should return false for access tokens (JWT format)', () => {
      expect(isRefreshToken('eyJhbGciOiJIUzI1NiJ9.payload.sig')).toBe(false)
      expect(isRefreshToken('eyJ...')).toBe(false)
    })

    it('should return false for other token formats', () => {
      expect(isRefreshToken('random_token')).toBe(false)
      expect(isRefreshToken('')).toBe(false)
      expect(isRefreshToken('cbk_rt')).toBe(false)
    })
  })

  describe('generateRefreshToken', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should generate a refresh token with cbk_rt_ prefix', async () => {
      memcache.set.mockResolvedValue('OK')

      const token = await generateRefreshToken({
        userId: 'user123',
        portalId: 'portal456',
        portalUserId: 'pu789',
        contactId: 'contact012',
        scope: 'mcp:tools',
        clientId: 'client_abc',
      })

      expect(token).toMatch(/^cbk_rt_/)
      expect(memcache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^apps:oauth:refresh:cbk_rt_/),
        expect.any(String),
        { ex: expect.any(Number) }
      )
    })

    it('should store token data in Redis with correct structure', async () => {
      memcache.set.mockResolvedValue('OK')

      await generateRefreshToken({
        userId: 'user123',
        portalId: 'portal456',
        portalUserId: 'pu789',
        contactId: 'contact012',
        scope: 'mcp:tools mcp:resources',
        clientId: 'client_xyz',
      })

      const setCall = memcache.set.mock.calls[0]
      const storedData = JSON.parse(setCall[1])

      expect(storedData).toMatchObject({
        userId: 'user123',
        portalId: 'portal456',
        portalUserId: 'pu789',
        contactId: 'contact012',
        scope: 'mcp:tools mcp:resources',
        clientId: 'client_xyz',
      })
      expect(storedData.token).toMatch(/^cbk_rt_/)
      expect(storedData.createdAt).toBeGreaterThan(0)
    })
  })

  describe('retrieveRefreshToken', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should return token data when token exists', async () => {
      const tokenData = {
        token: 'cbk_rt_abc123',
        userId: 'user123',
        portalId: 'portal456',
        portalUserId: 'pu789',
        contactId: 'contact012',
        scope: 'mcp:tools',
        clientId: 'client_xyz',
        createdAt: Date.now(),
        revoked: false,
      }

      memcache.get.mockResolvedValue(JSON.stringify(tokenData))

      const result = await retrieveRefreshToken('cbk_rt_abc123')

      expect(result).toEqual(tokenData)
      expect(memcache.get).toHaveBeenCalledWith('apps:oauth:refresh:cbk_rt_abc123')
    })

    it('should return null when token does not exist', async () => {
      memcache.get.mockResolvedValue(null)

      const result = await retrieveRefreshToken('cbk_rt_nonexistent')

      expect(result).toBeNull()
    })

    it('should handle Redis object responses', async () => {
      const tokenData = {
        token: 'cbk_rt_obj123',
        userId: 'user123',
        portalId: 'portal456',
        revoked: false,
      }

      memcache.get.mockResolvedValue(tokenData)

      const result = await retrieveRefreshToken('cbk_rt_obj123')

      expect(result).toEqual(tokenData)
    })
  })

  describe('validateRefreshToken', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should return token data for valid non-revoked token', async () => {
      const tokenData = {
        token: 'cbk_rt_valid123',
        userId: 'user123',
        portalId: 'portal456',
        portalUserId: 'pu789',
        contactId: 'contact012',
        scope: 'mcp:tools',
        clientId: 'client_xyz',
        createdAt: Date.now(),
        revoked: false,
      }

      memcache.get.mockResolvedValue(JSON.stringify(tokenData))

      const result = await validateRefreshToken('cbk_rt_valid123', 'client_xyz')

      expect(result).toEqual(tokenData)
    })

    it('should return null for non-existent token', async () => {
      memcache.get.mockResolvedValue(null)

      const result = await validateRefreshToken(
        'cbk_rt_nonexistent',
        'client_xyz'
      )

      expect(result).toBeNull()
    })

    it('should return null for revoked token', async () => {
      const tokenData = {
        token: 'cbk_rt_revoked123',
        userId: 'user123',
        portalId: 'portal456',
        clientId: 'client_xyz',
        createdAt: Date.now(),
        revoked: true,
      }

      memcache.get.mockResolvedValue(JSON.stringify(tokenData))

      const result = await validateRefreshToken(
        'cbk_rt_revoked123',
        'client_xyz'
      )

      expect(result).toBeNull()
    })

    it('should return null for mismatched client_id', async () => {
      const tokenData = {
        token: 'cbk_rt_mismatch',
        userId: 'user123',
        portalId: 'portal456',
        clientId: 'client_original',
        createdAt: Date.now(),
        revoked: false,
      }

      memcache.get.mockResolvedValue(JSON.stringify(tokenData))

      const result = await validateRefreshToken(
        'cbk_rt_mismatch',
        'client_different'
      )

      expect(result).toBeNull()
    })

    it('should return token data when client_id check is not provided', async () => {
      const tokenData = {
        token: 'cbk_rt_noclient',
        userId: 'user123',
        portalId: 'portal456',
        clientId: 'client_xyz',
        createdAt: Date.now(),
        revoked: false,
      }

      memcache.get.mockResolvedValue(JSON.stringify(tokenData))

      const result = await validateRefreshToken('cbk_rt_noclient')

      expect(result).toEqual(tokenData)
    })
  })

  describe('revokeRefreshToken', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should mark token as revoked while preserving TTL', async () => {
      const tokenData = {
        token: 'cbk_rt_torevoke',
        userId: 'user123',
        portalId: 'portal456',
        clientId: 'client_xyz',
        createdAt: Date.now(),
        revoked: false,
      }

      memcache.get.mockResolvedValue(JSON.stringify(tokenData))
      memcache.ttl.mockResolvedValue(86400)
      memcache.set.mockResolvedValue('OK')

      const result = await revokeRefreshToken('cbk_rt_torevoke')

      expect(result).toBe(true)

      const setCall = memcache.set.mock.calls[0]
      const updatedData = JSON.parse(setCall[1])

      expect(updatedData.revoked).toBe(true)
      expect(setCall[2]).toEqual({ ex: 86400 }) // Preserved TTL
    })

    it('should return false for non-existent token', async () => {
      memcache.get.mockResolvedValue(null)

      const result = await revokeRefreshToken('cbk_rt_nonexistent')

      expect(result).toBe(false)
    })

    it('should handle token with no TTL', async () => {
      const tokenData = {
        token: 'cbk_rt_nottl',
        userId: 'user123',
        createdAt: Date.now(),
        revoked: false,
      }

      memcache.get.mockResolvedValue(JSON.stringify(tokenData))
      memcache.ttl.mockResolvedValue(-1)
      memcache.set.mockResolvedValue('OK')

      const result = await revokeRefreshToken('cbk_rt_nottl')

      expect(result).toBe(true)
      expect(memcache.set).toHaveBeenCalledWith(
        'apps:oauth:refresh:cbk_rt_nottl',
        expect.any(String)
      )
    })
  })

  describe('deleteRefreshToken', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should delete token from Redis', async () => {
      memcache.del.mockResolvedValue(1)

      await deleteRefreshToken('cbk_rt_todelete')

      expect(memcache.del).toHaveBeenCalledWith(
        'apps:oauth:refresh:cbk_rt_todelete'
      )
    })

    it('should not throw when token does not exist', async () => {
      memcache.del.mockResolvedValue(0)

      await expect(
        deleteRefreshToken('cbk_rt_nonexistent')
      ).resolves.toBeUndefined()
    })
  })

  describe('rotateRefreshToken', () => {
    const oldTokenData = {
      token: 'cbk_rt_old',
      userId: 'user123',
      portalId: 'portal456',
      portalUserId: 'pu789',
      contactId: 'contact012',
      scope: 'mcp:tools',
      clientId: 'client_xyz',
      createdAt: Date.now(),
      revoked: false,
    }

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('consumes the old token atomically and mints a replacement', async () => {
      memcache.getdel.mockResolvedValueOnce(JSON.stringify(oldTokenData))
      memcache.set.mockResolvedValue('OK')
      memcache.get.mockResolvedValueOnce(
        JSON.stringify({ ...oldTokenData, token: 'cbk_rt_new' })
      )

      const result = await rotateRefreshToken('cbk_rt_old')

      expect(result).not.toBeNull()
      expect(result.refreshToken).toMatch(/^cbk_rt_/)
      expect(result.refreshToken).not.toBe('cbk_rt_old')
      // @note one atomic consume, no separate read-then-delete
      expect(memcache.getdel).toHaveBeenCalledWith('apps:oauth:refresh:cbk_rt_old')
      expect(memcache.del).not.toHaveBeenCalled()
      expect(memcache.set).toHaveBeenCalled()
    })

    it('lets exactly one of two concurrent exchanges succeed', async () => {
      // @note the store hands the record to the first getdel only
      memcache.getdel
        .mockResolvedValueOnce(JSON.stringify(oldTokenData))
        .mockResolvedValueOnce(null)
      memcache.set.mockResolvedValue('OK')
      memcache.get.mockResolvedValue(JSON.stringify({ ...oldTokenData }))

      const [a, b] = await Promise.all([
        rotateRefreshToken('cbk_rt_old'),
        rotateRefreshToken('cbk_rt_old'),
      ])

      expect([a, b].filter(Boolean)).toHaveLength(1)
      expect(memcache.set).toHaveBeenCalledTimes(1)
    })

    it('returns null when the old token is unknown or revoked', async () => {
      memcache.getdel.mockResolvedValueOnce(null)

      await expect(rotateRefreshToken('cbk_rt_invalid')).resolves.toBeNull()

      memcache.getdel.mockResolvedValueOnce(
        JSON.stringify({ ...oldTokenData, revoked: true })
      )

      await expect(rotateRefreshToken('cbk_rt_old')).resolves.toBeNull()
      expect(memcache.set).not.toHaveBeenCalled()
    })

    it('does not resurrect a consumed token when issuance fails', async () => {
      memcache.getdel.mockResolvedValueOnce(JSON.stringify(oldTokenData))
      memcache.set.mockRejectedValueOnce(new Error('store down'))

      await expect(rotateRefreshToken('cbk_rt_old')).rejects.toThrow('store down')
      // @note nothing writes the old record back; both families are dead
      expect(memcache.set).toHaveBeenCalledTimes(1)
    })
  })
})
