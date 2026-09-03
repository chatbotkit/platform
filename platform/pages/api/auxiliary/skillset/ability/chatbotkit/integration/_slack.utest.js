/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { UserInputError } from '@/lib/error'

import { sendEvent } from '@/pages/api/v1/integration/slack/[slackIntegrationId]/queue'

import handler from './slack'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@prisma/client', () => ({
  // Mock any Prisma enums or types used in the code if needed
}))

jest.mock(
  '@/pages/api/v1/integration/slack/[slackIntegrationId]/queue',
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

describe('auxiliary/skillset/ability/chatbotkit/integration/slack/conversation', () => {
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

    it('should start conversation successfully with default channelType', async () => {
      const mockIntegration = {
        id: 'slack123',
        userId: 'user123',
        botToken: 'xoxb-test-token',
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      sendEvent.mockResolvedValue(undefined)

      // @note when channelType is not provided, the schema default is 'im'
      // but since we're bypassing schema parsing in tests, it will be undefined
      const parameters = {
        slackIntegrationId: 'slack123',
        channel: 'C123456',
        channelType: 'im',
        text: 'Hello World',
      }

      const result = await startConversationFn(
        mockSession,
        parameters,
        mockHeaders
      )

      expect(
        prisma.slackIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'slack123', {
        select: {
          id: true,
          userId: true,
          botToken: true,
        },
      })

      expect(sendEvent).toHaveBeenCalledWith('slack123', {
        type: 'initiate',
        payload: {
          channelId: 'C123456',
          text: 'Hello World',
        },
      })

      expect(result).toEqual({
        success: true,
        channel: 'C123456',
      })
    })

    it('should start conversation in a channel', async () => {
      const mockIntegration = {
        id: 'slack123',
        userId: 'user123',
        botToken: 'xoxb-test-token',
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      sendEvent.mockResolvedValue(undefined)

      const parameters = {
        slackIntegrationId: 'slack123',
        channel: 'C123456',
        channelType: 'channel',
        text: 'Hello Channel',
      }

      const result = await startConversationFn(
        mockSession,
        parameters,
        mockHeaders
      )

      expect(sendEvent).toHaveBeenCalledWith('slack123', {
        type: 'initiate',
        payload: {
          channelId: 'C123456',
          text: 'Hello Channel',
        },
      })

      expect(result).toEqual({
        success: true,
        channel: 'C123456',
      })
    })

    it('should start conversation in a group', async () => {
      const mockIntegration = {
        id: 'slack123',
        userId: 'user123',
        botToken: 'xoxb-test-token',
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      sendEvent.mockResolvedValue(undefined)

      const parameters = {
        slackIntegrationId: 'slack123',
        channel: 'G123456',
        channelType: 'group',
        text: 'Hello Group',
      }

      const result = await startConversationFn(
        mockSession,
        parameters,
        mockHeaders
      )

      expect(sendEvent).toHaveBeenCalledWith('slack123', {
        type: 'initiate',
        payload: {
          channelId: 'G123456',
          text: 'Hello Group',
        },
      })

      expect(result).toEqual({
        success: true,
        channel: 'G123456',
      })
    })

    it('should throw error if integration not found', async () => {
      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const parameters = {
        slackIntegrationId: 'nonexistent',
        channel: 'C123456',
        text: 'Hello World',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('Slack integration not found')
    })

    it('should throw error if user is not owner', async () => {
      const mockIntegration = {
        id: 'slack123',
        userId: 'otherUser',
        botToken: 'xoxb-test-token',
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const parameters = {
        slackIntegrationId: 'slack123',
        channel: 'C123456',
        text: 'Hello World',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('Not authorized to use this Slack integration')
    })

    it('should throw error if integration has no bot token', async () => {
      const mockIntegration = {
        id: 'slack123',
        userId: 'user123',
        botToken: null,
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const parameters = {
        slackIntegrationId: 'slack123',
        channel: 'C123456',
        text: 'Hello World',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('Slack integration does not have a bot token')
    })
  })
})
