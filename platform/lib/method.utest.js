import { REQUEST_SOFT_ABORT_TIMEOUT_MS } from '@/config/server'

import {
  executeInContext,
  getContextConversation,
  setContextConversation,
} from '@/lib/context.store'
import { withAny, withFormDataPost, withGet, withPost } from '@/lib/method'

import { jest } from '@jest/globals'

import { createMocks } from 'node-mocks-http'

jest.mock('@chatbotkit-dev/buffer', () => ({
  stream2buf: jest.fn().mockResolvedValue(Buffer.from('test body')),
}))

const mockBadRequest = jest.fn(
  () => new Response('Bad Request', { status: 400 })
)

const mockMethodNotAllowed = jest.fn(
  () => new Response('Method Not Allowed', { status: 405 })
)

const mockOk = jest.fn(() => new Response('OK', { status: 200 }))

const mockSend = jest.fn(() => new Response(null, { status: 200 }))

jest.mock('@/lib/response', () => ({
  badRequest: mockBadRequest,
  methodNotAllowed: mockMethodNotAllowed,
  ok: mockOk,
  send: mockSend,
  captureUnknownException: jest.fn(),
  respondFromError: jest.fn(
    (error) => new Response(error.message, { status: 500 })
  ),
}))

const mockGetContentTypeHeader = jest.fn()
const mockGetHeader = jest.fn((req, name) => {
  const headers = req instanceof Headers ? req : req.headers

  if (headers instanceof Headers) {
    return headers.get(name)
  }

  const value = headers?.[name]

  return Array.isArray(value) ? value.join(', ') : value || null
})

jest.mock('@/lib/header', () => ({
  getContentTypeHeader: mockGetContentTypeHeader,
  getHeader: mockGetHeader,
  getTimezoneHeader: jest.fn(),
  getUserAgentHeader: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  getQuery: jest.fn(() => ({})),
}))

describe('method.js - Focused Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockGetContentTypeHeader.mockReturnValue(null)
  })

  describe('withAny wrapper function', () => {
    it('should handle successful requests', async () => {
      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )

      const wrappedHandler = withAny(mockHandler)

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).toHaveBeenCalled()
      expect(_result).toBeUndefined() // node runtime returns undefined
    })

    it('should use the context host and protocol when normalizing the request', async () => {
      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )

      const wrappedHandler = withAny(mockHandler)
      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: {
          host: 'origin.example.com',
          'x-forwarded-host': 'forwarded.example.com',
          'x-forwarded-proto': 'http',
        },
        query: {},
      })

      const previousTrustProxyHeaders = process.env.TRUST_PROXY_HEADERS

      process.env.TRUST_PROXY_HEADERS = 'true'

      try {
        await wrappedHandler(req, res)
      } finally {
        if (previousTrustProxyHeaders === undefined) {
          delete process.env.TRUST_PROXY_HEADERS
        } else {
          process.env.TRUST_PROXY_HEADERS = previousTrustProxyHeaders
        }
      }

      expect(mockHandler).toHaveBeenCalled()
      expect(mockHandler.mock.calls[0][0].url).toBe(
        'http://forwarded.example.com/test'
      )
    })

    it('should handle HEAD requests with preflight', async () => {
      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withAny(mockHandler)

      const { req, res } = createMocks({
        method: 'HEAD',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).not.toHaveBeenCalled()
      // In Node.js environment, the HEAD request should return undefined after being processed
      expect(_result).toBeUndefined()
    })

    it('should handle OPTIONS requests with preflight', async () => {
      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withAny(mockHandler)

      const { req, res } = createMocks({
        method: 'OPTIONS',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).not.toHaveBeenCalled()
      // In Node.js environment, the OPTIONS request should return undefined after being processed
      expect(_result).toBeUndefined()
    })

    it('should not inherit parent conversation context into top-level request handling', async () => {
      let conversationId = 'unset'

      const mockHandler = jest.fn(async () => {
        conversationId = getContextConversation()?.id ?? null

        return new Response('Success', { status: 200 })
      })

      const wrappedHandler = withAny(mockHandler)

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      await executeInContext(async () => {
        setContextConversation({ id: 'parent-conversation' })

        await wrappedHandler(req, res)
      })

      expect(mockHandler).toHaveBeenCalled()
      expect(conversationId).toBeNull()
    })
  })

  describe('withGet wrapper function', () => {
    it('should allow GET requests', async () => {
      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withGet(mockHandler)

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).toHaveBeenCalled()
      expect(_result).toBeUndefined()
    })

    it('should reject non-GET requests', async () => {
      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withGet(mockHandler)

      const { req, res } = createMocks({
        method: 'POST',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
        body: { test: 'data' },
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).not.toHaveBeenCalled()
      // Should return undefined in Node.js environment after processing methodNotAllowed
      expect(_result).toBeUndefined()
    })

    it('should reject PUT requests', async () => {
      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withGet(mockHandler)

      const { req, res } = createMocks({
        method: 'PUT',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
        body: { test: 'data' },
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).not.toHaveBeenCalled()
      // Should return undefined in Node.js environment after processing methodNotAllowed
      expect(_result).toBeUndefined()
    })

    it('should reject DELETE requests', async () => {
      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withGet(mockHandler)

      const { req, res } = createMocks({
        method: 'DELETE',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).not.toHaveBeenCalled()
      // Should return undefined in Node.js environment after processing methodNotAllowed
      expect(_result).toBeUndefined()
    })
  })

  describe('withPost wrapper function', () => {
    it('should allow POST requests with application/json content type', async () => {
      mockGetContentTypeHeader.mockReturnValue('application/json')

      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withPost(mockHandler)

      const { req, res } = createMocks({
        method: 'POST',
        url: '/test',
        headers: {
          host: 'example.com',
          'content-type': 'application/json',
        },
        query: {},
        body: { test: 'data' },
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).toHaveBeenCalled()
      expect(_result).toBeUndefined()
    })

    it('should reject non-POST requests', async () => {
      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withPost(mockHandler)

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).not.toHaveBeenCalled()
      // Should return undefined in Node.js environment after processing methodNotAllowed
      expect(_result).toBeUndefined()
    })

    it('should reject POST requests without application/json content type', async () => {
      mockGetContentTypeHeader.mockReturnValue('text/plain')

      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withPost(mockHandler)

      const { req, res } = createMocks({
        method: 'POST',
        url: '/test',
        headers: {
          host: 'example.com',
          'content-type': 'text/plain',
        },
        query: {},
        body: 'test data',
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).not.toHaveBeenCalled()
      // Should return undefined in Node.js environment after processing badRequest
      expect(_result).toBeUndefined()
    })

    it('should reject POST requests with no content type', async () => {
      mockGetContentTypeHeader.mockReturnValue(null)

      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withPost(mockHandler)

      const { req, res } = createMocks({
        method: 'POST',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
        body: 'test data',
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).not.toHaveBeenCalled()
      // Should return undefined in Node.js environment after processing badRequest
      expect(_result).toBeUndefined()
    })

    it('should reject POST requests with multipart/form-data content type', async () => {
      mockGetContentTypeHeader.mockReturnValue('multipart/form-data')

      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withPost(mockHandler)

      const { req, res } = createMocks({
        method: 'POST',
        url: '/test',
        headers: {
          host: 'example.com',
          'content-type': 'multipart/form-data',
        },
        query: {},
        body: 'form data',
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).not.toHaveBeenCalled()
      // Should return undefined in Node.js environment after processing badRequest
      expect(_result).toBeUndefined()
    })
  })

  describe('withFormDataPost wrapper function', () => {
    it('should allow POST requests with multipart/form-data content type', async () => {
      mockGetContentTypeHeader.mockReturnValue('multipart/form-data')

      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withFormDataPost(mockHandler)

      const { req, res } = createMocks({
        method: 'POST',
        url: '/test',
        headers: {
          host: 'example.com',
          'content-type': 'multipart/form-data',
        },
        query: {},
        body: 'form data',
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).toHaveBeenCalled()
      expect(_result).toBeUndefined()
    })

    it('should reject non-POST requests', async () => {
      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withFormDataPost(mockHandler)

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).not.toHaveBeenCalled()
      // Should return undefined in Node.js environment after processing methodNotAllowed
      expect(_result).toBeUndefined()
    })

    it('should reject POST requests without multipart/form-data content type', async () => {
      mockGetContentTypeHeader.mockReturnValue('application/json')

      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withFormDataPost(mockHandler)

      const { req, res } = createMocks({
        method: 'POST',
        url: '/test',
        headers: {
          host: 'example.com',
          'content-type': 'application/json',
        },
        query: {},
        body: { test: 'data' },
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).not.toHaveBeenCalled()
      // Should return undefined in Node.js environment after processing badRequest
      expect(_result).toBeUndefined()
    })

    it('should reject POST requests with no content type', async () => {
      mockGetContentTypeHeader.mockReturnValue(null)

      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withFormDataPost(mockHandler)

      const { req, res } = createMocks({
        method: 'POST',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
        body: 'test data',
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).not.toHaveBeenCalled()
      // Should return undefined in Node.js environment after processing badRequest
      expect(_result).toBeUndefined()
    })

    it('should reject POST requests with text/plain content type', async () => {
      mockGetContentTypeHeader.mockReturnValue('text/plain')

      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withFormDataPost(mockHandler)

      const { req, res } = createMocks({
        method: 'POST',
        url: '/test',
        headers: {
          host: 'example.com',
          'content-type': 'text/plain',
        },
        query: {},
        body: 'test data',
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).not.toHaveBeenCalled()
      // Should return undefined in Node.js environment after processing badRequest
      expect(_result).toBeUndefined()
    })
  })

  describe('Request object handling', () => {
    it('should handle standard Request object in Node.js runtime (App Router)', async () => {
      // @note this test verifies regression fix
      // App Router routes can run in Node.js runtime while still receiving
      // a standard Request object (not NextApiRequest)
      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withAny(mockHandler)

      const mockRequest = new Request('https://example.com/test?foo=bar', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: 'example.com',
        },
        body: JSON.stringify({ test: 'data' }),
        duplex: 'half',
      })

      const result = await wrappedHandler(mockRequest)

      expect(mockHandler).toHaveBeenCalled()
      expect(result).toBeInstanceOf(Response)
    })

    it('should preserve abort signal for standard Request object in Node.js runtime', async () => {
      const abortController = new AbortController()

      const wrappedHandler = withAny(async (req) => {
        const aborted = await Promise.race([
          new Promise((resolve) => {
            req.signal.addEventListener('abort', () => resolve(true), {
              once: true,
            })
          }),
          new Promise((resolve) => setTimeout(() => resolve(false), 50)),
        ])

        return new Response(JSON.stringify({ aborted }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      })

      const responsePromise = wrappedHandler(
        new Request('https://example.com/test', {
          method: 'GET',
          headers: { host: 'example.com' },
          signal: abortController.signal,
        })
      )

      abortController.abort()

      const response = await responsePromise
      const data = await response.json()

      expect(data.aborted).toBe(true)
    })

    it('should soft-abort standard Request before platform timeout', async () => {
      jest.useFakeTimers()

      try {
        const wrappedHandler = withAny(async (req) => {
          const reason = await new Promise((resolve) => {
            req.signal.addEventListener(
              'abort',
              () => resolve(req.signal.reason),
              { once: true }
            )
          })

          return new Response(
            JSON.stringify({
              aborted: req.signal.aborted,
              reasonName: reason?.name,
              reasonMessage: reason?.message,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          )
        })

        const responsePromise = wrappedHandler(
          new Request('https://example.com/test', {
            method: 'GET',
            headers: { host: 'example.com' },
          })
        )

        jest.advanceTimersByTime(REQUEST_SOFT_ABORT_TIMEOUT_MS)

        const response = await responsePromise
        const data = await response.json()

        expect(data).toEqual({
          aborted: true,
          reasonName: 'TimeoutError',
          reasonMessage: 'Request soft abort timeout reached',
        })
      } finally {
        jest.useRealTimers()
      }
    })

    it('should expose soft and hard signals independently on a soft timeout', async () => {
      jest.useFakeTimers()

      try {
        const wrappedHandler = withAny(async (req) => {
          await new Promise((resolve) => {
            req.signal.addEventListener('abort', resolve, { once: true })
          })

          return new Response(
            JSON.stringify({
              softAborted: req.softSignal.aborted,
              hardAborted: req.hardSignal.aborted,
              convenienceReason: req.signal.reason?.name,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          )
        })

        const responsePromise = wrappedHandler(
          new Request('https://example.com/test', {
            method: 'GET',
            headers: { host: 'example.com' },
          })
        )

        jest.advanceTimersByTime(REQUEST_SOFT_ABORT_TIMEOUT_MS)

        const response = await responsePromise
        const data = await response.json()

        expect(data).toEqual({
          softAborted: true,
          hardAborted: false,
          convenienceReason: 'TimeoutError',
        })
      } finally {
        jest.useRealTimers()
      }
    })

    it('should expose soft and hard signals independently on a hard abort', async () => {
      jest.useFakeTimers()

      try {
        const parentAbortController = new AbortController()

        const wrappedHandler = withAny(async (req) => {
          await new Promise((resolve) => {
            req.signal.addEventListener('abort', resolve, { once: true })
          })

          return new Response(
            JSON.stringify({
              softAborted: req.softSignal.aborted,
              hardAborted: req.hardSignal.aborted,
              convenienceReason: req.signal.reason?.name,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          )
        })

        const responsePromise = wrappedHandler(
          new Request('https://example.com/test', {
            method: 'GET',
            headers: { host: 'example.com' },
            signal: parentAbortController.signal,
          })
        )

        parentAbortController.abort(
          new DOMException('Client went away', 'AbortError')
        )

        const response = await responsePromise
        const data = await response.json()

        expect(data).toEqual({
          softAborted: false,
          hardAborted: true,
          convenienceReason: 'AbortError',
        })
      } finally {
        jest.useRealTimers()
      }
    })

    it('should preserve standard Request abort reason when soft timeout fires later', async () => {
      jest.useFakeTimers()

      try {
        const parentAbortController = new AbortController()
        const parentReason = new DOMException('Client went away', 'AbortError')

        const wrappedHandler = withAny(async (req) => {
          const aborts = []

          req.signal.addEventListener('abort', () => {
            aborts.push(req.signal.reason)
          })

          await new Promise((resolve) => {
            req.signal.addEventListener('abort', resolve, { once: true })
          })

          jest.advanceTimersByTime(REQUEST_SOFT_ABORT_TIMEOUT_MS)

          return new Response(
            JSON.stringify({
              abortCount: aborts.length,
              reasonName: req.signal.reason?.name,
              reasonMessage: req.signal.reason?.message,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          )
        })

        const responsePromise = wrappedHandler(
          new Request('https://example.com/test', {
            method: 'GET',
            headers: { host: 'example.com' },
            signal: parentAbortController.signal,
          })
        )

        parentAbortController.abort(parentReason)

        const response = await responsePromise
        const data = await response.json()

        expect(data).toEqual({
          abortCount: 1,
          reasonName: 'AbortError',
          reasonMessage: 'Client went away',
        })
      } finally {
        jest.useRealTimers()
      }
    })

    it('should preserve soft timeout reason when standard Request aborts later', async () => {
      jest.useFakeTimers()

      try {
        const parentAbortController = new AbortController()
        const parentReason = new DOMException('Client went away', 'AbortError')

        const wrappedHandler = withAny(async (req) => {
          const aborts = []

          req.signal.addEventListener('abort', () => {
            aborts.push(req.signal.reason)
          })

          await new Promise((resolve) => {
            req.signal.addEventListener('abort', resolve, { once: true })
          })

          parentAbortController.abort(parentReason)

          return new Response(
            JSON.stringify({
              abortCount: aborts.length,
              reasonName: req.signal.reason?.name,
              reasonMessage: req.signal.reason?.message,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          )
        })

        const responsePromise = wrappedHandler(
          new Request('https://example.com/test', {
            method: 'GET',
            headers: { host: 'example.com' },
            signal: parentAbortController.signal,
          })
        )

        jest.advanceTimersByTime(REQUEST_SOFT_ABORT_TIMEOUT_MS)

        const response = await responsePromise
        const data = await response.json()

        expect(data).toEqual({
          abortCount: 1,
          reasonName: 'TimeoutError',
          reasonMessage: 'Request soft abort timeout reached',
        })
      } finally {
        jest.useRealTimers()
      }
    })

    it('should propagate NextApiRequest disconnect to Request signal', async () => {
      let aborted = false

      const wrappedHandler = withAny(async (req) => {
        aborted = await Promise.race([
          new Promise((resolve) => {
            req.signal.addEventListener('abort', () => resolve(true), {
              once: true,
            })
          }),
          new Promise((resolve) => setTimeout(() => resolve(false), 50)),
        ])

        return new Response(null, { status: 200 })
      })

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      const responsePromise = wrappedHandler(req, res)

      req.emit('aborted')

      await responsePromise

      expect(aborted).toBe(true)
    })

    it('should soft-abort NextApiRequest before platform timeout', async () => {
      jest.useFakeTimers()

      try {
        let abortReason

        const wrappedHandler = withAny(async (req) => {
          abortReason = await new Promise((resolve) => {
            req.signal.addEventListener(
              'abort',
              () => resolve(req.signal.reason),
              { once: true }
            )
          })

          return new Response(null, { status: 200 })
        })

        const { req, res } = createMocks({
          method: 'GET',
          url: '/test',
          headers: { host: 'example.com' },
          query: {},
        })

        const responsePromise = wrappedHandler(req, res)

        jest.advanceTimersByTime(REQUEST_SOFT_ABORT_TIMEOUT_MS)

        await responsePromise

        expect(abortReason).toBeInstanceOf(DOMException)
        expect(abortReason.name).toBe('TimeoutError')
        expect(abortReason.message).toBe('Request soft abort timeout reached')
      } finally {
        jest.useRealTimers()
      }
    })

    it('should not re-abort NextApiRequest after disconnect wins over soft timeout', async () => {
      jest.useFakeTimers()

      try {
        let abortCount = 0
        let abortReason

        const wrappedHandler = withAny(async (req) => {
          req.signal.addEventListener('abort', () => {
            abortCount++
            abortReason = req.signal.reason
          })

          await new Promise((resolve) => {
            req.signal.addEventListener('abort', resolve, { once: true })
          })

          jest.advanceTimersByTime(REQUEST_SOFT_ABORT_TIMEOUT_MS)

          return new Response(null, { status: 200 })
        })

        const { req, res } = createMocks({
          method: 'GET',
          url: '/test',
          headers: { host: 'example.com' },
          query: {},
        })

        const responsePromise = wrappedHandler(req, res)

        req.emit('aborted')

        await responsePromise

        expect(abortCount).toBe(1)
        expect(abortReason).toBeInstanceOf(DOMException)
        expect(abortReason.name).toBe('AbortError')
      } finally {
        jest.useRealTimers()
      }
    })

    it('should not re-abort NextApiRequest after soft timeout wins over disconnect', async () => {
      jest.useFakeTimers()

      try {
        let abortCount = 0
        let abortReason

        const wrappedHandler = withAny(async (req) => {
          req.signal.addEventListener('abort', () => {
            abortCount++
            abortReason = req.signal.reason
          })

          await new Promise((resolve) => {
            req.signal.addEventListener('abort', resolve, { once: true })
          })

          return new Response(null, { status: 200 })
        })

        const { req, res } = createMocks({
          method: 'GET',
          url: '/test',
          headers: { host: 'example.com' },
          query: {},
        })

        const responsePromise = wrappedHandler(req, res)

        jest.advanceTimersByTime(REQUEST_SOFT_ABORT_TIMEOUT_MS)

        req.emit('aborted')

        await responsePromise

        expect(abortCount).toBe(1)
        expect(abortReason).toBeInstanceOf(DOMException)
        expect(abortReason.name).toBe('TimeoutError')
        expect(abortReason.message).toBe('Request soft abort timeout reached')
      } finally {
        jest.useRealTimers()
      }
    })
  })

  describe('Streaming response body cleanup (standard Request path)', () => {
    it('should stream multi-chunk response bodies intact through the cleanup wrapper', async () => {
      const chunks = ['one', 'two', 'three']

      const wrappedHandler = withAny(async () => {
        const encoder = new TextEncoder()

        const body = new ReadableStream({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(encoder.encode(chunk))
            }

            controller.close()
          },
        })

        return new Response(body, {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
      })

      const response = await wrappedHandler(
        new Request('https://example.com/test', {
          method: 'GET',
          headers: { host: 'example.com' },
        })
      )

      const text = await response.text()

      expect(text).toBe('onetwothree')
    })

    it('should clear the soft-abort timer once the response body is fully drained', async () => {
      jest.useFakeTimers()

      try {
        let capturedSignal

        const wrappedHandler = withAny(async (req) => {
          capturedSignal = req.signal

          const body = new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('payload'))

              controller.close()
            },
          })

          return new Response(body, { status: 200 })
        })

        const response = await wrappedHandler(
          new Request('https://example.com/test', {
            method: 'GET',
            headers: { host: 'example.com' },
          })
        )

        // @note fully draining the wrapped body should run cleanup and clear
        // the soft-abort timer, so advancing past the timeout must not abort
        await response.text()

        jest.advanceTimersByTime(REQUEST_SOFT_ABORT_TIMEOUT_MS * 2)

        expect(capturedSignal.aborted).toBe(false)
      } finally {
        jest.useRealTimers()
      }
    })

    // @note cancel-on-disconnect propagation to the source stream is verified
    // to work in the real Node runtime but is not asserted here: the jsdom
    // stream polyfill does not drive the source cancel algorithm through a
    // re-wrapped ReadableStream. timer cleanup on cancel uses the same
    // cleanup() path as the drain test above
  })

  describe('Set-Cookie header handling in Node.js runtime', () => {
    it('should correctly forward multiple Set-Cookie headers', async () => {
      const mockHandler = jest.fn(async () => {
        const headers = new Headers()

        headers.append(
          'Set-Cookie',
          'cookie1=value1; Path=/; Secure; SameSite=Lax'
        )
        headers.append(
          'Set-Cookie',
          'cookie2=value2; Path=/; Secure; SameSite=Lax'
        )

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers,
        })
      })

      const wrappedHandler = withAny(mockHandler)

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      await wrappedHandler(req, res)

      expect(mockHandler).toHaveBeenCalled()

      const setCookieHeader = res.getHeader('Set-Cookie')

      expect(Array.isArray(setCookieHeader)).toBe(true)
      expect(setCookieHeader).toHaveLength(2)
      expect(setCookieHeader).toContain(
        'cookie1=value1; Path=/; Secure; SameSite=Lax'
      )
      expect(setCookieHeader).toContain(
        'cookie2=value2; Path=/; Secure; SameSite=Lax'
      )
    })

    it('should correctly forward a single Set-Cookie header', async () => {
      const mockHandler = jest.fn(async () => {
        const headers = new Headers()

        headers.append('Set-Cookie', 'session=abc123; Path=/; HttpOnly; Secure')

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers,
        })
      })

      const wrappedHandler = withAny(mockHandler)

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      await wrappedHandler(req, res)

      const setCookieHeader = res.getHeader('Set-Cookie')

      expect(setCookieHeader).toEqual([
        'session=abc123; Path=/; HttpOnly; Secure',
      ])
    })

    it('should not set Set-Cookie header when none are present', async () => {
      const mockHandler = jest.fn(async () => {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })

      const wrappedHandler = withAny(mockHandler)

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      await wrappedHandler(req, res)

      const setCookieHeader = res.getHeader('Set-Cookie')

      expect(setCookieHeader).toBeUndefined()
    })

    it('should forward Set-Cookie headers alongside other headers', async () => {
      const mockHandler = jest.fn(async () => {
        const headers = new Headers()

        headers.set('X-Custom-Header', 'custom-value')
        headers.append(
          'Set-Cookie',
          'cookie1=value1; Path=/; Secure; SameSite=Lax'
        )
        headers.append(
          'Set-Cookie',
          'cookie2=value2; Path=/; Secure; SameSite=Lax'
        )

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers,
        })
      })

      const wrappedHandler = withAny(mockHandler)

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      await wrappedHandler(req, res)

      expect(res.getHeader('X-Custom-Header')).toBe('custom-value')

      const setCookieHeader = res.getHeader('Set-Cookie')

      expect(Array.isArray(setCookieHeader)).toBe(true)
      expect(setCookieHeader).toHaveLength(2)
    })

    it('should correctly forward cookie-clearing Set-Cookie headers', async () => {
      const mockHandler = jest.fn(async () => {
        const headers = new Headers()

        headers.append(
          'Set-Cookie',
          'cookie1=; Path=/; Secure; SameSite=Lax; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        )
        headers.append(
          'Set-Cookie',
          'cookie2=; Path=/; Secure; SameSite=Lax; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        )

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers,
        })
      })

      const wrappedHandler = withAny(mockHandler)

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      await wrappedHandler(req, res)

      const setCookieHeader = res.getHeader('Set-Cookie')

      expect(Array.isArray(setCookieHeader)).toBe(true)
      expect(setCookieHeader).toHaveLength(2)
      expect(setCookieHeader[0]).toContain('expires=Thu, 01 Jan 1970')
      expect(setCookieHeader[1]).toContain('expires=Thu, 01 Jan 1970')
    })
  })

  describe('Error handling', () => {
    it('should handle exceptions thrown by handlers', async () => {
      const error = new Error('Test error')
      const mockHandler = jest.fn(async () => {
        throw error
      })
      const wrappedHandler = withAny(mockHandler)

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      // This should not throw, but handle the error gracefully
      const _result = await wrappedHandler(req, res)

      expect(mockHandler).toHaveBeenCalled()
      expect(_result).toBeUndefined() // Should complete without throwing
    })
  })

  describe('Request processing edge cases', () => {
    it('should handle requests with query parameters', async () => {
      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withAny(mockHandler)

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: { param1: 'value1', param2: 'value2' },
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).toHaveBeenCalled()
      expect(_result).toBeUndefined()
    })

    it('should handle requests with special headers', async () => {
      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withAny(mockHandler)

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: {
          host: 'example.com',
          authorization: 'Bearer token123',
          'x-custom-header': 'custom-value',
          'user-agent': 'test-agent/1.0',
        },
        query: {},
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).toHaveBeenCalled()
      expect(_result).toBeUndefined()
    })

    it('should handle POST requests with complex JSON body', async () => {
      mockGetContentTypeHeader.mockReturnValue('application/json')

      const mockHandler = jest.fn(
        async () => new Response('Success', { status: 200 })
      )
      const wrappedHandler = withPost(mockHandler)

      const complexData = {
        user: { id: 1, name: 'Test User' },
        items: [
          { id: 1, value: 'item1' },
          { id: 2, value: 'item2' },
        ],
        metadata: { timestamp: 1234567890, version: '1.0' },
      }

      const { req, res } = createMocks({
        method: 'POST',
        url: '/test',
        headers: {
          host: 'example.com',
          'content-type': 'application/json',
        },
        query: {},
        body: complexData,
      })

      const _result = await wrappedHandler(req, res)

      expect(mockHandler).toHaveBeenCalled()
      expect(_result).toBeUndefined()
    })
  })

  describe('abort signal propagation', () => {
    // @note node-mocks-http MockRequest extends Readable and supports .on/.emit
    // properly; MockResponse does not implement a real EventEmitter so the
    // res.close path cannot be verified in unit tests (covered by integration)

    it('should propagate req close event to Request signal (NextApiRequest path)', async () => {
      let aborted = false

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      const responsePromise = withAny(async (req) => {
        aborted = await Promise.race([
          new Promise((resolve) => {
            req.signal.addEventListener('abort', () => resolve(true), {
              once: true,
            })
          }),
          new Promise((resolve) => setTimeout(() => resolve(false), 50)),
        ])

        return new Response(null, { status: 200 })
      })(req, res)

      req.emit('close')

      await responsePromise

      expect(aborted).toBe(true)
    })

    it('should not call abort more than once when multiple req events fire (NextApiRequest path)', async () => {
      let abortCount = 0

      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      const responsePromise = withAny(async (req) => {
        req.signal.addEventListener('abort', () => abortCount++, { once: true })

        await Promise.race([
          new Promise((resolve) => {
            req.signal.addEventListener('abort', () => resolve(true), {
              once: true,
            })
          }),
          new Promise((resolve) => setTimeout(() => resolve(false), 50)),
        ])

        return new Response(null, { status: 200 })
      })(req, res)

      req.emit('aborted')
      req.emit('close')

      await responsePromise

      expect(abortCount).toBe(1)
    })

    it('should clean up req listeners after response completes (NextApiRequest path)', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      await withAny(async () => new Response(null, { status: 200 }))(req, res)

      expect(req.listenerCount('close')).toBe(0)
      expect(req.listenerCount('aborted')).toBe(0)
    })
  })

  describe('Streaming response body piping (NextApiRequest path)', () => {
    it('should pipe ReadableStream chunks via res.write and call res.end', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      const writeSpy = jest.spyOn(res, 'write')

      const encoder = new TextEncoder()

      await withAny(async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('chunk1'))
            controller.enqueue(encoder.encode('chunk2'))
            controller.close()
          },
        })

        return new Response(stream, { status: 200 })
      })(req, res)

      expect(writeSpy).toHaveBeenCalledTimes(2)
      expect(Buffer.from(writeSpy.mock.calls[0][0]).toString()).toBe('chunk1')
      expect(Buffer.from(writeSpy.mock.calls[1][0]).toString()).toBe('chunk2')
      expect(res._isEndCalled()).toBe(true)
    })

    it('should call res.end even when stream has no body', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      await withAny(async () => new Response(null, { status: 200 }))(req, res)

      expect(res._isEndCalled()).toBe(true)
    })

    it('should clean up abort listeners after stream is fully piped', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      const encoder = new TextEncoder()

      await withAny(async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data'))
            controller.close()
          },
        })

        return new Response(stream, { status: 200 })
      })(req, res)

      // listeners must be gone after the piping loop's finally block runs
      expect(req.listenerCount('close')).toBe(0)
      expect(req.listenerCount('aborted')).toBe(0)
    })
  })

  describe('DO_NOT_USE 599 response path (NextApiRequest path)', () => {
    it('should return undefined and skip writing to res for 599 DO_NOT_USE', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/test',
        headers: { host: 'example.com' },
        query: {},
      })

      const writeSpy = jest.spyOn(res, 'write')

      const result = await withAny(async () => {
        return new Response(null, { status: 599, statusText: 'DO_NOT_USE' })
      })(req, res)

      expect(result).toBeUndefined()
      expect(writeSpy).not.toHaveBeenCalled()
      expect(res._isEndCalled()).toBe(false)
    })
  })
})
