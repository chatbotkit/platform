/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { UserInputError } from '@/lib/error'

import { sendEvent } from '@/pages/api/v1/integration/telegram/[telegramIntegrationId]/queue'

import handler from './telegram'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@prisma/client', () => ({
  // Mock any Prisma enums or types used in the code if needed
}))

jest.mock(
  '@/pages/api/v1/integration/telegram/[telegramIntegrationId]/queue',
  () => ({
    sendEvent: jest.fn(),
  })
)

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedMultiHandler: jest.fn((handlers) => {
    // Return a function that directly returns the handlers for testing
    const fn = () => handlers

    fn.handlers = handlers

    return fn
  }),
}))

describe('auxiliary/skillset/ability/chatbotkit/integration/telegram/conversation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)
  })

  describe('handler structure', () => {
    it('should export a multi-handler with startConversation', () => {
      expect(handler).toBeDefined()
      expect(handler.handlers).toBeDefined()
      expect(handler.handlers.startConversation).toBeDefined()
      expect(handler.handlers.startConversation.schema).toBeDefined()
      expect(handler.handlers.startConversation.fn).toBeDefined()
      expect(typeof handler.handlers.startConversation.fn).toBe('function')
    })
  })

  describe('startConversation', () => {
    const mockSession = {
      user: {
        id: 'user123',
      },
    }

    const mockHeaders = new Headers()

    // Get the startConversation function from the handler
    const startConversationFn = handler.handlers.startConversation.fn

    it('should start conversation successfully', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        botToken: 'bot-token-test',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      sendEvent.mockResolvedValue(undefined)

      const parameters = {
        telegramIntegrationId: 'telegram123',
        chatId: '9876543210',
        text: 'Hello Telegram',
      }

      const result = await startConversationFn(
        mockSession,
        parameters,
        mockHeaders
      )

      expect(
        prisma.telegramIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'telegram123', {
        select: {
          id: true,
          userId: true,
          botToken: true,
        },
      })

      expect(sendEvent).toHaveBeenCalledWith('telegram123', {
        type: 'initiate',
        payload: {
          chatId: '9876543210',
          text: 'Hello Telegram',
        },
      })

      expect(result).toEqual({
        success: true,
        chatId: '9876543210',
      })
    })

    it('should pass context to sendEvent when provided', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        botToken: 'bot-token-test',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      sendEvent.mockResolvedValue(undefined)

      const mockHeadersWithConversation = new Headers()

      mockHeadersWithConversation.set(
        'x-chatbotkit-conversation-id',
        'conv-abc'
      )

      const parameters = {
        telegramIntegrationId: 'telegram123',
        chatId: '9876543210',
        text: 'Hello Telegram',
        context: 'This user prefers brief responses',
      }

      await startConversationFn(
        mockSession,
        parameters,
        mockHeadersWithConversation
      )

      expect(sendEvent).toHaveBeenCalledWith('telegram123', {
        type: 'initiate',
        payload: {
          chatId: '9876543210',
          text: 'Hello Telegram',
          context: {
            linkedConversationId: 'conv-abc',
            linkedReason: 'Started',
            text: 'This user prefers brief responses',
          },
        },
      })
    })

    it('should throw error if integration not found', async () => {
      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const parameters = {
        telegramIntegrationId: 'nonexistent',
        chatId: '9876543210',
        text: 'Hello Telegram',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('Telegram integration not found')
    })

    it('should throw error if user is not owner', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'otherUser',
        botToken: 'bot-token-test',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const parameters = {
        telegramIntegrationId: 'telegram123',
        chatId: '9876543210',
        text: 'Hello Telegram',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('Not authorized to use this Telegram integration')
    })

    it('should throw error if integration has no bot token', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        botToken: null,
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const parameters = {
        telegramIntegrationId: 'telegram123',
        chatId: '9876543210',
        text: 'Hello Telegram',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('Telegram integration does not have a bot token')
    })
  })
})
