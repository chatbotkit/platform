/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './post'

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

jest.mock('@/lib/queue', () => ({
  withQueue: (fn) => fn,
}))

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn(() => ({ status: 200 })),
}))

jest.mock('@/lib/debug', () => {
  const debug = jest.fn(() => ({
    log: jest.fn(),
  }))

  return {
    __esModule: true,
    default: debug,
  }
})

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('POST /api/system/queue/callback', () => {
  const getParseRequestJson = () => require('@/lib/request').parseRequestJson
  const getOk = () => require('@/lib/response').ok
  const getDebug = () => require('@/lib/debug').default

  const mockReq = {}

  beforeEach(() => {
    jest.clearAllMocks()
    getOk().mockReturnValue({ status: 200 })
  })

  it('should parse the request and return ok', async () => {
    getParseRequestJson().mockResolvedValue({
      status: 200,
      header: {},
      body: null,
      dlqId: null,
    })

    const result = await handler(mockReq)

    expect(getParseRequestJson()).toHaveBeenCalledWith(mockReq)
    expect(getOk()).toHaveBeenCalled()
    expect(result).toEqual({ status: 200 })
  })

  it('should decode a base64-encoded body for logging', async () => {
    const originalText = 'hello from queue'
    const base64Body = Buffer.from(originalText).toString('base64')

    getParseRequestJson().mockResolvedValue({
      status: 200,
      header: { 'content-type': 'application/json' },
      body: base64Body,
      dlqId: 'dlq-abc',
    })

    await handler(mockReq)

    const debugMock = getDebug()

    expect(debugMock).toHaveBeenCalledWith(
      'received callback',
      expect.objectContaining({
        body: originalText,
      })
    )
  })

  it('should log empty string when body is null', async () => {
    getParseRequestJson().mockResolvedValue({
      status: 200,
      header: {},
      body: null,
      dlqId: null,
    })

    await handler(mockReq)

    const debugMock = getDebug()

    expect(debugMock).toHaveBeenCalledWith(
      'received callback',
      expect.objectContaining({
        body: '',
      })
    )
  })

  it('should log the status, header, and dlqId from the parsed request', async () => {
    getParseRequestJson().mockResolvedValue({
      status: 500,
      header: { 'x-request-id': 'req-123' },
      body: null,
      dlqId: 'dlq-xyz',
    })

    await handler(mockReq)

    const debugMock = getDebug()

    expect(debugMock).toHaveBeenCalledWith(
      'received callback',
      expect.objectContaining({
        status: 500,
        header: { 'x-request-id': 'req-123' },
        dlqId: 'dlq-xyz',
      })
    )
  })

  it('should return ok regardless of the status code in the payload', async () => {
    for (const status of [200, 400, 404, 500, 503]) {
      jest.clearAllMocks()
      getOk().mockReturnValue({ status: 200 })

      getParseRequestJson().mockResolvedValue({
        status,
        header: {},
        body: null,
        dlqId: null,
      })

      const result = await handler(mockReq)

      expect(getOk()).toHaveBeenCalled()
      expect(result).toEqual({ status: 200 })
    }
  })
})
