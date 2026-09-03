/* eslint-disable @typescript-eslint/no-require-imports */
import handler, { redactText } from './redact'

import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/billing.handler', () => ({
  withSubscription: (fn) => fn,
}))

jest.mock('@/lib/pii', () => ({
  detectPiiEntities: jest.fn(),
  getSafeTextAndEntities: jest.fn(),
}))

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, data })),
  badRequest: jest.fn((message) => ({ status: 400, error: message })),
}))

const { detectPiiEntities, getSafeTextAndEntities } = require('@/lib/pii')
const { parseRequestJson } = require('@/lib/request')
const { ok, badRequest } = require('@/lib/response')

describe('/api/v1/entity/text/redact', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('redactText function', () => {
    it('should detect and redact PII entities', async () => {
      const testText = 'My email is john@example.com and phone is 555-1234'
      const mockEntities = [
        { type: 'EMAIL', text: 'john@example.com', offset: 12 },
        { type: 'PHONE', text: '555-1234', offset: 43 },
      ]
      const mockSafeResult = {
        safeText: 'My email is [EMAIL] and phone is [PHONE]',
        safeEntities: mockEntities,
      }

      detectPiiEntities.mockResolvedValue(mockEntities)
      getSafeTextAndEntities.mockReturnValue(mockSafeResult)

      const result = await redactText(testText)

      expect(detectPiiEntities).toHaveBeenCalledWith(testText)
      expect(getSafeTextAndEntities).toHaveBeenCalledWith(
        testText,
        mockEntities
      )
      expect(result).toEqual({
        text: mockSafeResult.safeText,
        entities: mockSafeResult.safeEntities,
      })
    })

    it('should handle text with no PII', async () => {
      const testText = 'Hello world, this is a simple message'
      const mockEntities = []
      const mockSafeResult = {
        safeText: testText,
        safeEntities: [],
      }

      detectPiiEntities.mockResolvedValue(mockEntities)
      getSafeTextAndEntities.mockReturnValue(mockSafeResult)

      const result = await redactText(testText)

      expect(result.text).toBe(testText)
      expect(result.entities).toEqual([])
    })

    it('should handle empty text', async () => {
      detectPiiEntities.mockResolvedValue([])
      getSafeTextAndEntities.mockReturnValue({
        safeText: '',
        safeEntities: [],
      })

      const result = await redactText('')

      expect(result.text).toBe('')
      expect(result.entities).toEqual([])
    })
  })

  describe('API handler', () => {
    it('should successfully redact text from request', async () => {
      const testText = 'My SSN is 123-45-6789'
      const mockEntities = [{ type: 'SSN', text: '123-45-6789', offset: 10 }]
      const mockSafeResult = {
        safeText: 'My SSN is [SSN]',
        safeEntities: mockEntities,
      }

      parseRequestJson.mockResolvedValue({ text: testText })
      detectPiiEntities.mockResolvedValue(mockEntities)
      getSafeTextAndEntities.mockReturnValue(mockSafeResult)
      ok.mockReturnValue(
        new Response(
          JSON.stringify({
            text: mockSafeResult.safeText,
            entities: mockSafeResult.safeEntities,
          }),
          { status: 200 }
        )
      )

      const { req } = createMocks({
        method: 'POST',
        body: { text: testText },
      })

      const result = await handler(req)

      expect(parseRequestJson).toHaveBeenCalledWith(req)
      expect(ok).toHaveBeenCalledWith({
        text: mockSafeResult.safeText,
        entities: mockSafeResult.safeEntities,
      })
      expect(result.status).toBe(200)
    })

    it('should return bad request for missing text', async () => {
      parseRequestJson.mockResolvedValue({})
      badRequest.mockReturnValue(
        new Response(JSON.stringify({ error: 'Invalid text' }), { status: 400 })
      )

      const { req } = createMocks({
        method: 'POST',
        body: {},
      })

      const result = await handler(req)

      expect(badRequest).toHaveBeenCalledWith('Invalid text')
      expect(result.status).toBe(400)
    })

    it('should return bad request for empty string', async () => {
      parseRequestJson.mockResolvedValue({ text: '' })
      badRequest.mockReturnValue(
        new Response(JSON.stringify({ error: 'Invalid text' }), { status: 400 })
      )

      const { req } = createMocks({
        method: 'POST',
        body: { text: '' },
      })

      const result = await handler(req)

      expect(badRequest).toHaveBeenCalledWith('Invalid text')
      expect(result.status).toBe(400)
    })

    it('should return bad request for non-string text', async () => {
      parseRequestJson.mockResolvedValue({ text: 123 })
      badRequest.mockReturnValue(
        new Response(JSON.stringify({ error: 'Invalid text' }), { status: 400 })
      )

      const { req } = createMocks({
        method: 'POST',
        body: { text: 123 },
      })

      const result = await handler(req)

      expect(badRequest).toHaveBeenCalledWith('Invalid text')
      expect(result.status).toBe(400)
    })

    it('should return bad request for null text', async () => {
      parseRequestJson.mockResolvedValue({ text: null })
      badRequest.mockReturnValue(
        new Response(JSON.stringify({ error: 'Invalid text' }), { status: 400 })
      )

      const { req } = createMocks({
        method: 'POST',
        body: { text: null },
      })

      const result = await handler(req)

      expect(badRequest).toHaveBeenCalledWith('Invalid text')
      expect(result.status).toBe(400)
    })
  })

  describe('edge cases', () => {
    it('should handle very long text', async () => {
      const longText = 'a'.repeat(10000)
      const mockEntities = []
      const mockSafeResult = {
        safeText: longText,
        safeEntities: [],
      }

      parseRequestJson.mockResolvedValue({ text: longText })
      detectPiiEntities.mockResolvedValue(mockEntities)
      getSafeTextAndEntities.mockReturnValue(mockSafeResult)
      ok.mockReturnValue(
        new Response(JSON.stringify({ text: longText, entities: [] }), {
          status: 200,
        })
      )

      const { req } = createMocks({
        method: 'POST',
        body: { text: longText },
      })

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(detectPiiEntities).toHaveBeenCalledWith(longText)
    })

    it('should handle text with special characters', async () => {
      const specialText = 'Test <script>alert("xss")</script> & " \' text'
      const mockEntities = []
      const mockSafeResult = {
        safeText: specialText,
        safeEntities: [],
      }

      parseRequestJson.mockResolvedValue({ text: specialText })
      detectPiiEntities.mockResolvedValue(mockEntities)
      getSafeTextAndEntities.mockReturnValue(mockSafeResult)
      ok.mockReturnValue(
        new Response(JSON.stringify({ text: specialText, entities: [] }), {
          status: 200,
        })
      )

      const { req } = createMocks({
        method: 'POST',
        body: { text: specialText },
      })

      const result = await handler(req)

      expect(result.status).toBe(200)
    })

    it('should handle text with unicode characters', async () => {
      const unicodeText = 'Hello 世界 🌍 café'
      const mockEntities = []
      const mockSafeResult = {
        safeText: unicodeText,
        safeEntities: [],
      }

      parseRequestJson.mockResolvedValue({ text: unicodeText })
      detectPiiEntities.mockResolvedValue(mockEntities)
      getSafeTextAndEntities.mockReturnValue(mockSafeResult)
      ok.mockReturnValue(
        new Response(JSON.stringify({ text: unicodeText, entities: [] }), {
          status: 200,
        })
      )

      const { req } = createMocks({
        method: 'POST',
        body: { text: unicodeText },
      })

      const result = await handler(req)

      expect(result.status).toBe(200)
    })
  })

  describe('error handling', () => {
    it('should propagate errors from detectPiiEntities', async () => {
      const testText = 'Some text'

      parseRequestJson.mockResolvedValue({ text: testText })
      detectPiiEntities.mockRejectedValue(new Error('PII detection failed'))

      const { req } = createMocks({
        method: 'POST',
        body: { text: testText },
      })

      await expect(handler(req)).rejects.toThrow('PII detection failed')
    })

    it('should propagate errors from getSafeTextAndEntities', async () => {
      const testText = 'Some text'

      parseRequestJson.mockResolvedValue({ text: testText })
      detectPiiEntities.mockResolvedValue([])
      getSafeTextAndEntities.mockImplementation(() => {
        throw new Error('Redaction failed')
      })

      const { req } = createMocks({
        method: 'POST',
        body: { text: testText },
      })

      await expect(handler(req)).rejects.toThrow('Redaction failed')
    })
  })
})
