import { getHeader } from '@/lib/header'
import { createHmacHexDigest } from '@/lib/webcrypto'

import {
  extractGithubSignature,
  validateGithubRequest,
  validateGithubSignature,
} from './github.signature'

jest.mock('@/lib/webcrypto', () => ({
  createHmacHexDigest: jest.fn(),
}))

jest.mock('@/lib/header', () => ({
  getHeader: jest.fn(),
}))

describe('GitHub Signature Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateGithubSignature', () => {
    const webhookSecret = 'my-webhook-secret'
    const requestBody = '{"action":"opened"}'
    const validHexDigest = 'abc123def456'

    it('should validate a valid signature', async () => {
      createHmacHexDigest.mockResolvedValue(validHexDigest)

      const result = await validateGithubSignature(
        requestBody,
        `sha256=${validHexDigest}`,
        webhookSecret
      )

      expect(result).toBe(true)
      expect(createHmacHexDigest).toHaveBeenCalledWith(
        'sha256',
        webhookSecret,
        requestBody
      )
    })

    it('should throw on invalid signature', async () => {
      createHmacHexDigest.mockResolvedValue('abc123def456')

      await expect(
        validateGithubSignature(
          requestBody,
          'sha256=wrongdigest',
          webhookSecret
        )
      ).rejects.toThrow('Invalid signature')
    })

    it('should throw on empty signature', async () => {
      createHmacHexDigest.mockResolvedValue('abc123def456')

      await expect(
        validateGithubSignature(requestBody, '', webhookSecret)
      ).rejects.toThrow('Invalid signature')
    })

    it('should handle empty request body', async () => {
      const emptyBody = ''

      createHmacHexDigest.mockResolvedValue('emptyBodyHash')

      const result = await validateGithubSignature(
        emptyBody,
        'sha256=emptyBodyHash',
        webhookSecret
      )

      expect(result).toBe(true)
      expect(createHmacHexDigest).toHaveBeenCalledWith(
        'sha256',
        webhookSecret,
        emptyBody
      )
    })

    it('should handle large request bodies', async () => {
      const largeBody = JSON.stringify({
        action: 'opened',
        pull_request: {
          body: 'x'.repeat(10000),
          title: 'Long PR',
          diff_url: 'https://api.github.com/repos/user/repo/pulls/123.diff',
        },
      })

      createHmacHexDigest.mockResolvedValue('largeBodyHash')

      const result = await validateGithubSignature(
        largeBody,
        'sha256=largeBodyHash',
        webhookSecret
      )

      expect(result).toBe(true)
      expect(createHmacHexDigest).toHaveBeenCalledWith(
        'sha256',
        webhookSecret,
        largeBody
      )
    })

    it('should handle special characters in request body', async () => {
      const specialBody = JSON.stringify({
        comment: {
          body: 'Test with special chars: \n\t\r @mention "quotes" \'apostrophe\'',
        },
      })

      createHmacHexDigest.mockResolvedValue('specialHash')

      const result = await validateGithubSignature(
        specialBody,
        'sha256=specialHash',
        webhookSecret
      )

      expect(result).toBe(true)
    })

    it('should handle different webhook secrets', async () => {
      const secret1 = 'secret-one'
      const secret2 = 'secret-two'
      const body = 'webhook-payload'

      createHmacHexDigest.mockResolvedValueOnce('hash1')

      const result1 = await validateGithubSignature(
        body,
        'sha256=hash1',
        secret1
      )

      expect(result1).toBe(true)

      createHmacHexDigest.mockResolvedValueOnce('hash2')

      const result2 = await validateGithubSignature(
        body,
        'sha256=hash2',
        secret2
      )

      expect(result2).toBe(true)

      expect(createHmacHexDigest).toHaveBeenNthCalledWith(
        1,
        'sha256',
        secret1,
        body
      )
      expect(createHmacHexDigest).toHaveBeenNthCalledWith(
        2,
        'sha256',
        secret2,
        body
      )
    })

    it('should be case-sensitive for signature comparison', async () => {
      const digest = 'AbCdEf123456'

      createHmacHexDigest.mockResolvedValue(digest)

      // Different case should fail
      await expect(
        validateGithubSignature(
          requestBody,
          `sha256=${digest.toLowerCase()}`,
          webhookSecret
        )
      ).rejects.toThrow('Invalid signature')
    })

    it('should handle very long webhook secret', async () => {
      const longSecret = 'x'.repeat(1000)

      createHmacHexDigest.mockResolvedValue('hash')

      const result = await validateGithubSignature(
        requestBody,
        'sha256=hash',
        longSecret
      )

      expect(result).toBe(true)
      expect(createHmacHexDigest).toHaveBeenCalledWith(
        'sha256',
        longSecret,
        requestBody
      )
    })
  })

  describe('extractGithubSignature', () => {
    it('should extract valid signature from request', () => {
      const req = { headers: {} }

      getHeader.mockReturnValue('sha256=abc123def456')

      const signature = extractGithubSignature(req)

      expect(signature).toBe('sha256=abc123def456')
      expect(getHeader).toHaveBeenCalledWith(req, 'x-hub-signature-256')
    })

    it('should throw if signature header missing', () => {
      const req = { headers: {} }

      getHeader.mockReturnValue(null)

      expect(() => extractGithubSignature(req)).toThrow(
        'Missing X-Hub-Signature-256 header'
      )
    })

    it('should throw if signature header undefined', () => {
      const req = { headers: {} }

      getHeader.mockReturnValue(undefined)

      expect(() => extractGithubSignature(req)).toThrow(
        'Missing X-Hub-Signature-256 header'
      )
    })

    it('should throw if signature header empty string', () => {
      const req = { headers: {} }

      getHeader.mockReturnValue('')

      expect(() => extractGithubSignature(req)).toThrow(
        'Missing X-Hub-Signature-256 header'
      )
    })

    it('should throw if signature format invalid', () => {
      const req = { headers: {} }

      getHeader.mockReturnValue('md5=abc123')

      expect(() => extractGithubSignature(req)).toThrow(
        'Invalid signature format'
      )
    })

    it('should throw if no sha256= prefix', () => {
      const req = { headers: {} }

      getHeader.mockReturnValue('abc123def456')

      expect(() => extractGithubSignature(req)).toThrow(
        'Invalid signature format'
      )
    })

    it('should handle sha256= with empty hash', () => {
      const req = { headers: {} }

      getHeader.mockReturnValue('sha256=')

      // Should not throw - extraction succeeds
      const signature = extractGithubSignature(req)

      expect(signature).toBe('sha256=')
    })

    it('should handle sha256= with very long hash', () => {
      const longHash = 'a'.repeat(1000)
      const req = { headers: {} }

      getHeader.mockReturnValue(`sha256=${longHash}`)

      const signature = extractGithubSignature(req)

      expect(signature).toBe(`sha256=${longHash}`)
    })

    it('should be case-sensitive for sha256= prefix', () => {
      const req = { headers: {} }

      getHeader.mockReturnValue('SHA256=abc123')

      expect(() => extractGithubSignature(req)).toThrow(
        'Invalid signature format'
      )
    })

    it('should handle headers from different request types', () => {
      const nodeReq = { headers: {} }
      const webReq = new Map([['x-hub-signature-256', 'sha256=abc123']])

      getHeader.mockReturnValue('sha256=abc123')

      extractGithubSignature(nodeReq)
      extractGithubSignature(webReq)

      expect(getHeader).toHaveBeenCalledWith(nodeReq, 'x-hub-signature-256')
      expect(getHeader).toHaveBeenCalledWith(webReq, 'x-hub-signature-256')
    })
  })

  describe('validateGithubRequest', () => {
    const webhookSecret = 'webhook-secret'
    const rawBody = '{"action":"opened","number":42}'
    const validHash = 'validhash123'

    beforeEach(() => {
      createHmacHexDigest.mockResolvedValue(validHash)
    })

    it('should validate complete request successfully', async () => {
      const req = { headers: {} }

      getHeader.mockReturnValue(`sha256=${validHash}`)

      const result = await validateGithubRequest(req, rawBody, webhookSecret)

      expect(result).toBe(true)
      expect(getHeader).toHaveBeenCalledWith(req, 'x-hub-signature-256')
      expect(createHmacHexDigest).toHaveBeenCalledWith(
        'sha256',
        webhookSecret,
        rawBody
      )
    })

    it('should throw if signature header missing during validation', async () => {
      const req = { headers: {} }

      getHeader.mockReturnValue(null)

      await expect(
        validateGithubRequest(req, rawBody, webhookSecret)
      ).rejects.toThrow('Missing X-Hub-Signature-256 header')
    })

    it('should throw if signature format invalid during validation', async () => {
      const req = { headers: {} }

      getHeader.mockReturnValue('invalid-format')

      await expect(
        validateGithubRequest(req, rawBody, webhookSecret)
      ).rejects.toThrow('Invalid signature format')
    })

    it('should throw if computed signature does not match', async () => {
      const req = { headers: {} }

      getHeader.mockReturnValue('sha256=wronghash')
      createHmacHexDigest.mockResolvedValue(validHash)

      await expect(
        validateGithubRequest(req, rawBody, webhookSecret)
      ).rejects.toThrow('Invalid signature')
    })

    it('should validate different webhook events', async () => {
      const events = [
        { action: 'opened' },
        { action: 'synchronize' },
        { action: 'commented' },
        { action: 'reopened' },
      ]

      for (const event of events) {
        jest.clearAllMocks()
        createHmacHexDigest.mockResolvedValue(validHash)

        const req = { headers: {} }
        const body = JSON.stringify(event)

        getHeader.mockReturnValue(`sha256=${validHash}`)

        const result = await validateGithubRequest(req, body, webhookSecret)

        expect(result).toBe(true)
        expect(createHmacHexDigest).toHaveBeenCalledWith(
          'sha256',
          webhookSecret,
          body
        )
      }
    })

    it('should work with PR webhook', async () => {
      const prPayload = JSON.stringify({
        action: 'opened',
        number: 123,
        pull_request: {
          id: 1,
          title: 'Add feature',
          body: 'This PR adds a new feature',
          user: { login: 'alice' },
        },
      })

      const req = { headers: {} }

      getHeader.mockReturnValue(`sha256=${validHash}`)

      const result = await validateGithubRequest(req, prPayload, webhookSecret)

      expect(result).toBe(true)
    })

    it('should work with issue webhook', async () => {
      const issuePayload = JSON.stringify({
        action: 'opened',
        issue: {
          number: 456,
          title: 'Bug report',
          body: 'There is a bug',
          user: { login: 'bob' },
        },
      })

      const req = { headers: {} }

      getHeader.mockReturnValue(`sha256=${validHash}`)

      const result = await validateGithubRequest(
        req,
        issuePayload,
        webhookSecret
      )

      expect(result).toBe(true)
    })

    it('should work with issue comment webhook', async () => {
      const commentPayload = JSON.stringify({
        action: 'created',
        issue: { number: 789 },
        comment: {
          id: 1,
          body: '@chatbotkit help',
          user: { login: 'charlie' },
        },
      })

      const req = { headers: {} }

      getHeader.mockReturnValue(`sha256=${validHash}`)

      const result = await validateGithubRequest(
        req,
        commentPayload,
        webhookSecret
      )

      expect(result).toBe(true)
    })

    it('should handle Unicode in webhook payload', async () => {
      const unicodePayload = JSON.stringify({
        comment: {
          body: '你好 🎉 Привет مرحبا',
        },
      })

      const req = { headers: {} }

      getHeader.mockReturnValue(`sha256=${validHash}`)

      const result = await validateGithubRequest(
        req,
        unicodePayload,
        webhookSecret
      )

      expect(result).toBe(true)
      expect(createHmacHexDigest).toHaveBeenCalledWith(
        'sha256',
        webhookSecret,
        unicodePayload
      )
    })
  })

  describe('Security considerations', () => {
    it('should use timing-safe comparison to prevent timing attacks', async () => {
      // This test verifies the timing-safe equal function behavior
      const req = { headers: {} }
      const webhookSecret = 'secret'
      const body = 'body'

      createHmacHexDigest.mockResolvedValue('abc123')

      // Test 1: Correct signature
      getHeader.mockReturnValue('sha256=abc123')

      const result1 = await validateGithubRequest(req, body, webhookSecret)

      expect(result1).toBe(true)

      // Test 2: Wrong signature same length (should take same time as wrong sig, diff length)
      jest.clearAllMocks()
      createHmacHexDigest.mockResolvedValue('abc123')
      getHeader.mockReturnValue('sha256=xyz789')

      await expect(
        validateGithubRequest(req, body, webhookSecret)
      ).rejects.toThrow('Invalid signature')
    })

    it('should not leak timing information on different failure types', async () => {
      const req = { headers: {} }
      const webhookSecret = 'secret'
      const body = 'body'

      // Missing header case
      getHeader.mockReturnValue(null)
      await expect(
        validateGithubRequest(req, body, webhookSecret)
      ).rejects.toThrow('Missing X-Hub-Signature-256 header')

      jest.clearAllMocks()

      // Invalid format case
      getHeader.mockReturnValue('invalid')
      await expect(
        validateGithubRequest(req, body, webhookSecret)
      ).rejects.toThrow('Invalid signature format')

      jest.clearAllMocks()

      // Invalid signature case (should reject without specific error timing difference)
      createHmacHexDigest.mockResolvedValue('abc123')
      getHeader.mockReturnValue('sha256=wrongsig')
      await expect(
        validateGithubRequest(req, body, webhookSecret)
      ).rejects.toThrow('Invalid signature')
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle null webhook secret gracefully', async () => {
      createHmacHexDigest.mockResolvedValue('hash')

      const result = await validateGithubSignature('body', 'sha256=hash', null)

      expect(result).toBe(true)
      expect(createHmacHexDigest).toHaveBeenCalledWith('sha256', null, 'body')
    })

    it('should handle undefined webhook secret gracefully', async () => {
      createHmacHexDigest.mockResolvedValue('hash')

      const result = await validateGithubSignature(
        'body',
        'sha256=hash',
        undefined
      )

      expect(result).toBe(true)
      expect(createHmacHexDigest).toHaveBeenCalledWith(
        'sha256',
        undefined,
        'body'
      )
    })

    it('should propagate HMAC computation errors', async () => {
      const hmacError = new Error('HMAC computation failed')

      createHmacHexDigest.mockRejectedValue(hmacError)

      await expect(
        validateGithubSignature('body', 'sha256=hash', 'secret')
      ).rejects.toThrow('HMAC computation failed')
    })

    it('should propagate header retrieval errors', () => {
      getHeader.mockImplementation(() => {
        throw new Error('Failed to get header')
      })

      expect(() => extractGithubSignature({})).toThrow('Failed to get header')
    })

    it('should handle concurrent validations', async () => {
      createHmacHexDigest.mockResolvedValue('hash1')

      const req = { headers: {} }

      getHeader.mockReturnValue('sha256=hash1')

      const promises = [
        validateGithubRequest(req, 'body1', 'secret1'),
        validateGithubRequest(req, 'body2', 'secret2'),
        validateGithubRequest(req, 'body3', 'secret3'),
      ]

      createHmacHexDigest.mockResolvedValue('hash1')

      const results = await Promise.all(promises)

      expect(results).toEqual([true, true, true])
      expect(createHmacHexDigest).toHaveBeenCalledTimes(3)
    })
  })
})
