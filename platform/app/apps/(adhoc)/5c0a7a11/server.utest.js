import { getSessionClient } from '@/lib/cbk.sdk'

import {
  fetchConversationDelta,
  fetchConversationDetail,
  listAll,
  subscribeTaskWorkflowEvents,
} from './server'

jest.mock('@/lib/app.action', () => ({
  appActionHandler:
    (_appName, _configSchema, _paramsSchema, handler) => async (params) => {
      return handler({}, { user: { id: 'user-123' } }, params || {})
    },
}))

jest.mock('@/lib/cbk.sdk', () => ({
  getSessionClient: jest.fn(),
}))

jest.mock('@chatbotkit/react/utils/stream', () => ({
  stream: jest.fn((value) => value),
}))

describe('5c0a7a11/server', () => {
  let mockClient

  beforeEach(() => {
    jest.clearAllMocks()

    mockClient = {
      conversation: {
        list: jest.fn(),
        fetch: jest.fn(),
        message: {
          list: jest.fn(),
        },
      },
      event: {
        log: {
          list: jest.fn(),
        },
      },
      task: {
        subscribe: jest.fn(),
        fetch: jest.fn(),
        execution: {
          list: jest.fn(),
        },
      },
    }

    getSessionClient.mockResolvedValue(mockClient)
  })

  describe('listAll', () => {
    it('returns lean conversation rows without per-row message or event fetches', async () => {
      const now = Date.now()

      mockClient.conversation.list.mockResolvedValue({
        items: [
          {
            id: 'conv-1',
            contactId: 'contact-1',
            botId: 'bot-1',
            updatedAt: now - 5 * 60_000,
            createdAt: now - 10 * 60_000,
          },
          {
            id: 'conv-2',
            taskId: 'task-1',
            updatedAt: now - 1 * 60_000,
            createdAt: now - 2 * 60_000,
          },
        ],
      })

      const result = await listAll({ take: 20 })

      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('conv-2')
      expect(result.items[0].channel).toBe('Task')
      expect(result.items[1].channel).toBe('Contact')
      expect(result.items[1].bot).toBe('bot-1')

      expect(mockClient.conversation.message.list).not.toHaveBeenCalled()
      expect(mockClient.event.log.list).not.toHaveBeenCalled()
    })

    it('filters by blueprintId via a single event probe', async () => {
      mockClient.conversation.list.mockResolvedValue({
        items: [
          { id: 'conv-1', updatedAt: 2, createdAt: 1 },
          { id: 'conv-2', updatedAt: 4, createdAt: 3 },
        ],
      })

      mockClient.event.log.list.mockResolvedValue({
        items: [
          { conversationId: 'conv-2', blueprintId: 'bp-1' },
        ],
      })

      const result = await listAll({ take: 20, blueprintId: 'bp-1' })

      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe('conv-2')
      expect(mockClient.event.log.list).toHaveBeenCalledTimes(1)
      expect(mockClient.conversation.message.list).not.toHaveBeenCalled()
    })
  })

  describe('fetchConversationDetail', () => {
    it('returns full timeline plus cursors for delta polling', async () => {
      const conversation = {
        id: 'conv-1',
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      mockClient.conversation.fetch.mockResolvedValue(conversation)

      mockClient.conversation.message.list.mockResolvedValue({
        items: [
          {
            id: 'm-2',
            type: 'bot',
            text: 'two',
            createdAt: 1_700_000_001_000,
          },
          {
            id: 'm-1',
            type: 'user',
            text: 'one',
            createdAt: 1_700_000_000_000,
          },
        ],
      })

      mockClient.event.log.list.mockResolvedValue({
        items: [
          {
            id: 'e-2',
            type: 'conversation.update',
            conversationId: conversation.id,
            createdAt: 1_700_000_002_000,
          },
          {
            id: 'e-1',
            type: 'conversation.update',
            conversationId: conversation.id,
            createdAt: 1_700_000_000_500,
          },
        ],
      })

      const result = await fetchConversationDetail({
        conversationId: conversation.id,
      })

      expect(result.lastMessageId).toBe('m-2')
      expect(result.lastEventId).toBe('e-2')
      expect(result.events.map((event) => event.id)).toEqual([
        'm-1',
        'e-1',
        'm-2',
        'e-2',
      ])
    })

    it('keeps timeline event order stable when API returns equal timestamps in different orders', async () => {
      const conversation = {
        id: 'conv-1',
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      mockClient.conversation.fetch.mockResolvedValue(conversation)

      const messageA = {
        id: 'm-1',
        type: 'user',
        text: 'one',
        createdAt: 1_700_000_000_000,
      }

      const messageB = {
        id: 'm-2',
        type: 'bot',
        text: 'two',
        createdAt: 1_700_000_000_000,
      }

      const eventA = {
        id: 'e-1',
        type: 'conversation.update',
        description: 'event one',
        conversationId: conversation.id,
        createdAt: 1_700_000_000_000,
      }

      const eventB = {
        id: 'e-2',
        type: 'conversation.update',
        description: 'event two',
        conversationId: conversation.id,
        createdAt: 1_700_000_000_000,
      }

      mockClient.conversation.message.list
        .mockResolvedValueOnce({ items: [messageA, messageB] })
        .mockResolvedValueOnce({ items: [messageB, messageA] })

      mockClient.event.log.list
        .mockResolvedValueOnce({ items: [eventB, eventA] })
        .mockResolvedValueOnce({ items: [eventA, eventB] })

      const firstResult = await fetchConversationDetail({
        conversationId: conversation.id,
      })

      const secondResult = await fetchConversationDetail({
        conversationId: conversation.id,
      })

      expect(firstResult.events.map((event) => event.id)).toEqual(
        secondResult.events.map((event) => event.id)
      )
    })
  })

  describe('fetchConversationDelta', () => {
    it('returns only items newer than the supplied cursors', async () => {
      const conversation = {
        id: 'conv-1',
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      mockClient.conversation.fetch.mockResolvedValue(conversation)

      mockClient.conversation.message.list.mockResolvedValue({
        items: [
          { id: 'm-3', type: 'bot', text: 'c', createdAt: 3000 },
          { id: 'm-2', type: 'user', text: 'b', createdAt: 2000 },
          { id: 'm-1', type: 'user', text: 'a', createdAt: 1000 },
        ],
      })

      mockClient.event.log.list.mockResolvedValue({
        items: [
          {
            id: 'e-2',
            type: 'conversation.update',
            conversationId: 'conv-1',
            createdAt: 2500,
          },
          {
            id: 'e-1',
            type: 'conversation.update',
            conversationId: 'conv-1',
            createdAt: 1500,
          },
        ],
      })

      const result = await fetchConversationDelta({
        conversationId: 'conv-1',
        sinceMessageId: 'm-1',
        sinceEventId: 'e-1',
      })

      expect(result.lastMessageId).toBe('m-3')
      expect(result.lastEventId).toBe('e-2')
      expect(result.newEvents.map((event) => event.id)).toEqual([
        'm-2',
        'e-2',
        'm-3',
      ])
    })

    it('returns all items when no cursors are provided', async () => {
      mockClient.conversation.fetch.mockResolvedValue({
        id: 'conv-1',
        updatedAt: Date.now(),
        createdAt: Date.now(),
      })

      mockClient.conversation.message.list.mockResolvedValue({
        items: [{ id: 'm-1', type: 'user', text: 'a', createdAt: 1000 }],
      })

      mockClient.event.log.list.mockResolvedValue({
        items: [
          {
            id: 'e-1',
            type: 'conversation.update',
            conversationId: 'conv-1',
            createdAt: 1500,
          },
        ],
      })

      const result = await fetchConversationDelta({
        conversationId: 'conv-1',
      })

      expect(result.newEvents.map((event) => event.id)).toEqual(['m-1', 'e-1'])
      expect(result.lastMessageId).toBe('m-1')
      expect(result.lastEventId).toBe('e-1')
    })
  })

  describe('subscribeTaskWorkflowEvents', () => {
    it('streams task workflow events through the SDK task subscription', async () => {
      const workflowEvent = {
        type: 'operationBegin',
        createdAt: 1_700_000_000_000,
        data: {
          id: 'operation-1',
          action: {
            id: 'ability-1',
            name: 'Lookup',
          },
        },
      }

      const subscriptionStream = jest.fn(async function* () {
        yield workflowEvent
      })

      mockClient.task.subscribe.mockReturnValue({
        stream: subscriptionStream,
      })

      const result = await subscribeTaskWorkflowEvents({
        taskId: 'task-1',
        historyLength: 25,
      })

      const events = []

      for await (const event of result) {
        events.push(event)
      }

      expect(mockClient.task.subscribe).toHaveBeenCalledWith('task-1', {
        historyLength: 25,
      })
      expect(subscriptionStream).toHaveBeenCalledTimes(1)
      expect(events).toEqual([workflowEvent])
    })
  })
})
