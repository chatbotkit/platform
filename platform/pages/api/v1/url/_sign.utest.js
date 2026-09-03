import { sign } from '@/lib/signature.url'

import handler, { bodySchema } from './sign'

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (schema, fn) => fn,
}))

jest.mock('@/lib/signature.url', () => ({
  sign: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

describe('POST /api/v1/url/sign', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('bodySchema validation', () => {
    it('should accept valid https URL', () => {
      const validBody = {
        url: 'https://example.com/file.pdf',
      }

      const { error } = bodySchema.validate(validBody)

      expect(error).toBeUndefined()
    })

    it('should accept https URL with query parameters', () => {
      const validBody = {
        url: 'https://example.com/file?param=value&test=123',
      }

      const { error } = bodySchema.validate(validBody)

      expect(error).toBeUndefined()
    })

    it('should accept https URL with hash', () => {
      const validBody = {
        url: 'https://example.com/page#section',
      }

      const { error } = bodySchema.validate(validBody)

      expect(error).toBeUndefined()
    })

    it('should reject http URL', () => {
      const invalidBody = {
        url: 'http://example.com/file.pdf',
      }

      const { error } = bodySchema.validate(invalidBody)

      expect(error).toBeDefined()
      expect(error.message).toContain('scheme')
    })

    it('should reject missing url', () => {
      const invalidBody = {}

      const { error } = bodySchema.validate(invalidBody)

      expect(error).toBeDefined()
      expect(error.message).toContain('required')
    })

    it('should reject non-URL string', () => {
      const invalidBody = {
        url: 'not a url',
      }

      const { error } = bodySchema.validate(invalidBody)

      expect(error).toBeDefined()
    })

    it('should reject empty string', () => {
      const invalidBody = {
        url: '',
      }

      const { error } = bodySchema.validate(invalidBody)

      expect(error).toBeDefined()
    })

    it('should reject ftp URL', () => {
      const invalidBody = {
        url: 'ftp://example.com/file',
      }

      const { error } = bodySchema.validate(invalidBody)

      expect(error).toBeDefined()
    })

    it('should reject file URL', () => {
      const invalidBody = {
        url: 'file:///path/to/file',
      }

      const { error } = bodySchema.validate(invalidBody)

      expect(error).toBeDefined()
    })
  })

  describe('successful signing', () => {
    it('should sign valid URL', async () => {
      const url = 'https://example.com/file.pdf'
      const signedUrl = 'https://example.com/file.pdf?signature=abc123'

      sign.mockResolvedValue(signedUrl)

      const req = {}
      const body = { url }

      const result = await handler(req, mockSession, body)

      expect(sign).toHaveBeenCalledWith(url, mockSession)
      expect(result).toEqual({ status: 200, body: { url: signedUrl } })
    })

    it('should pass session to sign function', async () => {
      const url = 'https://example.com/document.pdf'
      const signedUrl = 'https://example.com/document.pdf?sig=xyz'

      sign.mockResolvedValue(signedUrl)

      const customSession = {
        user: {
          id: 'different-user',
        },
      }

      const req = {}
      const body = { url }

      await handler(req, customSession, body)

      expect(sign).toHaveBeenCalledWith(url, customSession)
    })

    it('should return signed URL in response', async () => {
      const url = 'https://cdn.example.com/asset.png'
      const signedUrl = 'https://cdn.example.com/asset.png?token=secure123'

      sign.mockResolvedValue(signedUrl)

      const req = {}
      const body = { url }

      const result = await handler(req, mockSession, body)

      expect(result.body).toHaveProperty('url')
      expect(result.body.url).toBe(signedUrl)
    })

    it('should handle URLs with existing query parameters', async () => {
      const url = 'https://example.com/file?existing=param'
      const signedUrl = 'https://example.com/file?existing=param&sig=abc'

      sign.mockResolvedValue(signedUrl)

      const req = {}
      const body = { url }

      const result = await handler(req, mockSession, body)

      expect(sign).toHaveBeenCalledWith(url, mockSession)
      expect(result.body.url).toBe(signedUrl)
    })
  })

  describe('edge cases', () => {
    it('should handle URLs with special characters', async () => {
      const url = 'https://example.com/file%20name.pdf'
      const signedUrl = 'https://example.com/file%20name.pdf?sig=xyz'

      sign.mockResolvedValue(signedUrl)

      const req = {}
      const body = { url }

      await handler(req, mockSession, body)

      expect(sign).toHaveBeenCalledWith(url, mockSession)
    })

    it('should handle URLs with international characters', async () => {
      const url = 'https://example.com/файл.pdf'
      const signedUrl = 'https://example.com/файл.pdf?sig=abc'

      sign.mockResolvedValue(signedUrl)

      const req = {}
      const body = { url }

      await handler(req, mockSession, body)

      expect(sign).toHaveBeenCalledWith(url, mockSession)
    })

    it('should handle very long URLs', async () => {
      const url = `https://example.com/${'a'.repeat(1000)}.pdf`
      const signedUrl = `${url}?sig=xyz`

      sign.mockResolvedValue(signedUrl)

      const req = {}
      const body = { url }

      await handler(req, mockSession, body)

      expect(sign).toHaveBeenCalledWith(url, mockSession)
    })

    it('should handle URLs with fragments', async () => {
      const url = 'https://example.com/page#section'
      const signedUrl = 'https://example.com/page?sig=abc#section'

      sign.mockResolvedValue(signedUrl)

      const req = {}
      const body = { url }

      await handler(req, mockSession, body)

      expect(sign).toHaveBeenCalledWith(url, mockSession)
    })

    it('should handle URLs with port numbers', async () => {
      const url = 'https://example.com:8443/file.pdf'
      const signedUrl = 'https://example.com:8443/file.pdf?sig=xyz'

      sign.mockResolvedValue(signedUrl)

      const req = {}
      const body = { url }

      await handler(req, mockSession, body)

      expect(sign).toHaveBeenCalledWith(url, mockSession)
    })

    it('should handle URLs with authentication', async () => {
      const url = 'https://user:pass@example.com/file.pdf'
      const signedUrl = 'https://user:pass@example.com/file.pdf?sig=abc'

      sign.mockResolvedValue(signedUrl)

      const req = {}
      const body = { url }

      await handler(req, mockSession, body)

      expect(sign).toHaveBeenCalledWith(url, mockSession)
    })
  })

  describe('error handling', () => {
    it('should propagate signing errors', async () => {
      const url = 'https://example.com/file.pdf'
      const error = new Error('Signing failed')

      sign.mockRejectedValue(error)

      const req = {}
      const body = { url }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Signing failed'
      )
    })

    it('should handle signing service unavailable', async () => {
      const url = 'https://example.com/file.pdf'
      const error = new Error('Service unavailable')

      sign.mockRejectedValue(error)

      const req = {}
      const body = { url }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Service unavailable'
      )
    })
  })

  describe('response format', () => {
    it('should return only url property', async () => {
      const url = 'https://example.com/file.pdf'
      const signedUrl = 'https://example.com/file.pdf?sig=abc'

      sign.mockResolvedValue(signedUrl)

      const req = {}
      const body = { url }

      const result = await handler(req, mockSession, body)

      expect(Object.keys(result.body)).toEqual(['url'])
    })

    it('should return string URL', async () => {
      const url = 'https://example.com/file.pdf'
      const signedUrl = 'https://example.com/file.pdf?sig=abc'

      sign.mockResolvedValue(signedUrl)

      const req = {}
      const body = { url }

      const result = await handler(req, mockSession, body)

      expect(typeof result.body.url).toBe('string')
    })
  })
})
