/* eslint-disable @typescript-eslint/no-require-imports */
import {
  makeUserChannelId,
  publishChannelMessage,
  streamChannelEvents,
} from './channel.user'

jest.mock('@/lib/channel.core', () => ({
  streamChannelEvents: jest.fn(),
  publishChannelMessage: jest.fn(),
}))

jest.mock('@/lib/debug', () => {
  return jest.fn(() => ({
    log: jest.fn(() => undefined),
  }))
})

const {
  streamChannelEvents: coreStreamChannelEvents,
  publishChannelMessage: corePublishChannelMessage,
} = require('@/lib/channel.core')

describe('channel.user', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('makeUserChannelId', () => {
    it('should create a user-scoped channel ID', () => {
      const result = makeUserChannelId('user-123', 'events')

      expect(result).toBe('user[user-123]:channel[events]')
    })

    it('should handle different channel names', () => {
      const result = makeUserChannelId('user-456', 'notifications')

      expect(result).toBe('user[user-456]:channel[notifications]')
    })

    it('should handle complex user IDs', () => {
      const result = makeUserChannelId('usr_abc123def456', 'events')

      expect(result).toBe('user[usr_abc123def456]:channel[events]')
    })
  })

  describe('streamChannelEvents', () => {
    it('should stream events with scoped channel ID', async () => {
      const userId = 'user-123'
      const channelName = 'events'

      const mockEvents = [
        { type: 'message', channel: 'test', data: { id: 1 } },
        { type: 'message', channel: 'test', data: { id: 2 } },
      ]

      coreStreamChannelEvents.mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event
        }
      })

      const events = []

      for await (const event of streamChannelEvents(userId, channelName)) {
        events.push(event)
      }

      expect(coreStreamChannelEvents).toHaveBeenCalledWith(
        'user[user-123]:channel[events]',
        undefined
      )
      expect(events).toEqual(mockEvents)
    })

    it('should pass options to core stream function', async () => {
      const userId = 'user-456'
      const channelName = 'events'
      const options = { historyLength: 100 }

      coreStreamChannelEvents.mockImplementation(async function* () {
        // Empty generator
      })

      const events = []

      for await (const event of streamChannelEvents(
        userId,
        channelName,
        options
      )) {
        events.push(event)
      }

      expect(coreStreamChannelEvents).toHaveBeenCalledWith(
        'user[user-456]:channel[events]',
        options
      )
    })

    it('should handle empty event stream', async () => {
      const userId = 'user-123'
      const channelName = 'events'

      coreStreamChannelEvents.mockImplementation(async function* () {
        // No events
      })

      const events = []

      for await (const event of streamChannelEvents(userId, channelName)) {
        events.push(event)
      }

      expect(events).toHaveLength(0)
    })
  })

  describe('publishChannelMessage', () => {
    it('should publish message with scoped channel ID', async () => {
      const userId = 'user-123'
      const channelName = 'events'
      const message = { type: 'test', data: 'hello' }

      corePublishChannelMessage.mockResolvedValue(undefined)

      await publishChannelMessage(userId, channelName, message)

      expect(corePublishChannelMessage).toHaveBeenCalledWith(
        'user[user-123]:channel[events]',
        message,
        undefined
      )
    })

    it('should pass options to core publish function', async () => {
      const userId = 'user-456'
      const channelName = 'events'
      const message = { type: 'test' }
      const options = { historyLength: 1000, historyExpireSeconds: 3600 }

      corePublishChannelMessage.mockResolvedValue(undefined)

      await publishChannelMessage(userId, channelName, message, options)

      expect(corePublishChannelMessage).toHaveBeenCalledWith(
        'user[user-456]:channel[events]',
        message,
        options
      )
    })

    it('should publish complex message data', async () => {
      const userId = 'user-123'
      const channelName = 'events'
      const message = {
        id: 'evt_123',
        type: 'conversation.create',
        conversationId: 'conv_456',
        meta: { source: 'api' },
        createdAt: '2024-01-15T10:30:00Z',
      }

      corePublishChannelMessage.mockResolvedValue(undefined)

      await publishChannelMessage(userId, channelName, message)

      expect(corePublishChannelMessage).toHaveBeenCalledWith(
        'user[user-123]:channel[events]',
        message,
        undefined
      )
    })
  })
})
