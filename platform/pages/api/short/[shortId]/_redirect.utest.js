import { notFound, redirect } from '@/lib/response'
import { retrieveShortURL } from '@/lib/short'

import handler from '@/pages/api/short/[shortId]/redirect'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  notFound: jest.fn(() => ({ status: 404 })),
  redirect: jest.fn((url) => ({ status: 302, location: url.toString() })),
}))

jest.mock('@/lib/short', () => ({
  retrieveShortURL: jest.fn(),
}))

describe('/api/short/[shortId]/redirect', () => {
  const makeReq = (shortId) => ({
    query: { shortId },
    method: 'GET',
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('found URL', () => {
    it('redirects to the stored URL when the shortId exists', async () => {
      const storedUrl = 'https://chatbotkit.com/original/destination'

      retrieveShortURL.mockResolvedValue(storedUrl)

      const result = await handler(makeReq('abc-123'))

      expect(retrieveShortURL).toHaveBeenCalledWith('abc-123')
      expect(redirect).toHaveBeenCalledWith(new URL(storedUrl))
      expect(result.status).toBe(302)
      expect(result.location).toBe(storedUrl)
    })

    it('passes the shortId from the query param to retrieveShortURL', async () => {
      retrieveShortURL.mockResolvedValue('https://example.com/')

      await handler(makeReq('my-unique-id'))

      expect(retrieveShortURL).toHaveBeenCalledWith('my-unique-id')
    })

    it('redirects to the exact URL stored in Redis (no transformation)', async () => {
      const exactUrl =
        'https://chatbotkit.com/path?query=value&other=123#fragment'

      retrieveShortURL.mockResolvedValue(exactUrl)

      const result = await handler(makeReq('exact-id'))

      expect(result.location).toBe(exactUrl)
    })
  })

  describe('not found', () => {
    it('returns 404 when retrieveShortURL returns null', async () => {
      retrieveShortURL.mockResolvedValue(null)

      const result = await handler(makeReq('missing-id'))

      expect(notFound).toHaveBeenCalled()
      expect(redirect).not.toHaveBeenCalled()
      expect(result.status).toBe(404)
    })

    it('does not call redirect when URL is not found', async () => {
      retrieveShortURL.mockResolvedValue(null)

      await handler(makeReq('gone'))

      expect(redirect).not.toHaveBeenCalled()
    })
  })

  describe('Redis error propagation', () => {
    it('propagates errors thrown by retrieveShortURL', async () => {
      retrieveShortURL.mockRejectedValue(new Error('Redis connection failed'))

      await expect(handler(makeReq('any-id'))).rejects.toThrow(
        'Redis connection failed'
      )
    })
  })
})
