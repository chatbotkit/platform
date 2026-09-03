/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './export'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (cursor, req, stream, session) =>
    fn(cursor, req, stream, session),
}))

jest.mock('@/lib/filter', () => ({
  getMetaQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/message', () => ({
  getSortedMessages: jest.fn((messages) => messages),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

jest.mock('@/lib/yaml', () => ({
  stringify: jest.fn((obj) => `key: value\n`),
}))

describe('GET /api/v1/conversation/export', () => {
  const {
    getMetaQueryFilter,
    getCursorConstraints,
    getTakeConstraints,
  } = require('@/lib/filter')

  const { getSortedMessages } = require('@/lib/message')
  const yaml = require('@/lib/yaml')

  const mockSession = { user: { id: 'user_123' } }
  const mockReq = {}
  const mockCursor = null

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
    getSortedMessages.mockImplementation((messages) => messages)
    yaml.stringify.mockImplementation((obj) => `key: value\n`)
  })

  describe('basic functionality', () => {
    it('should return items array for authenticated user', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result).toHaveProperty('items')
      expect(Array.isArray(result.items)).toBe(true)
    })

    it('should query conversations filtered by userId', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ userId: 'user_123' }],
          },
        })
      )
    })

    it('should include messages in the select', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            messages: expect.any(Object),
          }),
        })
      )
    })

    it('should return conversations mapped with Proxy wrappers', async () => {
      const mockConversation = {
        id: 'conv_1',
        name: 'Test Conv',
        meta: { source: 'web' },
        messages: [
          { id: 'msg_1', type: 'bot', text: 'Hello' },
          { id: 'msg_2', type: 'user', text: 'Hi there' },
        ],
      }

      prisma.conversation.findMany.mockResolvedValue([mockConversation])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toHaveProperty('id', 'conv_1')
      expect(result.items[0]).toHaveProperty('meta')
      expect(result.items[0]).toHaveProperty('messages')
    })
  })

  describe('meta Proxy serialization', () => {
    it('should return a Proxy for meta that stringifies to YAML on toString()', async () => {
      const mockConversation = {
        id: 'conv_1',
        meta: { tier: 'premium', region: 'us-east' },
        messages: [],
      }

      prisma.conversation.findMany.mockResolvedValue([mockConversation])
      yaml.stringify.mockReturnValue('tier: premium\nregion: us-east\n')

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      const stringified = item.meta.toString()

      expect(yaml.stringify).toHaveBeenCalledWith({
        tier: 'premium',
        region: 'us-east',
      })
      expect(stringified).toBe('tier: premium\nregion: us-east\n')
    })

    it('should still expose meta properties directly', async () => {
      const mockConversation = {
        id: 'conv_1',
        meta: { customField: 'value123' },
        messages: [],
      }

      prisma.conversation.findMany.mockResolvedValue([mockConversation])

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      expect(item.meta.customField).toBe('value123')
    })

    it('should call yaml.stringify with empty object when meta is null', async () => {
      const mockConversation = {
        id: 'conv_1',
        meta: null,
        messages: [],
      }

      prisma.conversation.findMany.mockResolvedValue([mockConversation])
      yaml.stringify.mockReturnValue('')

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      const stringified = item.meta.toString()

      // meta || {} becomes {}, which is truthy, so yaml.stringify({}) is called
      expect(yaml.stringify).toHaveBeenCalledWith({})
      expect(stringified).toBe('')
    })
  })

  describe('messages Proxy serialization', () => {
    it('should return a Proxy for messages that joins as "type: text" pairs on toString()', async () => {
      const messages = [
        { id: 'msg_1', type: 'bot', text: 'Hello there!' },
        { id: 'msg_2', type: 'user', text: 'How are you?' },
      ]

      const mockConversation = {
        id: 'conv_1',
        meta: {},
        messages,
      }

      prisma.conversation.findMany.mockResolvedValue([mockConversation])
      getSortedMessages.mockReturnValue(messages)

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      const stringified = item.messages.toString()

      expect(stringified).toBe('bot: Hello there!\n\nuser: How are you?')
    })

    it('should still allow array access on messages Proxy', async () => {
      const messages = [{ id: 'msg_1', type: 'bot', text: 'Hello' }]

      const mockConversation = {
        id: 'conv_1',
        meta: {},
        messages,
      }

      prisma.conversation.findMany.mockResolvedValue([mockConversation])
      getSortedMessages.mockReturnValue(messages)

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      expect(item.messages[0]).toEqual({
        id: 'msg_1',
        type: 'bot',
        text: 'Hello',
      })
      expect(item.messages.length).toBe(1)
    })

    it('should return empty string from messages toString() when messages list is empty', async () => {
      const mockConversation = {
        id: 'conv_1',
        meta: {},
        messages: [],
      }

      prisma.conversation.findMany.mockResolvedValue([mockConversation])

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      const stringified = item.messages.toString()

      expect(stringified).toBe('')
    })

    it('should call getSortedMessages to sort before wrapping in Proxy', async () => {
      const rawMessages = [
        { id: 'msg_2', type: 'user', text: 'Second' },
        { id: 'msg_1', type: 'bot', text: 'First' },
      ]

      const sortedMessages = [
        { id: 'msg_1', type: 'bot', text: 'First' },
        { id: 'msg_2', type: 'user', text: 'Second' },
      ]

      const mockConversation = {
        id: 'conv_1',
        meta: {},
        messages: rawMessages,
      }

      prisma.conversation.findMany.mockResolvedValue([mockConversation])
      getSortedMessages.mockReturnValue(sortedMessages)

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      expect(getSortedMessages).toHaveBeenCalledWith(rawMessages)
      expect(item.messages[0].text).toBe('First')
    })
  })

  describe('filtering and pagination', () => {
    it('should apply meta query filters from the request', async () => {
      prisma.conversation.findMany.mockResolvedValue([])
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['tier'], equals: 'premium' } },
      ])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { userId: 'user_123' },
              { meta: { path: ['tier'], equals: 'premium' } },
            ],
          },
        })
      )
    })

    it('should apply cursor constraints when cursor is provided', async () => {
      prisma.conversation.findMany.mockResolvedValue([])
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'conv_cursor_id' },
        skip: 1,
      })

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'conv_cursor_id' },
          skip: 1,
        })
      )
    })

    it('should apply take constraints from the request', async () => {
      prisma.conversation.findMany.mockResolvedValue([])
      getTakeConstraints.mockReturnValue({ take: 25 })

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25 })
      )
    })
  })

  describe('multiple conversations', () => {
    it('should map all conversations with Proxy wrappers', async () => {
      const conversations = [
        {
          id: 'conv_1',
          meta: { a: 1 },
          messages: [{ id: 'm1', type: 'bot', text: 'Hi' }],
        },
        {
          id: 'conv_2',
          meta: { b: 2 },
          messages: [{ id: 'm2', type: 'user', text: 'Hello' }],
        },
        { id: 'conv_3', meta: null, messages: [] },
      ]

      prisma.conversation.findMany.mockResolvedValue(conversations)

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(3)
      expect(result.items[0].id).toBe('conv_1')
      expect(result.items[1].id).toBe('conv_2')
      expect(result.items[2].id).toBe('conv_3')
    })
  })
})
