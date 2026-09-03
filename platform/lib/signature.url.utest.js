import mockCuid from '@/lib/cuid'
import mockMemcache from '@/lib/memcache'
import { sign, trySign, tryVerify, verify } from '@/lib/signature.url'
import { createHmacHexDigest as mockCreateHmacHexDigest } from '@/lib/webcrypto'

jest.mock('@/lib/cuid', () => jest.fn())

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
}))

jest.mock('@/lib/webcrypto', () => ({
  createHmacHexDigest: jest.fn(),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

describe('signature', () => {
  const mockSession = {
    user: { id: 'user-123' },
    options: { option1: 'value1' },
    payload: { data: 'test' },
  }

  const mockUrl = 'https://example.com/path?existing=param'
  const mockKey = 'test-key-123'
  const mockSecret = 'test-secret-456'
  const mockSignature = 'abc123def456'
  const mockNow = 1640995200000 // fixed timestamp for consistent testing

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Date, 'now').mockReturnValue(mockNow)

    mockCuid.mockReturnValueOnce(mockKey).mockReturnValueOnce(mockSecret)
    mockCreateHmacHexDigest.mockResolvedValue(mockSignature)

    mockMemcache.set.mockResolvedValue()
    mockMemcache.get.mockResolvedValue({
      secret: mockSecret,
      session: {
        user: { id: 'user-123' },
        options: { option1: 'value1' },
        payload: { data: 'test' },
      },
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('sign', () => {
    it('should successfully sign a URL with session data', async () => {
      const result = await sign(mockUrl, mockSession)

      expect(result).toBeInstanceOf(URL)
      expect(result.searchParams.get('_key')).toBe(mockKey)
      expect(result.searchParams.get('_algorithm')).toBe('sha256')
      expect(result.searchParams.get('_expires')).toBe(
        String(mockNow + 24 * 60 * 60 * 1000)
      )
      expect(result.searchParams.get('_signature')).toBe(mockSignature)
      expect(result.searchParams.get('existing')).toBe('param')
    })

    it('should store session data in redis with correct expiration', async () => {
      await sign(mockUrl, mockSession)

      expect(mockMemcache.set).toHaveBeenCalledWith(
        'signature:url:' + mockKey,
        {
          secret: mockSecret,
          session: {
            user: { id: 'user-123' },
            options: { option1: 'value1' },
            payload: { data: 'test' },
          },
        },
        { ex: 86400 } // 24 hours in seconds
      )
    })

    it('should create HMAC signature with sorted query parameters', async () => {
      await sign(mockUrl, mockSession)

      expect(mockCreateHmacHexDigest).toHaveBeenCalledWith(
        'sha256',
        mockSecret,
        expect.stringContaining('_algorithm=sha256&_expires=')
      )

      // verify the URL passed to HMAC contains sorted parameters

      const hmacCallArgs = mockCreateHmacHexDigest.mock.calls[0]
      const urlForSigning = hmacCallArgs[2]
      const url = new URL(urlForSigning)
      const params = [...url.searchParams.keys()]
      const sortedParams = [...params].sort()

      expect(params).toEqual(sortedParams)
    })

    it('should handle URL objects as input', async () => {
      const urlObject = new URL(mockUrl)
      const result = await sign(urlObject, mockSession)

      expect(result).toBeInstanceOf(URL)
      expect(result.href).toContain('example.com')
    })

    it('should throw error when session expiration is invalid', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(NaN)

      await expect(sign(mockUrl, mockSession)).rejects.toThrow(
        'Invalid session expiration date'
      )
    })

    it('should handle edge case of time calculations correctly', async () => {
      // This test verifies the time calculation logic works as expected
      // The expires < now condition in the code is defensive programming
      // but may not be triggerable in normal circumstances

      const result = await sign(mockUrl, mockSession)

      expect(result).toBeInstanceOf(URL)

      const expiresParam = result.searchParams.get('_expires')
      const expiresValue = Number(expiresParam)

      // verify expires is in the future (now + 1 day)

      expect(expiresValue).toBeGreaterThan(mockNow)
      expect(expiresValue).toBe(mockNow + 24 * 60 * 60 * 1000)
    })

    it('should handle session data without optional fields', async () => {
      const minimalSession = {
        user: { id: 'user-456' },
        options: {},
        payload: {},
      }

      const result = await sign(mockUrl, minimalSession)

      expect(result).toBeInstanceOf(URL)

      expect(mockMemcache.set).toHaveBeenCalledWith(
        'signature:url:' + mockKey,
        {
          secret: mockSecret,
          session: {
            user: { id: 'user-456' },
            options: {},
            payload: {},
          },
        },
        expect.any(Object)
      )
    })
  })

  describe('trySign', () => {
    it('should successfully sign URL and return result', async () => {
      const result = await trySign(mockUrl, mockSession)

      expect(result).toBeInstanceOf(URL)
      expect(result.searchParams.get('_signature')).toBe(mockSignature)
    })

    it('should return null when sign throws an error', async () => {
      mockMemcache.set.mockRejectedValue(new Error('Cache error'))

      const result = await trySign(mockUrl, mockSession)

      expect(result).toBeNull()
    })

    it('should return null for invalid URL', async () => {
      const result = await trySign('invalid-url', mockSession)

      expect(result).toBeNull()
    })

    it('should handle session validation errors gracefully', async () => {
      const invalidSession = null

      const result = await trySign(mockUrl, invalidSession)

      expect(result).toBeNull()
    })
  })

  describe('verify', () => {
    const mockSignedUrl = `${mockUrl}&_key=${mockKey}&_algorithm=sha256&_expires=${
      mockNow + 24 * 60 * 60 * 1000
    }&_signature=${mockSignature}`

    it('should successfully verify a signed URL and return session', async () => {
      const result = await verify(mockSignedUrl)

      expect(result).toEqual({
        user: { id: 'user-123' },
        options: { option1: 'value1' },
        payload: { data: 'test' },
      })
    })

    it('should return null when key parameter is missing', async () => {
      const urlWithoutKey = `${mockUrl}&_algorithm=sha256&_expires=${
        mockNow + 24 * 60 * 60 * 1000
      }&_signature=${mockSignature}`

      const result = await verify(urlWithoutKey)

      expect(result).toBeNull()
    })

    it('should return null when algorithm parameter is missing', async () => {
      const urlWithoutAlgorithm = `${mockUrl}&_key=${mockKey}&_expires=${
        mockNow + 24 * 60 * 60 * 1000
      }&_signature=${mockSignature}`

      const result = await verify(urlWithoutAlgorithm)

      expect(result).toBeNull()
    })

    it('should return null when expires parameter is missing', async () => {
      const urlWithoutExpires = `${mockUrl}&_key=${mockKey}&_algorithm=sha256&_signature=${mockSignature}`

      const result = await verify(urlWithoutExpires)

      expect(result).toBeNull()
    })

    it('should return null when signature parameter is missing', async () => {
      const urlWithoutSignature = `${mockUrl}&_key=${mockKey}&_algorithm=sha256&_expires=${
        mockNow + 24 * 60 * 60 * 1000
      }`

      const result = await verify(urlWithoutSignature)

      expect(result).toBeNull()
    })

    it('should return null for unsupported algorithm', async () => {
      const urlWithBadAlgorithm = `${mockUrl}&_key=${mockKey}&_algorithm=md5&_expires=${
        mockNow + 24 * 60 * 60 * 1000
      }&_signature=${mockSignature}`

      const result = await verify(urlWithBadAlgorithm)

      expect(result).toBeNull()
    })

    it('should return null when key not found in cache', async () => {
      mockMemcache.get.mockResolvedValue(null)

      const result = await verify(mockSignedUrl)

      expect(result).toBeNull()
    })

    it('should return null when URL has expired', async () => {
      const expiredTime = mockNow - 1000 // 1 second ago
      const expiredUrl = `${mockUrl}&_key=${mockKey}&_algorithm=sha256&_expires=${expiredTime}&_signature=${mockSignature}`

      const result = await verify(expiredUrl)

      expect(result).toBeNull()
    })

    it('should return null when signature verification fails', async () => {
      mockCreateHmacHexDigest.mockResolvedValue('different-signature')

      const result = await verify(mockSignedUrl)

      expect(result).toBeNull()
    })

    it('should verify signature by recreating URL without signature parameter', async () => {
      await verify(mockSignedUrl)

      expect(mockCreateHmacHexDigest).toHaveBeenCalledWith(
        'sha256',
        mockSecret,
        expect.not.stringContaining('_signature=')
      )
    })

    it('should sort query parameters when recreating signature', async () => {
      const complexUrl = `https://example.com/path?z=last&a=first&_key=${mockKey}&_algorithm=sha256&_expires=${
        mockNow + 24 * 60 * 60 * 1000
      }&_signature=${mockSignature}`

      await verify(complexUrl)

      // verify the URL passed to HMAC has sorted parameters

      const hmacCallArgs = mockCreateHmacHexDigest.mock.calls[0]
      const urlForVerification = hmacCallArgs[2]
      const url = new URL(urlForVerification)
      const params = [...url.searchParams.keys()]
      const sortedParams = [...params].sort()

      expect(params).toEqual(sortedParams)
    })

    it('should handle URL objects as input', async () => {
      const urlObject = new URL(mockSignedUrl)
      const result = await verify(urlObject)

      expect(result).toEqual({
        user: { id: 'user-123' },
        options: { option1: 'value1' },
        payload: { data: 'test' },
      })
    })
  })

  describe('tryVerify', () => {
    const mockSignedUrl = `${mockUrl}&_key=${mockKey}&_algorithm=sha256&_expires=${
      mockNow + 24 * 60 * 60 * 1000
    }&_signature=${mockSignature}`

    it('should successfully verify URL and return session', async () => {
      const result = await tryVerify(mockSignedUrl)

      expect(result).toEqual({
        user: { id: 'user-123' },
        options: { option1: 'value1' },
        payload: { data: 'test' },
      })
    })

    it('should return null when verify throws an error', async () => {
      mockMemcache.get.mockRejectedValue(new Error('Cache error'))

      const result = await tryVerify(mockSignedUrl)

      expect(result).toBeNull()
    })

    it('should return null for invalid URL', async () => {
      const result = await tryVerify('invalid-url')

      expect(result).toBeNull()
    })

    it('should return null for URL without required parameters', async () => {
      const result = await tryVerify(mockUrl)

      expect(result).toBeNull()
    })

    it('should return null when signature verification fails', async () => {
      mockCreateHmacHexDigest.mockResolvedValue('wrong-signature')

      const result = await tryVerify(mockSignedUrl)

      expect(result).toBeNull()
    })
  })

  describe('integration scenarios', () => {
    it('should complete full sign-verify cycle successfully', async () => {
      // sign a URL

      const signedUrl = await sign(mockUrl, mockSession)

      // verify the signed URL

      const verifiedSession = await verify(signedUrl.toString())

      expect(verifiedSession).toEqual({
        user: { id: 'user-123' },
        options: { option1: 'value1' },
        payload: { data: 'test' },
      })
    })

    it('should handle URLs with existing query parameters correctly', async () => {
      const urlWithParams =
        'https://example.com/api?param1=value1&param2=value2'

      const signedUrl = await sign(urlWithParams, mockSession)
      const verifiedSession = await verify(signedUrl.toString())

      expect(verifiedSession).toEqual({
        user: { id: 'user-123' },
        options: { option1: 'value1' },
        payload: { data: 'test' },
      })

      // ensure original parameters are preserved

      expect(signedUrl.searchParams.get('param1')).toBe('value1')
      expect(signedUrl.searchParams.get('param2')).toBe('value2')
    })

    it('should handle complex session data structures', async () => {
      const complexSession = {
        user: {
          id: 'user-complex',
          email: 'test@example.com',
          roles: ['admin', 'user'],
        },
        options: {
          theme: 'dark',
          notifications: true,
          settings: {
            autoSave: false,
            language: 'en',
          },
        },
        payload: {
          permissions: ['read', 'write'],
          metadata: {
            lastLogin: '2024-01-01',
            preferences: {
              dashboard: 'compact',
              sidebar: 'expanded',
            },
          },
        },
      }

      mockMemcache.get.mockResolvedValue({
        secret: mockSecret,
        session: complexSession,
      })

      const signedUrl = await sign(mockUrl, complexSession)
      const verifiedSession = await verify(signedUrl.toString())

      expect(verifiedSession).toEqual(complexSession)
    })
  })
})
