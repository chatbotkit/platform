/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler, { bodySchema } from './subscribe'

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStream: (fn) => fn,
}))

jest.mock('@/lib/channel.session', () => ({
  streamChannelEvents: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((_req, param) => _req.query?.[param]),
}))

jest.mock('@/lib/response', () => ({
  throwBadRequest: jest.fn((msg) => {
    throw new Error(msg)
  }),
}))

jest.mock('@/lib/debug', () => {
  const debug = jest.fn()

  return { __esModule: true, default: debug }
})

describe('bodySchema', () => {
  it('should accept an empty body', () => {
    const result = bodySchema.validate({})

    expect(result.error).toBeUndefined()
  })

  it('should accept historyLength as a valid integer', () => {
    const result = bodySchema.validate({ historyLength: 100 })

    expect(result.error).toBeUndefined()
  })

  it('should reject historyLength below 0', () => {
    const result = bodySchema.validate({ historyLength: -1 })

    expect(result.error).toBeDefined()
  })

  it('should reject historyLength above 10000', () => {
    const result = bodySchema.validate({ historyLength: 10001 })

    expect(result.error).toBeDefined()
  })

  it('should accept historyLength of exactly 0', () => {
    const result = bodySchema.validate({ historyLength: 0 })

    expect(result.error).toBeUndefined()
  })

  it('should accept historyLength of exactly 10000', () => {
    const result = bodySchema.validate({ historyLength: 10000 })

    expect(result.error).toBeUndefined()
  })

  it('should reject non-integer historyLength', () => {
    const result = bodySchema.validate({ historyLength: 'many' })

    expect(result.error).toBeDefined()
  })
})

describe('POST /api/v1/channel/{channelId}/subscribe', () => {
  const { streamChannelEvents } = require('@/lib/channel.session')
  const { throwBadRequest } = require('@/lib/response')

  const mockSession = { id: 'session-abc', user: { id: 'user-456' } }

  const makeStream = () => ({
    push: jest.fn().mockResolvedValue(undefined),
    nop: jest.fn().mockResolvedValue(undefined),
    abortSignal: undefined,
  })

  async function* makeEventSource(events) {
    for (const event of events) {
      yield event
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    streamChannelEvents.mockReturnValue(makeEventSource([]))
  })

  describe('channelId length validation', () => {
    it('should call throwBadRequest when channelId is shorter than 16 characters', async () => {
      const req = { query: { channelId: 'short' } }

      await expect(handler(req, makeStream(), mockSession, {})).rejects.toThrow(
        'channelId is too short'
      )

      expect(throwBadRequest).toHaveBeenCalledWith('channelId is too short')
      expect(streamChannelEvents).not.toHaveBeenCalled()
    })

    it('should call throwBadRequest when channelId is exactly 15 characters', async () => {
      const req = { query: { channelId: 'a'.repeat(15) } }

      await expect(
        handler(req, makeStream(), mockSession, {})
      ).rejects.toThrow()

      expect(streamChannelEvents).not.toHaveBeenCalled()
    })

    it('should proceed when channelId is exactly 16 characters', async () => {
      const channelId = 'a'.repeat(16)
      const req = { query: { channelId } }

      await handler(req, makeStream(), mockSession, {})

      expect(streamChannelEvents).toHaveBeenCalled()
    })

    it('should proceed when channelId is longer than 16 characters', async () => {
      const channelId = 'a'.repeat(32)
      const req = { query: { channelId } }

      await handler(req, makeStream(), mockSession, {})

      expect(streamChannelEvents).toHaveBeenCalled()
    })
  })

  describe('streamChannelEvents call arguments', () => {
    it('should call streamChannelEvents with session, channelId, and no options when historyLength is not provided', async () => {
      const channelId = 'valid-channel-id-12345'
      const req = { query: { channelId } }
      const stream = makeStream()

      await handler(req, stream, mockSession, {})

      expect(streamChannelEvents).toHaveBeenCalledWith(
        mockSession,
        channelId,
        expect.objectContaining({ abortSignal: undefined })
      )

      const callArgs = streamChannelEvents.mock.calls[0][2]

      expect(callArgs.historyLength).toBeUndefined()
    })

    it('should pass historyLength to streamChannelEvents when provided', async () => {
      const channelId = 'valid-channel-id-12345'
      const req = { query: { channelId } }
      const stream = makeStream()

      await handler(req, stream, mockSession, { historyLength: 50 })

      const callArgs = streamChannelEvents.mock.calls[0][2]

      expect(callArgs.historyLength).toBe(50)
    })

    it('should pass abortSignal from stream to streamChannelEvents', async () => {
      const channelId = 'valid-channel-id-abcde'
      const req = { query: { channelId } }
      const abortController = new AbortController()
      const stream = {
        push: jest.fn(),
        nop: jest.fn().mockResolvedValue(undefined),
        abortSignal: abortController.signal,
      }

      await handler(req, stream, mockSession, {})

      const callArgs = streamChannelEvents.mock.calls[0][2]

      expect(callArgs.abortSignal).toBe(abortController.signal)
    })
  })

  describe('event streaming', () => {
    it('should push message events to the stream with type "message"', async () => {
      const channelId = 'valid-channel-id-abcde'
      const req = { query: { channelId } }
      const stream = makeStream()

      const messageData = { text: 'hello world', timestamp: 123456789 }

      streamChannelEvents.mockReturnValue(
        makeEventSource([{ type: 'message', data: messageData }])
      )

      await handler(req, stream, mockSession, {})

      expect(stream.push).toHaveBeenCalledWith({
        type: 'message',
        data: messageData,
      })
    })

    it('should push multiple message events in order', async () => {
      const channelId = 'valid-channel-id-abcde'
      const req = { query: { channelId } }
      const stream = makeStream()

      streamChannelEvents.mockReturnValue(
        makeEventSource([
          { type: 'message', data: { seq: 1 } },
          { type: 'message', data: { seq: 2 } },
          { type: 'message', data: { seq: 3 } },
        ])
      )

      await handler(req, stream, mockSession, {})

      expect(stream.push).toHaveBeenCalledTimes(3)
      expect(stream.push).toHaveBeenNthCalledWith(1, {
        type: 'message',
        data: { seq: 1 },
      })
      expect(stream.push).toHaveBeenNthCalledWith(3, {
        type: 'message',
        data: { seq: 3 },
      })
    })

    it('should ignore non-message event types from the source', async () => {
      const channelId = 'valid-channel-id-abcde'
      const req = { query: { channelId } }
      const stream = makeStream()

      streamChannelEvents.mockReturnValue(
        makeEventSource([
          { type: 'ping', data: {} },
          { type: 'message', data: { payload: 'important' } },
          { type: 'disconnect', data: {} },
        ])
      )

      await handler(req, stream, mockSession, {})

      expect(stream.push).toHaveBeenCalledTimes(1)
      expect(stream.push).toHaveBeenCalledWith({
        type: 'message',
        data: { payload: 'important' },
      })
    })

    it('should not call stream.push when there are no events', async () => {
      const channelId = 'valid-channel-id-abcde'
      const req = { query: { channelId } }
      const stream = makeStream()

      streamChannelEvents.mockReturnValue(makeEventSource([]))

      await handler(req, stream, mockSession, {})

      expect(stream.push).not.toHaveBeenCalled()
    })
  })
})
