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

jest.mock('@/lib/header', () => ({
  getHeader: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, body: data })),
  badRequest: jest.fn((msg) => ({ status: 400, message: msg })),
  internalServerError: jest.fn(() => ({ status: 500 })),
  captureUnknownException: jest.fn(),
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

function makeReq(body) {
  return {
    json: jest.fn().mockResolvedValue(body),
    query: {},
  }
}

const mockSession = { user: { id: 'user_batch123' } }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/platform/report/generate (batch)', () => {
  const { getHeader } = require('@/lib/header')
  const { registry } = require('@/lib/report')
  const { ok, badRequest } = require('@/lib/response')

  beforeEach(() => {
    jest.clearAllMocks()
    getHeader.mockReturnValue('application/json')

    // reset registry to empty for each test
    Object.keys(registry).forEach((k) => delete registry[k])
  })

  // -------------------------------------------------------------------------
  // Body validation
  // -------------------------------------------------------------------------

  describe('body validation', () => {
    it('returns 400 when body is null', async () => {
      const req = makeReq(null)

      await handler(req, mockSession)

      expect(badRequest).toHaveBeenCalledWith('Request body must be an object')
      expect(ok).not.toHaveBeenCalled()
    })

    it('returns 400 when body is an array', async () => {
      const req = makeReq([{ reportId: 'some-id' }])

      await handler(req, mockSession)

      expect(badRequest).toHaveBeenCalledWith('Request body must be an object')
    })

    it('returns 400 when body is a primitive number', async () => {
      const req = makeReq(42)

      await handler(req, mockSession)

      expect(badRequest).toHaveBeenCalledWith('Request body must be an object')
    })

    it('returns 400 when body is a string', async () => {
      const req = makeReq('not-an-object')

      await handler(req, mockSession)

      expect(badRequest).toHaveBeenCalledWith('Request body must be an object')
    })

    it('accepts an empty object body and returns an empty result set', async () => {
      const req = makeReq({})
      const result = await handler(req, mockSession)

      expect(ok).toHaveBeenCalledWith({})
      expect(result.status).toBe(200)
    })
  })

  // -------------------------------------------------------------------------
  // Unknown report IDs
  // -------------------------------------------------------------------------

  describe('unknown report IDs', () => {
    it('returns inline error for unknown report ID (not 404)', async () => {
      const req = makeReq({ 'unknown-report': {} })
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(ok).toHaveBeenCalledWith(
        expect.objectContaining({
          'unknown-report': expect.objectContaining({
            error: 'Report not found',
          }),
        })
      )
    })

    it('does not fail the whole batch when one report ID is unknown', async () => {
      registry['known-report'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({}) },
        output: { parseAsync: jest.fn().mockResolvedValue({ value: 1 }) },
        handler: jest.fn().mockResolvedValue({ value: 1 }),
      }

      const req = makeReq({ 'known-report': {}, 'missing-report': {} })
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const body = result.body

      expect(body['known-report']).not.toHaveProperty('error')
      expect(body['missing-report']).toEqual({ error: 'Report not found' })
    })
  })

  // -------------------------------------------------------------------------
  // Successful batch execution
  // -------------------------------------------------------------------------

  describe('successful batch execution', () => {
    it('returns results for a single known report', async () => {
      const outputData = { count: 5 }

      registry['report-x'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({}) },
        output: { parseAsync: jest.fn().mockResolvedValue(outputData) },
        handler: jest.fn().mockResolvedValue(outputData),
      }

      const req = makeReq({ 'report-x': {} })
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body['report-x']).toEqual(outputData)
    })

    it('returns results for multiple known reports', async () => {
      registry['rep-1'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({}) },
        output: { parseAsync: jest.fn().mockResolvedValue({ a: 1 }) },
        handler: jest.fn().mockResolvedValue({ a: 1 }),
      }
      registry['rep-2'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({}) },
        output: { parseAsync: jest.fn().mockResolvedValue({ b: 2 }) },
        handler: jest.fn().mockResolvedValue({ b: 2 }),
      }

      const req = makeReq({ 'rep-1': {}, 'rep-2': {} })
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body['rep-1']).toEqual({ a: 1 })
      expect(result.body['rep-2']).toEqual({ b: 2 })
    })

    it('passes the session and per-report input to each handler', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ value: 0 })
      const validatedInput = { periodDays: 30 }

      registry['rep-session'] = {
        input: { parseAsync: jest.fn().mockResolvedValue(validatedInput) },
        output: { parseAsync: jest.fn().mockResolvedValue({ value: 0 }) },
        handler: mockHandler,
      }

      const req = makeReq({ 'rep-session': { periodDays: '30' } })

      await handler(req, mockSession)

      expect(mockHandler).toHaveBeenCalledWith(mockSession, validatedInput)
    })
  })

  // -------------------------------------------------------------------------
  // Partial failure model
  // -------------------------------------------------------------------------

  describe('partial failure model', () => {
    it('returns inline error when handler throws, rest succeed', async () => {
      registry['failing-rep'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({}) },
        output: { parseAsync: jest.fn() },
        handler: jest.fn().mockRejectedValue(new Error('db timeout')),
      }
      registry['passing-rep'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({}) },
        output: { parseAsync: jest.fn().mockResolvedValue({ ok: true }) },
        handler: jest.fn().mockResolvedValue({ ok: true }),
      }

      const req = makeReq({ 'failing-rep': {}, 'passing-rep': {} })
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body['failing-rep']).toEqual({ error: 'db timeout' })
      expect(result.body['passing-rep']).toEqual({ ok: true })
    })

    it('includes error message in inline error when input validation fails', async () => {
      const validationError = new Error('periodDays must be positive')

      registry['invalid-input-rep'] = {
        input: { parseAsync: jest.fn().mockRejectedValue(validationError) },
        output: { parseAsync: jest.fn() },
        handler: jest.fn(),
      }

      const req = makeReq({ 'invalid-input-rep': { periodDays: -1 } })
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body['invalid-input-rep']).toEqual({
        error: 'periodDays must be positive',
      })
    })

    it('includes error message when output schema validation fails', async () => {
      registry['bad-output-rep'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({}) },
        output: {
          parseAsync: jest
            .fn()
            .mockRejectedValue(new Error('output schema mismatch')),
        },
        handler: jest.fn().mockResolvedValue({ unexpected: true }),
      }

      const req = makeReq({ 'bad-output-rep': {} })
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body['bad-output-rep']).toEqual({
        error: 'output schema mismatch',
      })
    })

    it('does not call the handler for one report when the body has JSON parse error', async () => {
      // @note this tests that req.json() throwing fails the whole request, not just one report
      const mockHandler = jest.fn()

      registry['not-called-rep'] = {
        input: { parseAsync: jest.fn().mockResolvedValue({}) },
        output: { parseAsync: jest.fn() },
        handler: mockHandler,
      }

      const req = makeReq({}) // req.json() replaced to throw

      req.json.mockRejectedValue(new SyntaxError('bad json'))

      await handler(req, mockSession)

      expect(mockHandler).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Content-type handling
  // -------------------------------------------------------------------------

  describe('content-type handling', () => {
    it('reads JSON body when content-type is application/json', async () => {
      const req = makeReq({})

      getHeader.mockReturnValue('application/json')

      await handler(req, mockSession)

      expect(req.json).toHaveBeenCalledTimes(1)
    })

    it('uses empty object when content-type is not JSON', async () => {
      getHeader.mockReturnValue('text/plain')

      const req = makeReq({})

      await handler(req, mockSession)

      expect(req.json).not.toHaveBeenCalled()
      // empty body = ok({})
      expect(ok).toHaveBeenCalledWith({})
    })
  })
})
