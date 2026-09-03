/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './generate'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/header', () => ({
  getHeader: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, body: data })),
  notFound: jest.fn(() => ({ status: 404 })),
  badRequest: jest.fn((msg) => ({ status: 400, message: msg })),
  internalServerError: jest.fn(() => ({ status: 500 })),
  respondFromError: jest.fn((err) => ({
    status: 422,
    message: err?.message ?? String(err),
  })),
}))

jest.mock('@/lib/report', () => ({
  registry: {},
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq({
  reportId,
  body = {},
  contentType = 'application/json',
} = {}) {
  return {
    query: { reportId },
    json: jest.fn().mockResolvedValue(body),
  }
}

const mockSession = { user: { id: 'user_test123' } }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/platform/report/[reportId]/generate', () => {
  const { getHeader } = require('@/lib/header')
  const { registry } = require('@/lib/report')
  const {
    ok,
    notFound,
    badRequest,
    internalServerError,
    respondFromError,
  } = require('@/lib/response')
  const { captureException } = require('@/lib/error')

  beforeEach(() => {
    jest.clearAllMocks()
    getHeader.mockReturnValue('application/json')

    // reset registry to empty for each test
    Object.keys(registry).forEach((k) => delete registry[k])
  })

  // -------------------------------------------------------------------------
  // Report lookup
  // -------------------------------------------------------------------------

  describe('report lookup', () => {
    it('returns 404 when the reportId is not in the registry', async () => {
      const req = makeReq({ reportId: 'nonexistent-report-id' })

      await handler(req, mockSession)

      expect(notFound).toHaveBeenCalledTimes(1)
      expect(ok).not.toHaveBeenCalled()
    })

    it('returns 404 for an empty string reportId', async () => {
      const req = makeReq({ reportId: '' })

      await handler(req, mockSession)

      expect(notFound).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // JSON body parsing
  // -------------------------------------------------------------------------

  describe('JSON body parsing', () => {
    beforeEach(() => {
      registry['report-a'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({}) },
        output: { parseAsync: jest.fn().mockResolvedValue({ value: 1 }) },
        handler: jest.fn().mockResolvedValue({ value: 1 }),
      }
    })

    it('parses JSON body when content-type is application/json', async () => {
      const body = { periodDays: 30 }
      const req = makeReq({ reportId: 'report-a', body })

      await handler(req, mockSession)

      expect(req.json).toHaveBeenCalledTimes(1)
      expect(registry['report-a'].input.parseAsync).toHaveBeenCalledWith(body)
    })

    it('uses empty object as body when content-type is not application/json', async () => {
      getHeader.mockReturnValue('text/plain')

      const req = makeReq({ reportId: 'report-a' })

      await handler(req, mockSession)

      expect(req.json).not.toHaveBeenCalled()
      expect(registry['report-a'].input.parseAsync).toHaveBeenCalledWith({})
    })

    it('returns 400 when req.json() throws (malformed JSON)', async () => {
      const req = makeReq({ reportId: 'report-a' })

      req.json.mockRejectedValue(new SyntaxError('Unexpected token'))

      await handler(req, mockSession)

      expect(badRequest).toHaveBeenCalledWith('Invalid JSON in request body')
      expect(ok).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe('input validation', () => {
    it('calls respondFromError when input schema validation fails', async () => {
      const validationError = new Error('periodDays must be a positive integer')

      registry['report-b'] = {
        input: { parseAsync: jest.fn().mockRejectedValue(validationError) },
        output: { parseAsync: jest.fn() },
        handler: jest.fn(),
      }

      const req = makeReq({ reportId: 'report-b', body: { periodDays: -1 } })

      await handler(req, mockSession)

      expect(respondFromError).toHaveBeenCalledWith(validationError)
      expect(ok).not.toHaveBeenCalled()
    })

    it('does not call the handler when input validation fails', async () => {
      const mockHandler = jest.fn()

      registry['report-c'] = {
        input: {
          parseAsync: jest.fn().mockRejectedValue(new Error('invalid input')),
        },
        output: { parseAsync: jest.fn() },
        handler: mockHandler,
      }

      const req = makeReq({ reportId: 'report-c' })

      await handler(req, mockSession)

      expect(mockHandler).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Successful report generation
  // -------------------------------------------------------------------------

  describe('successful report generation', () => {
    it('returns 200 with the validated output on success', async () => {
      const outputData = { value: 42, change: 5 }

      registry['report-d'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({ periodDays: 30 }) },
        output: { parseAsync: jest.fn().mockResolvedValue(outputData) },
        handler: jest.fn().mockResolvedValue(outputData),
      }

      const req = makeReq({
        reportId: 'report-d',
        body: { periodDays: 30 },
      })
      const result = await handler(req, mockSession)

      expect(ok).toHaveBeenCalledWith(outputData)
      expect(result.status).toBe(200)
    })

    it('passes the session to the report handler', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ value: 0 })

      registry['report-e'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({}) },
        output: { parseAsync: jest.fn().mockResolvedValue({ value: 0 }) },
        handler: mockHandler,
      }

      const req = makeReq({ reportId: 'report-e' })

      await handler(req, mockSession)

      expect(mockHandler).toHaveBeenCalledWith(mockSession, expect.anything())
    })

    it('passes validated input to the handler, not the raw body', async () => {
      const rawBody = { periodDays: '30' } // raw has string value
      const validatedInput = { periodDays: 30 } // validated has number
      const mockHandler = jest.fn().mockResolvedValue({ value: 0 })

      registry['report-f'] = {
        input: { parseAsync: jest.fn().mockResolvedValue(validatedInput) },
        output: { parseAsync: jest.fn().mockResolvedValue({ value: 0 }) },
        handler: mockHandler,
      }

      const req = makeReq({ reportId: 'report-f', body: rawBody })

      await handler(req, mockSession)

      expect(mockHandler).toHaveBeenCalledWith(mockSession, validatedInput)
    })
  })

  // -------------------------------------------------------------------------
  // Handler and output errors
  // -------------------------------------------------------------------------

  describe('handler and output errors', () => {
    it('returns 500 when the report handler throws', async () => {
      registry['report-g'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({}) },
        output: { parseAsync: jest.fn() },
        handler: jest.fn().mockRejectedValue(new Error('database error')),
      }

      const req = makeReq({ reportId: 'report-g' })
      const result = await handler(req, mockSession)

      expect(internalServerError).toHaveBeenCalledTimes(1)
      expect(result.status).toBe(500)
    })

    it('captures the exception via captureException when handler throws', async () => {
      const handlerError = new Error('unexpected failure')

      registry['report-h'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({}) },
        output: { parseAsync: jest.fn() },
        handler: jest.fn().mockRejectedValue(handlerError),
      }

      const req = makeReq({ reportId: 'report-h' })

      await handler(req, mockSession)

      expect(captureException).toHaveBeenCalledWith(handlerError)
    })

    it('returns 500 when output schema validation fails', async () => {
      registry['report-i'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({}) },
        output: {
          parseAsync: jest
            .fn()
            .mockRejectedValue(new Error('output does not match schema')),
        },
        handler: jest.fn().mockResolvedValue({ unexpectedField: true }),
      }

      const req = makeReq({ reportId: 'report-i' })
      const result = await handler(req, mockSession)

      expect(internalServerError).toHaveBeenCalledTimes(1)
      expect(result.status).toBe(500)
    })
  })
})
