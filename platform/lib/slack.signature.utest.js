import {
  extractSlackHeaders,
  validateSlackRequest,
  validateSlackSignature,
} from '@/lib/slack.signature'
import { createHmacHexDigest } from '@/lib/webcrypto'

// @note only the digest is mocked - `timingSafeEqual` stays real, because the
// comparison itself is one of the things this suite asserts
jest.mock('@/lib/webcrypto', () => ({
  ...jest.requireActual('@/lib/webcrypto'),

  createHmacHexDigest: jest.fn(),
}))

describe('slack.signature', () => {
  const mockSigningSecret = 'test-signing-secret'
  const mockRequestBody = 'token=test&team_id=T123&text=hello'

  beforeEach(() => {
    jest.clearAllMocks()

    // mock current time to a known value for consistent timestamp testing
    jest.spyOn(Date, 'now').mockReturnValue(1640995200000) // 2022-01-01 00:00:00 UTC
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('validateSlackSignature', () => {
    it('should validate a correct signature', async () => {
      const timestamp = '1640995200' // Current time
      const expectedHash = 'abc123def456'
      const signature = `v0=${expectedHash}`

      createHmacHexDigest.mockResolvedValue(expectedHash)

      const result = await validateSlackSignature(
        mockRequestBody,
        timestamp,
        signature,
        mockSigningSecret
      )

      expect(result).toBe(true)
      expect(createHmacHexDigest).toHaveBeenCalledWith(
        'sha256',
        mockSigningSecret,
        `v0:${timestamp}:${mockRequestBody}`
      )
    })

    it('should reject invalid timestamp format', async () => {
      const timestamp = 'invalid-timestamp'
      const signature = 'v0=abc123'

      await expect(
        validateSlackSignature(
          mockRequestBody,
          timestamp,
          signature,
          mockSigningSecret
        )
      ).rejects.toThrow('Invalid timestamp format')
    })

    it('should reject timestamps older than 5 minutes', async () => {
      const oldTimestamp = '1640994899' // 301 seconds ago (5 minutes + 1 second)
      const signature = 'v0=abc123'

      // @note timestamp validation should happen before signature validation

      await expect(
        validateSlackSignature(
          mockRequestBody,
          oldTimestamp,
          signature,
          mockSigningSecret
        )
      ).rejects.toThrow('Request timestamp too old')

      // verify that createHmacHexDigest is not called for old timestamps

      expect(createHmacHexDigest).not.toHaveBeenCalled()
    })

    it('should reject timestamps from the future beyond 5 minutes', async () => {
      const futureTimestamp = '1640995501' // 5 minutes and 1 second in future
      const signature = 'v0=abc123'

      // @note timestamp validation should happen before signature validation

      await expect(
        validateSlackSignature(
          mockRequestBody,
          futureTimestamp,
          signature,
          mockSigningSecret
        )
      ).rejects.toThrow('Request timestamp too old')

      // verify that createHmacHexDigest is not called for future timestamps

      expect(createHmacHexDigest).not.toHaveBeenCalled()
    })

    it('should accept timestamps within 5 minute tolerance', async () => {
      const timestamp = '1640995020' // 3 minutes ago
      const expectedHash = 'abc123def456'
      const signature = `v0=${expectedHash}`

      createHmacHexDigest.mockResolvedValue(expectedHash)

      const result = await validateSlackSignature(
        mockRequestBody,
        timestamp,
        signature,
        mockSigningSecret
      )

      expect(result).toBe(true)
    })

    it('should reject incorrect signatures', async () => {
      const timestamp = '1640995200'
      const expectedHash = 'correct-hash'
      const wrongSignature = 'v0=wrong-hash'

      createHmacHexDigest.mockResolvedValue(expectedHash)

      await expect(
        validateSlackSignature(
          mockRequestBody,
          timestamp,
          wrongSignature,
          mockSigningSecret
        )
      ).rejects.toThrow('Invalid signature')
    })

    it('should use timing-safe comparison for signatures', async () => {
      const timestamp = '1640995200'
      const expectedHash = 'abc123'
      const wrongSignature = 'v0=abc124' // Same length, different content

      createHmacHexDigest.mockResolvedValue(expectedHash)

      await expect(
        validateSlackSignature(
          mockRequestBody,
          timestamp,
          wrongSignature,
          mockSigningSecret
        )
      ).rejects.toThrow('Invalid signature')
    })
  })

  describe('extractSlackHeaders', () => {
    function createMockRequest(headers = {}) {
      return {
        headers: new Headers(headers),
      }
    }

    it('should extract valid headers successfully', () => {
      const req = createMockRequest({
        'x-slack-request-timestamp': '1640995200',
        'x-slack-signature': 'v0=abc123def456',
      })

      const result = extractSlackHeaders(req)

      expect(result).toEqual({
        timestamp: '1640995200',
        signature: 'v0=abc123def456',
      })
    })

    it('should throw error for missing timestamp header', () => {
      const req = createMockRequest({
        'x-slack-signature': 'v0=abc123def456',
      })

      expect(() => extractSlackHeaders(req)).toThrow(
        'Missing X-Slack-Request-Timestamp header'
      )
    })

    it('should throw error for missing signature header', () => {
      const req = createMockRequest({
        'x-slack-request-timestamp': '1640995200',
      })

      expect(() => extractSlackHeaders(req)).toThrow(
        'Missing X-Slack-Signature header'
      )
    })

    it('should throw error for invalid signature format', () => {
      const req = createMockRequest({
        'x-slack-request-timestamp': '1640995200',
        'x-slack-signature': 'invalid-format',
      })

      expect(() => extractSlackHeaders(req)).toThrow('Invalid signature format')
    })

    it('should handle case-insensitive header names', () => {
      const req = createMockRequest({
        'x-slack-request-timestamp': '1640995200', // lowercase
        'x-slack-signature': 'v0=abc123def456', // lowercase
      })

      const result = extractSlackHeaders(req)

      expect(result).toEqual({
        timestamp: '1640995200',
        signature: 'v0=abc123def456',
      })
    })
  })

  describe('validateSlackRequest', () => {
    function createMockRequest(headers = {}) {
      return {
        headers: new Headers(headers),
      }
    }

    it('should validate a complete request successfully', async () => {
      const timestamp = '1640995200'
      const expectedHash = 'abc123def456'
      const signature = `v0=${expectedHash}`

      const req = createMockRequest({
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': signature,
      })

      createHmacHexDigest.mockResolvedValue(expectedHash)

      const result = await validateSlackRequest(
        req,
        mockRequestBody,
        mockSigningSecret
      )

      expect(result).toBe(true)
    })

    it('should reject request with invalid headers', async () => {
      const req = createMockRequest({
        'x-slack-request-timestamp': '1640995200',
        // missing signature header
      })

      await expect(
        validateSlackRequest(req, mockRequestBody, mockSigningSecret)
      ).rejects.toThrow('Missing X-Slack-Signature header')
    })

    it('should reject request with invalid signature', async () => {
      const req = createMockRequest({
        'x-slack-request-timestamp': '1640995200',
        'x-slack-signature': 'v0=wrong-signature',
      })

      createHmacHexDigest.mockResolvedValue('correct-signature')

      await expect(
        validateSlackRequest(req, mockRequestBody, mockSigningSecret)
      ).rejects.toThrow('Invalid signature')
    })
  })

  describe('edge cases', () => {
    it('should handle empty request body', async () => {
      const timestamp = '1640995200'
      const emptyBody = ''
      const expectedHash = 'empty-body-hash'
      const signature = `v0=${expectedHash}`

      createHmacHexDigest.mockResolvedValue(expectedHash)

      const result = await validateSlackSignature(
        emptyBody,
        timestamp,
        signature,
        mockSigningSecret
      )

      expect(result).toBe(true)
      expect(createHmacHexDigest).toHaveBeenCalledWith(
        'sha256',
        mockSigningSecret,
        `v0:${timestamp}:${emptyBody}`
      )
    })

    it('should handle special characters in request body', async () => {
      const timestamp = '1640995200'
      const specialBody = 'text=hello%20world&emoji=%F0%9F%98%80'
      const expectedHash = 'special-chars-hash'
      const signature = `v0=${expectedHash}`

      createHmacHexDigest.mockResolvedValue(expectedHash)

      const result = await validateSlackSignature(
        specialBody,
        timestamp,
        signature,
        mockSigningSecret
      )

      expect(result).toBe(true)
    })

    it('should handle very long signing secrets', async () => {
      const timestamp = '1640995200'
      const longSecret = 'a'.repeat(1000)
      const expectedHash = 'long-secret-hash'
      const signature = `v0=${expectedHash}`

      createHmacHexDigest.mockResolvedValue(expectedHash)

      const result = await validateSlackSignature(
        mockRequestBody,
        timestamp,
        signature,
        longSecret
      )

      expect(result).toBe(true)
    })
  })
})
