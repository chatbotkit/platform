/* eslint-disable @typescript-eslint/no-require-imports */
import { timePlusDays } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { deleteConversation } from '@/lib/conversation.delete'
import {
  getIdleConversations,
  untrackIdlingConversations,
} from '@/lib/conversation.idle'
import { assert } from '@/lib/debug'
import { runTasksEach } from '@/lib/job'
import queue from '@/lib/queue'

import { sendEvent as conversationInstanceSendEvent } from '@/pages/api/v1/conversation/[conversationId]/queue'
import {
  COMPLETE_EVENT_TYPE,
  EMPTY_EVENT_TYPE,
  EXPIRED_EVENT_TYPE,
  IDLE_EVENT_TYPE,
  MAX_RECORD_TAKE,
  handleCompleteEvent,
  handleEmptyEvent,
  handleExpiredEvent,
  handleIdleEvent,
  sendEvent,
} from '@/pages/api/v1/conversation/queue'

// @note virtual: true required because prisma client is not generated in this environment
jest.mock(
  '@/prisma/client',
  () => ({
    conversation: {
      findMany: jest.fn(),
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/conversation.delete', () => ({
  deleteConversation: jest.fn(),
}))

jest.mock('@/lib/channel.core', () => ({
  publishChannelMessage: jest.fn(),
}))

jest.mock('@/lib/channel.session', () => ({
  makeSessionChannelId: jest.fn(
    (_session, channelId) => `session:${channelId}`
  ),
}))

jest.mock('@/lib/context.store', () => ({
  setContextUser: jest.fn(),
}))

jest.mock('@chatbotkit-dev/time', () => ({
  timePlusDays: jest.fn((days) => {
    const date = new Date()

    date.setDate(date.getDate() + days)

    return date
  }),
}))

jest.mock('@/lib/conversation.idle', () => ({
  getIdleConversations: jest.fn(),
  untrackIdlingConversations: jest.fn(),
}))

jest.mock('@/lib/job', () => ({
  runTasksEach: jest.fn(),
}))

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/queue2', () => ({
  withQueueHandler: (handlers) => handlers,
}))

jest.mock('@/lib/debug', () => {
  const chainable = { log: jest.fn() }

  chainable.log.mockReturnValue(chainable)

  return {
    __esModule: true,
    default: jest.fn(() => chainable),
    assert: jest.fn(),
  }
})

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  captureInputError: jest.fn(),
}))

jest.mock('@/lib/integration.context', () => ({
  setupFrontendHostContext: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => ({
  accountConversationalLimitsOk: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/session.context', () => ({
  updateSessionStore: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn().mockResolvedValue({ id: 'user-123' }),
}))

jest.mock('@/lib/it', () => jest.fn((arr) => arr))

jest.mock('@/lib/zod.schema', () => ({
  parseAsync: jest.fn(async (_schema, value) => value),
}))

jest.mock('@/pages/api/v1/conversation/[conversationId]/queue', () => ({
  IDLE_EVENT_TYPE: 'idle',
  sendEvent: jest.fn(),
}))

jest.mock('@/pages/api/v1/conversation/complete', () => ({
  complete: jest.fn(async function* () {
    yield { type: 'result', data: { text: 'ok' } }
  }),
}))

describe('conversation/queue (global)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handleCompleteEvent', () => {
    it('passes queue abort signal to complete', async () => {
      const { complete } = require('@/pages/api/v1/conversation/complete')
      const abortController = new AbortController()

      await handleCompleteEvent(
        {
          session: {
            id: 'session-123',
            user: { id: 'user-123' },
            payload: {},
          },
          channelId: 'channel-123',
          body: { messages: [{ type: 'user', text: 'hello' }] },
        },
        { signal: abortController.signal }
      )

      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'session-123' }),
        expect.any(Object),
        { abortSignal: abortController.signal }
      )
    })

    it('passes queue mark signals to complete', async () => {
      const { complete } = require('@/pages/api/v1/conversation/complete')
      const markSignals = [new AbortController().signal]

      await handleCompleteEvent(
        {
          session: {
            id: 'session-123',
            user: { id: 'user-123' },
            payload: {},
          },
          channelId: 'channel-123',
          body: { messages: [{ type: 'user', text: 'hello' }] },
        },
        { markSignals }
      )

      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'session-123' }),
        expect.any(Object),
        expect.objectContaining({ markSignals })
      )
    })
  })

  describe('handleExpiredEvent', () => {
    it('queries conversations with expiresAt in the past', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      runTasksEach.mockImplementation(async (_workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleExpiredEvent({})

      const [call] = prisma.conversation.findMany.mock.calls

      expect(call[0].where).toEqual({
        expiresAt: {
          lte: expect.any(Date),
        },
      })
    })

    it('limits the query to MAX_RECORD_TAKE results', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      runTasksEach.mockImplementation(async () => {})

      await handleExpiredEvent({})

      const [call] = prisma.conversation.findMany.mock.calls

      expect(call[0].take).toBe(MAX_RECORD_TAKE)
    })

    it('asserts each expired conversation is actually expired before deletion', async () => {
      const expiredConversations = [
        { id: 'conv-1', botId: 'bot-1', expiresAt: new Date('2020-01-01') },
      ]

      prisma.conversation.findMany.mockResolvedValue(expiredConversations)
      deleteConversation.mockResolvedValue(undefined)

      runTasksEach.mockImplementation(async (_workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleExpiredEvent({})

      expect(assert).toHaveBeenCalledWith(
        true,
        'conversation conv-1 expiresAt must be before current date'
      )
    })

    it('deletes each expired conversation', async () => {
      const expiredConversations = [
        { id: 'conv-1', botId: 'bot-1', expiresAt: new Date('2020-01-01') },
        { id: 'conv-2', botId: null, expiresAt: new Date('2020-01-02') },
      ]

      prisma.conversation.findMany.mockResolvedValue(expiredConversations)
      deleteConversation.mockResolvedValue(undefined)

      runTasksEach.mockImplementation(async (_workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleExpiredEvent({})

      expect(deleteConversation).toHaveBeenCalledTimes(2)
      expect(deleteConversation).toHaveBeenCalledWith('conv-1')
      expect(deleteConversation).toHaveBeenCalledWith('conv-2')
    })

    it('does not delete anything when no conversations have expired', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      runTasksEach.mockImplementation(async (_workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleExpiredEvent({})

      expect(deleteConversation).not.toHaveBeenCalled()
    })
  })

  describe.skip('handleEmptyEvent', () => {
    it('queries empty conversations using a cutoff date 90 days in the past', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      runTasksEach.mockImplementation(async () => {})

      const beforeCall = Date.now()

      await handleEmptyEvent({})

      const afterCall = Date.now()

      expect(timePlusDays).toHaveBeenCalledWith(-90)

      const [call] = prisma.conversation.findMany.mock.calls

      expect(call[0].where.createdAt.lte).toBeInstanceOf(Date)
      expect(call[0].where.messages).toEqual({ none: {} })
      expect(call[0].where.OR).toBeUndefined()

      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
      const cutoff = call[0].where.createdAt.lte.getTime()

      expect(cutoff).toBeLessThanOrEqual(beforeCall - ninetyDaysMs + 1000)
      expect(cutoff).toBeGreaterThanOrEqual(afterCall - ninetyDaysMs - 1000)
    })

    it('queries oldest empty conversations first', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      runTasksEach.mockImplementation(async () => {})

      await handleEmptyEvent({})

      const [call] = prisma.conversation.findMany.mock.calls

      expect(call[0].orderBy).toEqual([
        {
          createdAt: 'asc',
        },
      ])
    })

    it('deletes each empty conversation', async () => {
      const emptyConversations = [
        { id: 'conv-1', botId: 'bot-1', expiresAt: null },
        { id: 'conv-2', botId: null, expiresAt: null },
      ]

      prisma.conversation.findMany.mockResolvedValue(emptyConversations)
      deleteConversation.mockResolvedValue(undefined)

      runTasksEach.mockImplementation(async (_workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleEmptyEvent({})

      expect(deleteConversation).toHaveBeenCalledTimes(2)
      expect(deleteConversation).toHaveBeenCalledWith('conv-1')
      expect(deleteConversation).toHaveBeenCalledWith('conv-2')
    })

    it('does not delete anything when no empty conversations qualify', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      runTasksEach.mockImplementation(async (_workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleEmptyEvent({})

      expect(deleteConversation).not.toHaveBeenCalled()
    })
  })

  describe('handleIdleEvent', () => {
    it('fetches the list of idle conversations', async () => {
      getIdleConversations.mockResolvedValue([])
      untrackIdlingConversations.mockResolvedValue(undefined)

      runTasksEach.mockImplementation(async (_workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleIdleEvent({})

      expect(getIdleConversations).toHaveBeenCalledTimes(1)
    })

    it('sends an idle event for each idle conversation', async () => {
      const idleConversationIds = ['conv-1', 'conv-2', 'conv-3']

      getIdleConversations.mockResolvedValue(idleConversationIds)
      untrackIdlingConversations.mockResolvedValue(undefined)

      runTasksEach.mockImplementation(async (_workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleIdleEvent({})

      expect(conversationInstanceSendEvent).toHaveBeenCalledTimes(3)
      expect(conversationInstanceSendEvent).toHaveBeenCalledWith('conv-1', {
        type: 'idle',
        payload: {},
      })
      expect(conversationInstanceSendEvent).toHaveBeenCalledWith('conv-2', {
        type: 'idle',
        payload: {},
      })
    })

    it('untracks each conversation individually after queuing', async () => {
      const idleConversationIds = ['conv-1', 'conv-2']

      getIdleConversations.mockResolvedValue(idleConversationIds)
      untrackIdlingConversations.mockResolvedValue(undefined)

      runTasksEach.mockImplementation(async (_workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleIdleEvent({})

      // Each conversation must be untracked individually to prevent silent data loss
      // if a queuing call fails partway through
      expect(untrackIdlingConversations).toHaveBeenCalledTimes(2)
      expect(untrackIdlingConversations).toHaveBeenCalledWith(['conv-1'])
      expect(untrackIdlingConversations).toHaveBeenCalledWith(['conv-2'])
    })

    it('does nothing when there are no idle conversations', async () => {
      getIdleConversations.mockResolvedValue([])
      untrackIdlingConversations.mockResolvedValue(undefined)

      runTasksEach.mockImplementation(async (_workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleIdleEvent({})

      expect(conversationInstanceSendEvent).not.toHaveBeenCalled()
      expect(untrackIdlingConversations).not.toHaveBeenCalled()
    })

    it('untracks each conversation only AFTER the idle event is queued', async () => {
      const order = []
      const idleConversationIds = ['conv-10']

      getIdleConversations.mockResolvedValue(idleConversationIds)
      conversationInstanceSendEvent.mockImplementation(async () => {
        order.push('sendEvent')
      })
      untrackIdlingConversations.mockImplementation(async () => {
        order.push('untrack')
      })

      runTasksEach.mockImplementation(async (_workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleIdleEvent({})

      expect(order).toEqual(['sendEvent', 'untrack'])
    })
  })

  describe('sendEvent', () => {
    it('queues expired event to /api/v1/conversation/queue', async () => {
      await sendEvent({
        type: EXPIRED_EVENT_TYPE,
        payload: {},
      })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/conversation/queue',
        expect.objectContaining({ type: EXPIRED_EVENT_TYPE }),
        { deduplicationId: undefined }
      )
    })

    it('queues empty event to /api/v1/conversation/queue', async () => {
      await sendEvent({
        type: EMPTY_EVENT_TYPE,
        payload: {},
      })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/conversation/queue',
        expect.objectContaining({ type: EMPTY_EVENT_TYPE }),
        { deduplicationId: undefined }
      )
    })

    it('queues idle event to /api/v1/conversation/queue', async () => {
      await sendEvent({
        type: IDLE_EVENT_TYPE,
        payload: {},
      })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/conversation/queue',
        expect.objectContaining({ type: IDLE_EVENT_TYPE }),
        { deduplicationId: undefined }
      )
    })

    it('queues complete event with channel deduplication', async () => {
      await sendEvent({
        type: COMPLETE_EVENT_TYPE,
        payload: {
          session: { user: { id: 'user-123' } },
          channelId: 'channel-123',
          body: {},
        },
      })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/conversation/queue',
        expect.objectContaining({ type: COMPLETE_EVENT_TYPE }),
        { deduplicationId: 'stateless-conversation-complete-event-channel-123' }
      )
    })
  })
})
