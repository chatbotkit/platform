/**
 * @jest-environment node
 */
import { captureException } from '@/lib/error'
import fetch from '@/lib/egress.fetch'
import { toaAsync } from '@/lib/it'
import { parseRequestJson } from '@/lib/request'
import {
  badRequest,
  methodNotAllowed,
  ok,
  respondFromError,
} from '@/lib/response'
import { getUploadFile } from '@/lib/upload'

import handler from '@/pages/api/auxiliary/dataset/chunk'

const mockChunk = jest.fn()

jest.mock('@chatbotkit-dev/file/index2', () => ({
  chunk: (...args) => mockChunk(...args),
}))

jest.mock('@/lib/dataurl.parse', () => ({
  parseDataURL: jest.fn((dataUrl) => {
    // minimal base64 PNG decode: return some bytes and a type
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/)

    if (!match) {
      throw new Error('invalid data URL')
    }

    return { type: match[1], data: Buffer.from(match[2], 'base64') }
  }),
}))

jest.mock('@/lib/debug', () => {
  const noop = Object.assign(
    jest.fn(() => noop),
    { log: jest.fn() }
  )

  return noop
})

jest.mock('@/lib/error', () => {
  class SystemError extends Error {
    constructor(message, code) {
      super(message)
      this.code = code
    }
  }

  return {
    captureException: jest.fn(),
    SystemError,
    UserInputError: class UserInputError extends SystemError {},
  }
})

jest.mock('@/lib/env', () => ({
  ...jest.requireActual('@/lib/env'),
  isDevelopment: false,
}))

jest.mock('@/lib/egress.fetch', () =>
  jest.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['data'], { type: 'text/plain' })),
  })
)

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

// @note the chunk route requires an authenticated session like every other
// auxiliary route; the tests bind a mock session and exercise the body
jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => (req) => fn(req, { user: { id: 'test-user-id' } }),
}))

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, body: data })),
  badRequest: jest.fn((msg) => ({ status: 400, message: msg })),
  methodNotAllowed: jest.fn(() => ({ status: 405 })),
  respondFromError: jest.fn((err) => ({ status: 422, error: err })),
}))

jest.mock('@/lib/upload', () => ({
  getUploadFile: jest.fn(),
}))

jest.mock('@/lib/it', () => ({
  toaAsync: jest.fn(),
}))

const makeReq = (method, contentType, body = null, headers = {}) => ({
  method,
  headers: {
    'content-type': contentType,
    ...headers,
  },
  body,
  arrayBuffer: jest.fn(),
})

describe('/api/auxiliary/dataset/chunk', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockChunk.mockReturnValue([])
    toaAsync.mockResolvedValue([{ text: 'chunk1' }, { text: 'chunk2' }])
  })

  describe('HTTP method guard', () => {
    it('returns 405 for GET requests', async () => {
      const req = makeReq('GET', 'application/json')

      const result = await handler(req)

      expect(methodNotAllowed).toHaveBeenCalled()
      expect(result.status).toBe(405)
    })

    it('returns 405 for DELETE requests', async () => {
      const req = makeReq('DELETE', 'application/json')

      const result = await handler(req)

      expect(methodNotAllowed).toHaveBeenCalled()
      expect(result.status).toBe(405)
    })
  })

  describe('application/json - URL file', () => {
    it('fetches the URL and returns chunked items on success', async () => {
      const req = makeReq('POST', 'application/json')

      parseRequestJson.mockResolvedValue({
        file: 'https://example.com/document.pdf',
        size: 500,
        overlap: 50,
      })

      fetch.mockResolvedValue({
        ok: true,
        blob: () =>
          Promise.resolve(new Blob(['content'], { type: 'text/plain' })),
      })

      const result = await handler(req)

      expect(fetch).toHaveBeenCalledWith('https://example.com/document.pdf')
      expect(ok).toHaveBeenCalled()
      expect(result.status).toBe(200)
      expect(result.body.items).toHaveLength(2)
    })

    it('returns badRequest when the remote fetch fails', async () => {
      const req = makeReq('POST', 'application/json')

      parseRequestJson.mockResolvedValue({
        file: 'https://example.com/missing.pdf',
      })

      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const result = await handler(req)

      expect(badRequest).toHaveBeenCalledWith(expect.stringContaining('404'))
      expect(result.status).toBe(400)
    })

    it('refuses a private-IP literal URL before any connection is attempted', async () => {
      const req = makeReq('POST', 'application/json')

      parseRequestJson.mockResolvedValue({
        file: 'http://10.0.0.1/x',
      })

      let captured

      fetch.mockImplementation((...args) =>
        jest
          .requireActual('@/lib/egress.fetch')
          .default(...args)
          .catch((e) => {
            captured = e

            throw e
          })
      )

      await expect(handler(req)).rejects.toThrow()

      expect(fetch).toHaveBeenCalledWith('http://10.0.0.1/x')
      expect(String(captured?.cause?.message)).toMatch(
        /egress to 10\.0\.0\.1 is not allowed: not a public address/
      )
      expect(toaAsync).not.toHaveBeenCalled()
      expect(ok).not.toHaveBeenCalled()
    })

    it('passes size and overlap options to the chunk function', async () => {
      const req = makeReq('POST', 'application/json')

      parseRequestJson.mockResolvedValue({
        file: 'https://example.com/doc.txt',
        size: 1000,
        overlap: 100,
        model: 'gpt-4',
      })

      fetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['x'])),
      })

      await handler(req)

      // chunk() receives the blob and options; toaAsync receives the generator
      const [, options] = mockChunk.mock.calls[0]

      expect(options).toMatchObject({
        size: 1000,
        overlap: 100,
        model: 'gpt-4',
      })
    })
  })

  describe('application/json - data URL file', () => {
    it('parses the data URL and returns chunked items', async () => {
      const req = makeReq('POST', 'application/json')

      // minimal valid base64 data URL
      const dataUrl =
        'data:text/plain;base64,' +
        Buffer.from('hello world').toString('base64')

      parseRequestJson.mockResolvedValue({ file: dataUrl })

      const result = await handler(req)

      expect(fetch).not.toHaveBeenCalled()
      expect(ok).toHaveBeenCalled()
      expect(result.status).toBe(200)
    })
  })

  describe('application/json - invalid file field', () => {
    it('returns badRequest for an unrecognized file format', async () => {
      const req = makeReq('POST', 'application/json')

      // ftp:// URI passes Joi validation but matches neither https:// nor data: patterns
      parseRequestJson.mockResolvedValue({ file: 'ftp://example.com/file.pdf' })

      const result = await handler(req)

      expect(badRequest).toHaveBeenCalled()
      expect(result.status).toBe(400)
    })

    it('returns respondFromError for Joi validation failure', async () => {
      const req = makeReq('POST', 'application/json')

      // size below minimum (1)
      parseRequestJson.mockResolvedValue({
        file: 'https://example.com/doc.txt',
        size: -5,
      })

      const result = await handler(req)

      expect(respondFromError).toHaveBeenCalled()
      expect(result.status).toBe(422)
    })
  })

  describe('multipart/form-data', () => {
    it('chunks an uploaded file and returns items', async () => {
      const req = makeReq('POST', 'multipart/form-data', null, {
        'x-chunk-size': '500',
        'x-chunk-overlap': '50',
      })

      const fakeFile = {
        arrayBuffer: () => Promise.resolve(Buffer.from('file content')),
        type: 'text/plain',
      }

      getUploadFile.mockResolvedValue(fakeFile)

      const result = await handler(req)

      expect(ok).toHaveBeenCalled()
      expect(result.status).toBe(200)
      expect(result.body.items).toHaveLength(2)
    })

    it('returns badRequest when x-chunk-size is missing', async () => {
      const req = makeReq('POST', 'multipart/form-data', null, {
        'x-chunk-overlap': '50',
      })

      const result = await handler(req)

      expect(badRequest).toHaveBeenCalledWith(
        expect.stringContaining('x-chunk-size')
      )
      expect(result.status).toBe(400)
    })

    it('returns badRequest when x-chunk-size is zero', async () => {
      const req = makeReq('POST', 'multipart/form-data', null, {
        'x-chunk-size': '0',
        'x-chunk-overlap': '0',
      })

      await handler(req)

      expect(badRequest).toHaveBeenCalledWith(
        expect.stringContaining('x-chunk-size')
      )
    })

    it('returns badRequest when x-chunk-overlap is negative', async () => {
      const req = makeReq('POST', 'multipart/form-data', null, {
        'x-chunk-size': '500',
        'x-chunk-overlap': '-1',
      })

      await handler(req)

      expect(badRequest).toHaveBeenCalledWith(
        expect.stringContaining('x-chunk-overlap')
      )
    })
  })

  describe('octet-stream / raw binary', () => {
    it('reads the raw body and returns chunked items', async () => {
      const req = makeReq('POST', 'application/octet-stream', null, {
        'x-chunk-size': '200',
        'x-chunk-overlap': '20',
      })

      req.arrayBuffer = jest.fn().mockResolvedValue(Buffer.from('binary data'))

      const result = await handler(req)

      expect(ok).toHaveBeenCalled()
      expect(result.status).toBe(200)
    })

    it('returns badRequest when x-chunk-size header is absent', async () => {
      const req = makeReq('POST', 'application/octet-stream', null, {
        'x-chunk-overlap': '20',
      })

      await handler(req)

      expect(badRequest).toHaveBeenCalledWith(
        expect.stringContaining('x-chunk-size')
      )
    })
  })

  describe('chunking errors', () => {
    it('returns empty items array for unsupported content type errors', async () => {
      const req = makeReq('POST', 'application/json')

      parseRequestJson.mockResolvedValue({
        file: 'https://example.com/weird.xyz',
      })

      fetch.mockResolvedValue({
        ok: true,
        blob: () =>
          Promise.resolve(
            new Blob(['content'], { type: 'application/x-weird' })
          ),
      })

      toaAsync.mockRejectedValue(
        new Error('Unsupported content type: application/x-weird')
      )

      await handler(req)

      expect(badRequest).toHaveBeenCalledWith(
        expect.stringContaining('Unsupported content type')
      )
    })

    it('captures unexpected chunk errors and returns empty items', async () => {
      const req = makeReq('POST', 'application/json')

      parseRequestJson.mockResolvedValue({
        file: 'https://example.com/doc.pdf',
      })

      fetch.mockResolvedValue({
        ok: true,
        blob: () =>
          Promise.resolve(new Blob(['content'], { type: 'application/pdf' })),
      })

      const unexpectedError = new Error('Internal chunking failure')

      toaAsync.mockRejectedValue(unexpectedError)

      const result = await handler(req)

      expect(captureException).toHaveBeenCalledWith(unexpectedError)
      expect(ok).toHaveBeenCalledWith({ items: [] })
      expect(result.status).toBe(200)
    })
  })
})
