/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { getConfigBySchema } from '@/lib/action.config'
import { getScopedResourceFilter } from '@/lib/action.filter'
import { getContextBot, getContextContact } from '@/lib/context.store'

import {
  doConversationFetch,
  doConversationList,
  executeConversationAction,
} from './action.exec.conversation'

jest.mock('@/lib/context.store', () => ({
  getContextBot: jest.fn(),
  getContextContact: jest.fn(),
}))

jest.mock('@/lib/action.config', () => ({
  getConfigBySchema: jest.fn(),
}))

jest.mock('@/lib/action.filter', () => ({
  getScopedResourceFilter: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({
  MessageType: {
    bot: 'bot',
    user: 'user',
  },
}))

jest.mock('@/lib/message', () => ({
  getSortedMessages: jest.fn((messages) => messages),
}))

describe('action.exec.conversation', () => {
  const userId = 'user-123'
  const baseOptions = {
    userId,
    linkedResources: {
      blueprintId: 'bp-123',
      botId: 'bot-456',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('doConversationList', () => {
    it('should list conversations with user scope', async () => {
      getConfigBySchema.mockReturnValue({ '@scope': 'user' })
      getScopedResourceFilter.mockReturnValue({ userId })

      prisma.conversation.findMany.mockResolvedValue([
        { id: 'conv-1', name: 'Conversation 1', description: 'Desc 1' },
        { id: 'conv-2', name: 'Conversation 2', description: 'Desc 2' },
      ])

      const result = await doConversationList({
        input: '',
        params: { list: true },
        options: baseOptions,
      })

      expect(getConfigBySchema).toHaveBeenCalledWith({
        input: '',
        params: { list: true },
        initial: {},
        schema: expect.any(Object),
        options: baseOptions,
      })

      expect(getScopedResourceFilter).toHaveBeenCalledWith({
        userId,
        scope: 'user',
        linkedResources: baseOptions.linkedResources,
      })

      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        where: {
          userId,
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
      })

      expect(result.result).toHaveLength(2)
      expect(result.messages).toEqual([])
    })

    it('should list conversations with contact scope using context', async () => {
      const contactId = 'contact-789'

      getConfigBySchema.mockReturnValue({ '@scope': 'contact' })
      getContextContact.mockReturnValue({ id: contactId })
      getScopedResourceFilter.mockReturnValue({ userId, contactId })

      prisma.conversation.findMany.mockResolvedValue([
        { id: 'conv-1', name: 'Contact Conversation', description: 'Desc' },
      ])

      const result = await doConversationList({
        input: '',
        params: { list: true },
        options: baseOptions,
      })

      expect(getScopedResourceFilter).toHaveBeenCalledWith({
        userId,
        scope: 'contact',
        linkedResources: baseOptions.linkedResources,
      })

      // @note verify the contactId filter is actually applied to the Prisma query
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            contactId,
          }),
        })
      )

      expect(result.result).toHaveLength(1)
    })

    it('should list conversations with bot scope using linkedResources', async () => {
      const botId = 'bot-456'

      getConfigBySchema.mockReturnValue({ '@scope': 'bot' })
      getScopedResourceFilter.mockReturnValue({
        userId,
        botId,
      })

      prisma.conversation.findMany.mockResolvedValue([])

      await doConversationList({
        input: '',
        params: { list: true },
        options: baseOptions,
      })

      expect(getScopedResourceFilter).toHaveBeenCalledWith({
        userId,
        scope: 'bot',
        linkedResources: baseOptions.linkedResources,
      })

      // @note verify the botId filter is actually applied to the Prisma query
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            botId,
          }),
        })
      )
    })

    it('should list conversations with bot scope falling back to context', async () => {
      const optionsWithoutBot = {
        userId,
        linkedResources: {},
      }
      const contextBotId = 'context-bot-id'

      getConfigBySchema.mockReturnValue({ '@scope': 'bot' })
      getContextBot.mockReturnValue({ id: contextBotId })
      getScopedResourceFilter.mockReturnValue({
        userId,
        botId: contextBotId,
      })

      prisma.conversation.findMany.mockResolvedValue([])

      await doConversationList({
        input: '',
        params: { list: true },
        options: optionsWithoutBot,
      })

      expect(getScopedResourceFilter).toHaveBeenCalledWith({
        userId,
        scope: 'bot',
        linkedResources: {},
      })

      // @note verify the context botId filter is actually applied to the Prisma query
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            botId: contextBotId,
          }),
        })
      )
    })

    it('should return empty array when no conversations found', async () => {
      getConfigBySchema.mockReturnValue({ '@scope': 'user' })
      getScopedResourceFilter.mockReturnValue({ userId })
      prisma.conversation.findMany.mockResolvedValue([])

      const result = await doConversationList({
        input: '',
        params: { list: true },
        options: baseOptions,
      })

      expect(result.result).toEqual([])
      expect(result.messages).toEqual([])
    })
  })

  describe('doConversationFetch', () => {
    const conversationId = 'conv-123'

    it('should fetch a conversation with user scope', async () => {
      getConfigBySchema.mockReturnValue({
        '@scope': 'user',
        conversationId,
      })
      getScopedResourceFilter.mockReturnValue({ userId })

      prisma.conversation.findFirst.mockResolvedValue({
        id: conversationId,
        name: 'Test Conversation',
        description: 'Test description',
        messages: [
          { type: 'user', text: 'Hello', createdAt: new Date() },
          { type: 'bot', text: 'Hi there', createdAt: new Date() },
        ],
      })

      const result = await doConversationFetch({
        input: '',
        params: { fetch: true, conversationId },
        options: baseOptions,
      })

      expect(getConfigBySchema).toHaveBeenCalledWith({
        input: '',
        params: { fetch: true, conversationId },
        initial: {},
        schema: expect.any(Object),
        options: baseOptions,
      })

      expect(getScopedResourceFilter).toHaveBeenCalledWith({
        userId,
        scope: 'user',
        linkedResources: baseOptions.linkedResources,
      })

      expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: conversationId,
            userId,
          }),
        })
      )

      expect(result.result.id).toBe(conversationId)
      expect(result.messages).toEqual([])
    })

    it('should fetch a conversation with contact scope', async () => {
      const contactId = 'contact-789'

      getConfigBySchema.mockReturnValue({
        '@scope': 'contact',
        conversationId,
      })
      getContextContact.mockReturnValue({ id: contactId })
      getScopedResourceFilter.mockReturnValue({ userId, contactId })

      prisma.conversation.findFirst.mockResolvedValue({
        id: conversationId,
        name: 'Contact Conversation',
        description: 'Description',
        messages: [],
      })

      const result = await doConversationFetch({
        input: '',
        params: { fetch: true, conversationId },
        options: baseOptions,
      })

      expect(getScopedResourceFilter).toHaveBeenCalledWith({
        userId,
        scope: 'contact',
        linkedResources: baseOptions.linkedResources,
      })

      // @note verify the contactId filter is actually applied to the Prisma query
      expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            contactId,
            id: conversationId,
          }),
        })
      )

      expect(result.result.id).toBe(conversationId)
    })

    it('should throw when conversation not found', async () => {
      getConfigBySchema.mockReturnValue({
        '@scope': 'user',
        conversationId: 'non-existent',
      })
      getScopedResourceFilter.mockReturnValue({ userId })
      prisma.conversation.findFirst.mockResolvedValue(null)

      await expect(
        doConversationFetch({
          input: '',
          params: { fetch: true, conversationId: 'non-existent' },
          options: baseOptions,
        })
      ).rejects.toThrow('Conversation not found')
    })

    it('should not find conversation when scope restricts access', async () => {
      // Simulates a scenario where user tries to access a conversation
      // that doesn't belong to their contact
      getConfigBySchema.mockReturnValue({
        '@scope': 'contact',
        conversationId,
      })
      getContextContact.mockReturnValue({ id: 'different-contact' })
      getScopedResourceFilter.mockReturnValue({
        userId,
        contactId: 'different-contact',
      })

      // The query with contactId filter doesn't find the conversation
      prisma.conversation.findFirst.mockResolvedValue(null)

      await expect(
        doConversationFetch({
          input: '',
          params: { fetch: true, conversationId },
          options: baseOptions,
        })
      ).rejects.toThrow('Conversation not found')
    })
  })

  describe('executeConversationAction', () => {
    it('should route to list operation when list param is present', async () => {
      getConfigBySchema.mockReturnValue({ '@scope': 'user' })
      getScopedResourceFilter.mockReturnValue({ userId })
      prisma.conversation.findMany.mockResolvedValue([])

      const result = await executeConversationAction(
        '',
        { list: true },
        baseOptions
      )

      expect(prisma.conversation.findMany).toHaveBeenCalled()
      expect(prisma.conversation.findFirst).not.toHaveBeenCalled()
      expect(result.result).toEqual([])
    })

    it('should route to fetch operation when fetch param is present', async () => {
      const conversationId = 'conv-123'

      getConfigBySchema.mockReturnValue({
        '@scope': 'user',
        conversationId,
      })
      getScopedResourceFilter.mockReturnValue({ userId })
      prisma.conversation.findFirst.mockResolvedValue({
        id: conversationId,
        name: 'Test',
        description: 'Desc',
        messages: [],
      })

      const result = await executeConversationAction(
        '',
        { fetch: true, conversationId },
        baseOptions
      )

      expect(prisma.conversation.findFirst).toHaveBeenCalled()
      expect(prisma.conversation.findMany).not.toHaveBeenCalled()
      expect(result.result.id).toBe(conversationId)
    })

    it('should throw for unknown operation', async () => {
      await expect(
        executeConversationAction('', { unknownOperation: true }, baseOptions)
      ).rejects.toThrow('Unknown operation')
    })

    it('should route to search operation when search param is present', async () => {
      await expect(
        executeConversationAction('', { search: 'query' }, baseOptions)
      ).rejects.toThrow('Conversation search is not yet available')
    })
  })

  describe('scope and filter integration', () => {
    it('should pass scope from getConfigBySchema to getScopedResourceFilter', async () => {
      // Test that the scope extracted from config is properly passed to filter
      getConfigBySchema.mockReturnValue({ '@scope': 'bot' })
      getScopedResourceFilter.mockReturnValue({ userId, botId: 'bot-456' })
      prisma.conversation.findMany.mockResolvedValue([])

      await doConversationList({
        input: '@scope: bot',
        params: { list: true },
        options: baseOptions,
      })

      // Verify the scope flow
      expect(getConfigBySchema).toHaveBeenCalledWith(
        expect.objectContaining({
          input: '@scope: bot',
        })
      )
      expect(getScopedResourceFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'bot',
        })
      )
    })

    it('should always include userId in the final filter', async () => {
      getConfigBySchema.mockReturnValue({ '@scope': 'user' })
      getScopedResourceFilter.mockReturnValue({ userId })
      prisma.conversation.findMany.mockResolvedValue([])

      await doConversationList({
        input: '',
        params: { list: true },
        options: baseOptions,
      })

      // Verify userId is in the where clause (both from filter and explicitly)
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
          }),
        })
      )
    })

    it('should merge scoped filter with conversationId for fetch', async () => {
      const conversationId = 'conv-123'
      const contactId = 'contact-789'

      getConfigBySchema.mockReturnValue({
        '@scope': 'contact',
        conversationId,
      })
      getScopedResourceFilter.mockReturnValue({ userId, contactId })
      prisma.conversation.findFirst.mockResolvedValue({
        id: conversationId,
        name: 'Test',
        description: 'Desc',
        messages: [],
      })

      await doConversationFetch({
        input: '',
        params: { fetch: true, conversationId },
        options: baseOptions,
      })

      // Verify the where clause combines scoped filter with conversationId
      expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            contactId,
            id: conversationId,
          }),
        })
      )
    })
  })

  describe('security considerations', () => {
    it('should always include userId even when scope filter already has it', async () => {
      // This tests the redundant userId check - userId is added both in
      // getScopedResourceFilter result AND explicitly for defense in depth
      getConfigBySchema.mockReturnValue({ '@scope': 'user' })
      getScopedResourceFilter.mockReturnValue({ userId })
      prisma.conversation.findMany.mockResolvedValue([])

      await doConversationList({
        input: '',
        params: { list: true },
        options: baseOptions,
      })

      // The where clause should have userId (potentially twice from spread + explicit)
      const callArgs = prisma.conversation.findMany.mock.calls[0][0]

      expect(callArgs.where.userId).toBe(userId)
    })

    it('should not allow cross-user access even with valid conversationId', async () => {
      const conversationId = 'conv-other-user'

      getConfigBySchema.mockReturnValue({
        '@scope': 'user',
        conversationId,
      })
      getScopedResourceFilter.mockReturnValue({ userId })

      // Database returns null because userId filter doesn't match
      prisma.conversation.findFirst.mockResolvedValue(null)

      await expect(
        doConversationFetch({
          input: '',
          params: { fetch: true, conversationId },
          options: baseOptions,
        })
      ).rejects.toThrow('Conversation not found')
    })
  })
})
