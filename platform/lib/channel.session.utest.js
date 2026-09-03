/* eslint-disable @typescript-eslint/no-require-imports */
import {
  makeSessionChannelId,
  publishChannelMessage,
  streamChannelEvents,
  waitForChannelMessage,
} from './channel.session'

jest.mock('@/lib/channel.core', () => ({
  streamChannelEvents: jest.fn(),
  waitForChannelMessage: jest.fn(),
  publishChannelMessage: jest.fn(),
}))

jest.mock('@/lib/debug', () => {
  const mockLog = jest.fn()

  return jest.fn(() => ({ log: mockLog }))
})

const {
  streamChannelEvents: coreStreamChannelEvents,
  waitForChannelMessage: coreWaitForChannelMessage,
  publishChannelMessage: corePublishChannelMessage,
} = require('@/lib/channel.core')

describe('channel.session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('makeSessionChannelId', () => {
    it('should create scoped channel ID with session', () => {
      const session = { id: 'session-123' }

      const result = makeSessionChannelId(session, 'my-channel')

      expect(result).toBe('session[session-123]:channel[my-channel]')
    })

    it('should handle empty channel ID', () => {
      const session = { id: 'session-456' }

      const result = makeSessionChannelId(session, '')

      expect(result).toBe('session[session-456]:channel[]')
    })

    it('should handle special characters in channel ID', () => {
      const session = { id: 'session-789' }

      const result = makeSessionChannelId(session, 'channel/with:special-chars')

      expect(result).toBe(
        'session[session-789]:channel[channel/with:special-chars]'
      )
    })

    it('should handle numeric session ID', () => {
      const session = { id: '12345' }

      const result = makeSessionChannelId(session, 'test')

      expect(result).toBe('session[12345]:channel[test]')
    })
  })

  describe('streamChannelEvents', () => {
    it('should stream events with scoped channel ID', async () => {
      const session = { id: 'session-123' }
      const mockEvents = [{ type: 'message', data: 'test' }]

      async function* mockGenerator() {
        yield* mockEvents
      }

      coreStreamChannelEvents.mockReturnValue(mockGenerator())

      const events = []

      for await (const event of streamChannelEvents(session, 'my-channel')) {
        events.push(event)
      }

      expect(events).toEqual(mockEvents)
      expect(coreStreamChannelEvents).toHaveBeenCalledWith(
        'session[session-123]:channel[my-channel]',
        undefined
      )
    })

    it('should pass options to core function', async () => {
      const session = { id: 'session-456' }
      const options = { history: 10 }

      async function* mockGenerator() {
        yield { type: 'test' }
      }

      coreStreamChannelEvents.mockReturnValue(mockGenerator())

      const events = []

      for await (const event of streamChannelEvents(
        session,
        'my-channel',
        options
      )) {
        events.push(event)
      }

      expect(coreStreamChannelEvents).toHaveBeenCalledWith(
        'session[session-456]:channel[my-channel]',
        options
      )
    })

    it('should handle empty event stream', async () => {
      const session = { id: 'session-789' }

      async function* mockGenerator() {}

      coreStreamChannelEvents.mockReturnValue(mockGenerator())

      const events = []

      for await (const event of streamChannelEvents(session, 'empty-channel')) {
        events.push(event)
      }

      expect(events).toEqual([])
    })

    it('should stream multiple events', async () => {
      const session = { id: 'session-multi' }
      const mockEvents = [
        { type: 'start' },
        { type: 'data', payload: 'test' },
        { type: 'end' },
      ]

      async function* mockGenerator() {
        yield* mockEvents
      }

      coreStreamChannelEvents.mockReturnValue(mockGenerator())

      const events = []

      for await (const event of streamChannelEvents(session, 'multi-channel')) {
        events.push(event)
      }

      expect(events).toHaveLength(3)
      expect(events).toEqual(mockEvents)
    })
  })

  describe('waitForChannelMessage', () => {
    it('should wait for message with scoped channel ID', async () => {
      const session = { id: 'session-123' }
      const mockMessage = { type: 'response', data: 'test' }

      coreWaitForChannelMessage.mockResolvedValue(mockMessage)

      const result = await waitForChannelMessage(session, 'my-channel')

      expect(result).toEqual(mockMessage)
      expect(coreWaitForChannelMessage).toHaveBeenCalledWith(
        'session[session-123]:channel[my-channel]',
        undefined
      )
    })

    it('should pass options to core function', async () => {
      const session = { id: 'session-456' }
      const options = { timeout: 5000 }
      const mockMessage = { type: 'test' }

      coreWaitForChannelMessage.mockResolvedValue(mockMessage)

      await waitForChannelMessage(session, 'my-channel', options)

      expect(coreWaitForChannelMessage).toHaveBeenCalledWith(
        'session[session-456]:channel[my-channel]',
        options
      )
    })

    it('should handle null message', async () => {
      const session = { id: 'session-789' }

      coreWaitForChannelMessage.mockResolvedValue(null)

      const result = await waitForChannelMessage(session, 'empty-channel')

      expect(result).toBeNull()
    })

    it('should handle timeout errors', async () => {
      const session = { id: 'session-timeout' }

      coreWaitForChannelMessage.mockRejectedValue(new Error('Timeout'))

      await expect(
        waitForChannelMessage(session, 'timeout-channel')
      ).rejects.toThrow('Timeout')
    })
  })

  describe('publishChannelMessage', () => {
    it('should publish message with scoped channel ID', async () => {
      const session = { id: 'session-123' }
      const message = { type: 'command', action: 'start' }

      corePublishChannelMessage.mockResolvedValue(true)

      await publishChannelMessage(session, 'my-channel', message)

      expect(corePublishChannelMessage).toHaveBeenCalledWith(
        'session[session-123]:channel[my-channel]',
        message,
        undefined
      )
    })

    it('should pass options to core function', async () => {
      const session = { id: 'session-456' }
      const message = { type: 'data', value: 42 }
      const options = { history: true }

      corePublishChannelMessage.mockResolvedValue(true)

      await publishChannelMessage(session, 'my-channel', message, options)

      expect(corePublishChannelMessage).toHaveBeenCalledWith(
        'session[session-456]:channel[my-channel]',
        message,
        options
      )
    })

    it('should handle empty message object', async () => {
      const session = { id: 'session-789' }
      const message = {}

      corePublishChannelMessage.mockResolvedValue(true)

      await publishChannelMessage(session, 'empty-channel', message)

      expect(corePublishChannelMessage).toHaveBeenCalledWith(
        'session[session-789]:channel[empty-channel]',
        {},
        undefined
      )
    })

    it('should handle complex message data', async () => {
      const session = { id: 'session-complex' }
      const message = {
        type: 'complex',
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
        },
        timestamp: 1234567890,
      }

      corePublishChannelMessage.mockResolvedValue(true)

      const result = await publishChannelMessage(
        session,
        'complex-channel',
        message
      )

      expect(corePublishChannelMessage).toHaveBeenCalledWith(
        'session[session-complex]:channel[complex-channel]',
        message,
        undefined
      )
    })

    it('should return result from core function', async () => {
      const session = { id: 'session-return' }

      corePublishChannelMessage.mockResolvedValue('success')

      const result = await publishChannelMessage(session, 'channel', {})

      expect(result).toBe('success')
    })
  })
})
