import queue from '@/lib/queue'
import { cleanupOldUsageRecords } from '@/lib/usage.cleanup'
import { captureUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'

import {
  CLEANUP_EVENT_TYPE,
  RECORD_EVENT_TYPE,
  handleCleanupEvent,
  handleRecordEvent,
  sendEvent,
} from '@/pages/api/v1/usage/queue'

jest.mock('@/lib/usage.cleanup', () => ({
  cleanupOldUsageRecords: jest.fn(),
}))

jest.mock('@/lib/usage.record', () => ({
  captureUsage: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: jest.fn(() => {
    throw new Error('Not Found')
  }),
}))

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/queue2', () => ({
  withQueueHandler: (handlers) => handlers,
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: () => ({ log: jest.fn() }),
}))

jest.mock('@/lib/error', () => ({
  captureInputError: jest.fn(),
}))

jest.mock('@/lib/zod.schema', () => ({
  parseAsync: jest.fn(async (_schema, value) => value),
}))

describe('usage/queue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handleCleanupEvent', () => {
    it('calls cleanupOldUsageRecords', async () => {
      cleanupOldUsageRecords.mockResolvedValue(undefined)

      await handleCleanupEvent({})

      expect(cleanupOldUsageRecords).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleRecordEvent', () => {
    it('returns early without calling captureUsage when count is zero', async () => {
      await handleRecordEvent({
        userId: 'user-1',
        type: 'CHATBOTKIT_MESSAGE',
        count: 0,
        meta: {},
      })

      expect(fastGetUserById).not.toHaveBeenCalled()
      expect(captureUsage).not.toHaveBeenCalled()
    })

    it('throws not found when user does not exist', async () => {
      fastGetUserById.mockResolvedValue(null)

      await expect(
        handleRecordEvent({
          userId: 'nonexistent-user',
          type: 'CHATBOTKIT_MESSAGE',
          count: 1,
          meta: {},
        })
      ).rejects.toThrow('Not Found')

      expect(captureUsage).not.toHaveBeenCalled()
    })

    it('calls captureUsage with the correct arguments', async () => {
      const user = { id: 'user-1', email: 'user@example.com' }

      fastGetUserById.mockResolvedValue(user)
      captureUsage.mockResolvedValue(undefined)

      await handleRecordEvent({
        userId: 'user-1',
        type: 'CHATBOTKIT_MESSAGE',
        count: 5,
        meta: { reason: 'test' },
      })

      expect(captureUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          confirm: true,
          user,
          type: 'CHATBOTKIT_MESSAGE',
          count: 5,
          meta: { reason: 'test' },
        })
      )
    })

    it('passes references through to captureUsage when provided', async () => {
      const user = { id: 'user-1' }

      fastGetUserById.mockResolvedValue(user)
      captureUsage.mockResolvedValue(undefined)

      const references = {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        botId: 'bot-1',
      }

      await handleRecordEvent({
        userId: 'user-1',
        type: 'CHATBOTKIT_CONVERSATION',
        count: 1,
        meta: {},
        references,
      })

      expect(captureUsage).toHaveBeenCalledWith(
        expect.objectContaining({ references })
      )
    })

    it('handles missing references field gracefully', async () => {
      const user = { id: 'user-1' }

      fastGetUserById.mockResolvedValue(user)
      captureUsage.mockResolvedValue(undefined)

      await handleRecordEvent({
        userId: 'user-1',
        type: 'CHATBOTKIT_MESSAGE',
        count: 1,
        meta: {},
        // references omitted
      })

      expect(captureUsage).toHaveBeenCalledTimes(1)
    })

    it('looks up the user by the provided userId', async () => {
      const user = { id: 'user-42' }

      fastGetUserById.mockResolvedValue(user)
      captureUsage.mockResolvedValue(undefined)

      await handleRecordEvent({
        userId: 'user-42',
        type: 'CHATBOTKIT_MESSAGE',
        count: 1,
        meta: {},
      })

      expect(fastGetUserById).toHaveBeenCalledWith('user-42')
    })
  })

  describe('sendEvent', () => {
    it('queues cleanup event to /api/v1/usage/queue', async () => {
      await sendEvent({
        type: CLEANUP_EVENT_TYPE,
        payload: {},
      })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/usage/queue',
        expect.objectContaining({ type: CLEANUP_EVENT_TYPE })
      )
    })

    it('queues record event to /api/v1/usage/queue', async () => {
      await sendEvent({
        type: RECORD_EVENT_TYPE,
        payload: {
          userId: 'user-1',
          type: 'CHATBOTKIT_MESSAGE',
          count: 3,
          meta: {},
        },
      })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/usage/queue',
        expect.objectContaining({ type: RECORD_EVENT_TYPE })
      )
    })

    it('preserves the full event payload when queuing', async () => {
      const payload = {
        userId: 'user-99',
        type: 'CHATBOTKIT_FETCH',
        count: 2,
        meta: { url: 'https://example.com' },
        references: { conversationId: 'conv-5' },
      }

      await sendEvent({
        type: RECORD_EVENT_TYPE,
        payload,
      })

      const [, event] = queue.mock.calls[0]

      expect(event.payload).toEqual(payload)
    })
  })
})
