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

jest.mock('@/lib/channel.user', () => ({
  streamChannelEvents: jest.fn(),
}))

jest.mock('@/lib/user.limits', () => ({
  isLiveEventStreamingEnabled: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  EVENTS_CHANNEL_NAME: 'events',
}))

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  UserInputError: class UserInputError extends Error {
    constructor(message) {
      super(message)
      this.name = 'UserInputError'
    }
  },
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
    const result = bodySchema.validate({ historyLength: 500 })

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

  it('should accept historyLength of 0', () => {
    const result = bodySchema.validate({ historyLength: 0 })

    expect(result.error).toBeUndefined()
  })

  it('should accept historyLength of 10000', () => {
    const result = bodySchema.validate({ historyLength: 10000 })

    expect(result.error).toBeUndefined()
  })
})

describe('POST /api/v1/event/log/subscribe', () => {
  const { streamChannelEvents } = require('@/lib/channel.user')
  const { isLiveEventStreamingEnabled } = require('@/lib/user.limits')

  const mockSession = { id: 'session-abc', user: { id: 'user-123' } }

  const makeStream = () => ({
    push: jest.fn().mockResolvedValue(undefined),
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

  describe('plan feature gate', () => {
    it('should throw UserInputError when live streaming is not enabled for the user', async () => {
      isLiveEventStreamingEnabled.mockResolvedValue(false)

      await expect(
        handler(new Request('http://localhost'), makeStream(), mockSession, {})
      ).rejects.toThrow('Live event streaming is not available on your plan')
    })

    it('should not stream events when live streaming is disabled', async () => {
      isLiveEventStreamingEnabled.mockResolvedValue(false)

      try {
        await handler(
          new Request('http://localhost'),
          makeStream(),
          mockSession,
          {}
        )
      } catch {
        // expected
      }

      expect(streamChannelEvents).not.toHaveBeenCalled()
    })

    it('should proceed with streaming when live event streaming is enabled', async () => {
      isLiveEventStreamingEnabled.mockResolvedValue(true)

      await handler(
        new Request('http://localhost'),
        makeStream(),
        mockSession,
        {}
      )

      expect(streamChannelEvents).toHaveBeenCalled()
    })

    it('should call isLiveEventStreamingEnabled with the session user', async () => {
      isLiveEventStreamingEnabled.mockResolvedValue(true)

      await handler(
        new Request('http://localhost'),
        makeStream(),
        mockSession,
        {}
      )

      expect(isLiveEventStreamingEnabled).toHaveBeenCalledWith(mockSession.user)
    })
  })

  describe('streamChannelEvents call arguments', () => {
    beforeEach(() => {
      isLiveEventStreamingEnabled.mockResolvedValue(true)
    })

    it('should call streamChannelEvents with the user id and EVENTS_CHANNEL_NAME', async () => {
      await handler(
        new Request('http://localhost'),
        makeStream(),
        mockSession,
        {}
      )

      expect(streamChannelEvents).toHaveBeenCalledWith(
        'user-123',
        'events',
        expect.any(Object)
      )
    })

    it('should not pass historyLength when it is not in the body', async () => {
      await handler(
        new Request('http://localhost'),
        makeStream(),
        mockSession,
        {}
      )

      const callArgs = streamChannelEvents.mock.calls[0][2]

      expect(callArgs.historyLength).toBeUndefined()
    })

    it('should pass historyLength to streamChannelEvents when provided in body', async () => {
      await handler(
        new Request('http://localhost'),
        makeStream(),
        mockSession,
        { historyLength: 25 }
      )

      const callArgs = streamChannelEvents.mock.calls[0][2]

      expect(callArgs.historyLength).toBe(25)
    })

    it('should pass abortSignal from stream', async () => {
      const abortController = new AbortController()
      const stream = { push: jest.fn(), abortSignal: abortController.signal }

      await handler(new Request('http://localhost'), stream, mockSession, {})

      const callArgs = streamChannelEvents.mock.calls[0][2]

      expect(callArgs.abortSignal).toBe(abortController.signal)
    })
  })

  describe('event streaming', () => {
    beforeEach(() => {
      isLiveEventStreamingEnabled.mockResolvedValue(true)
    })

    it('should push message events as "item" type to the stream', async () => {
      const stream = makeStream()
      const eventData = { id: 'evt-1', type: 'conversation.create' }

      streamChannelEvents.mockReturnValue(
        makeEventSource([{ type: 'message', data: eventData }])
      )

      await handler(new Request('http://localhost'), stream, mockSession, {})

      expect(stream.push).toHaveBeenCalledWith({
        type: 'item',
        data: eventData,
      })
    })

    it('should ignore subscribe events and not push them to the stream', async () => {
      const stream = makeStream()

      streamChannelEvents.mockReturnValue(
        makeEventSource([
          { type: 'subscribe', data: {} },
          { type: 'message', data: { id: 'evt-2' } },
        ])
      )

      await handler(new Request('http://localhost'), stream, mockSession, {})

      expect(stream.push).toHaveBeenCalledTimes(1)
      expect(stream.push).toHaveBeenCalledWith({
        type: 'item',
        data: { id: 'evt-2' },
      })
    })

    it('should ignore unknown event types and only push message events', async () => {
      const stream = makeStream()

      streamChannelEvents.mockReturnValue(
        makeEventSource([
          { type: 'unknown', data: {} },
          { type: 'message', data: { id: 'evt-3' } },
          { type: 'error', data: {} },
        ])
      )

      await handler(new Request('http://localhost'), stream, mockSession, {})

      expect(stream.push).toHaveBeenCalledTimes(1)
      expect(stream.push).toHaveBeenCalledWith({
        type: 'item',
        data: { id: 'evt-3' },
      })
    })

    it('should push multiple message events in sequence', async () => {
      const stream = makeStream()

      streamChannelEvents.mockReturnValue(
        makeEventSource([
          { type: 'message', data: { id: 'evt-1', type: 'bot.create' } },
          {
            type: 'message',
            data: { id: 'evt-2', type: 'conversation.start' },
          },
        ])
      )

      await handler(new Request('http://localhost'), stream, mockSession, {})

      expect(stream.push).toHaveBeenCalledTimes(2)
      expect(stream.push).toHaveBeenNthCalledWith(1, {
        type: 'item',
        data: { id: 'evt-1', type: 'bot.create' },
      })
      expect(stream.push).toHaveBeenNthCalledWith(2, {
        type: 'item',
        data: { id: 'evt-2', type: 'conversation.start' },
      })
    })

    it('should not push anything when no events are received', async () => {
      const stream = makeStream()

      streamChannelEvents.mockReturnValue(makeEventSource([]))

      await handler(new Request('http://localhost'), stream, mockSession, {})

      expect(stream.push).not.toHaveBeenCalled()
    })
  })
})
