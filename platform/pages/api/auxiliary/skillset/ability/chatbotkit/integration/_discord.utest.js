/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { UserInputError } from '@/lib/error'

import { sendEvent } from '@/pages/api/v1/integration/discord/[discordIntegrationId]/queue'

import handler from './discord'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@prisma/client', () => ({
  // Mock any Prisma enums or types used in the code if needed
}))

jest.mock(
  '@/pages/api/v1/integration/discord/[discordIntegrationId]/queue',
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

describe('auxiliary/skillset/ability/chatbotkit/integration/discord/conversation', () => {
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
        id: 'discord123',
        userId: 'user123',
        botToken: 'bot-token-test',
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      sendEvent.mockResolvedValue(undefined)

      const parameters = {
        discordIntegrationId: 'discord123',
        channelId: '1234567890',
        text: 'Hello Discord',
      }

      const result = await startConversationFn(
        mockSession,
        parameters,
        mockHeaders
      )

      expect(
        prisma.discordIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'discord123', {
        select: {
          id: true,
          userId: true,
          botToken: true,
        },
      })

      expect(sendEvent).toHaveBeenCalledWith('discord123', {
        type: 'initiate',
        payload: {
          channelId: '1234567890',
          text: 'Hello Discord',
        },
      })

      expect(result).toEqual({
        success: true,
        channelId: '1234567890',
      })
    })

    it('should pass context to sendEvent when provided', async () => {
      const mockIntegration = {
        id: 'discord123',
        userId: 'user123',
        botToken: 'bot-token-test',
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      sendEvent.mockResolvedValue(undefined)

      const mockHeadersWithConversation = new Headers()

      mockHeadersWithConversation.set(
        'x-chatbotkit-conversation-id',
        'conv-abc'
      )

      const parameters = {
        discordIntegrationId: 'discord123',
        channelId: '1234567890',
        text: 'Hello Discord',
        context: 'This user is interested in API integrations',
      }

      await startConversationFn(
        mockSession,
        parameters,
        mockHeadersWithConversation
      )

      expect(sendEvent).toHaveBeenCalledWith('discord123', {
        type: 'initiate',
        payload: {
          channelId: '1234567890',
          text: 'Hello Discord',
          context: {
            linkedConversationId: 'conv-abc',
            linkedReason: 'Started',
            text: 'This user is interested in API integrations',
          },
        },
      })
    })

    it('should throw error if integration not found', async () => {
      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const parameters = {
        discordIntegrationId: 'nonexistent',
        channelId: '1234567890',
        text: 'Hello Discord',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('Discord integration not found')
    })

    it('should throw error if user is not owner', async () => {
      const mockIntegration = {
        id: 'discord123',
        userId: 'otherUser',
        botToken: 'bot-token-test',
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const parameters = {
        discordIntegrationId: 'discord123',
        channelId: '1234567890',
        text: 'Hello Discord',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('Not authorized to use this Discord integration')
    })

    it('should throw error if integration has no bot token', async () => {
      const mockIntegration = {
        id: 'discord123',
        userId: 'user123',
        botToken: null,
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const parameters = {
        discordIntegrationId: 'discord123',
        channelId: '1234567890',
        text: 'Hello Discord',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('Discord integration does not have a bot token')
    })
  })
})
