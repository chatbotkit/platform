/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { UserInputError } from '@/lib/error'

import {
  SEND_EVENT_TYPE,
  sendEvent,
} from '@/pages/api/v1/integration/email/[emailIntegrationId]/queue'

import handler from './email'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@prisma/client', () => ({
  // Mock any Prisma enums or types used in the code if needed
}))

jest.mock(
  '@/pages/api/v1/integration/email/[emailIntegrationId]/queue',
  () => ({
    SEND_EVENT_TYPE: 'send',
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

describe('auxiliary/skillset/ability/chatbotkit/integration/email/conversation', () => {
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

    it('should start email conversation successfully', async () => {
      const mockIntegration = {
        id: 'email123',
        userId: 'user123',
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      sendEvent.mockResolvedValue(undefined)

      const parameters = {
        emailIntegrationId: 'email123',
        email: 'recipient@example.com',
        subject: 'Hello Subject',
        text: 'Hello World',
      }

      const result = await startConversationFn(
        mockSession,
        parameters,
        mockHeaders
      )

      expect(
        prisma.emailIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'email123', {
        select: {
          id: true,
          userId: true,
        },
      })

      expect(sendEvent).toHaveBeenCalledWith('email123', {
        type: SEND_EVENT_TYPE,
        payload: {
          email: 'recipient@example.com',
          subject: 'Hello Subject',
          text: 'Hello World',
        },
      })

      expect(result).toEqual({
        success: true,
        email: 'recipient@example.com',
        subject: 'Hello Subject',
      })
    })

    it('should pass context to the send event when provided', async () => {
      const mockIntegration = {
        id: 'email123',
        userId: 'user123',
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      sendEvent.mockResolvedValue(undefined)

      const parameters = {
        emailIntegrationId: 'email123',
        email: 'recipient@example.com',
        subject: 'Hello Subject',
        text: 'Hello World',
        context: 'John is a senior developer interested in APIs',
      }

      await startConversationFn(mockSession, parameters, mockHeaders)

      expect(sendEvent).toHaveBeenCalledWith('email123', {
        type: SEND_EVENT_TYPE,
        payload: {
          email: 'recipient@example.com',
          subject: 'Hello Subject',
          text: 'Hello World',
          context: 'John is a senior developer interested in APIs',
        },
      })
    })

    it('should throw error if integration not found', async () => {
      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const parameters = {
        emailIntegrationId: 'nonexistent',
        email: 'recipient@example.com',
        subject: 'Hello Subject',
        text: 'Hello World',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('Email integration not found')
    })

    it('should throw error if user is not owner', async () => {
      const mockIntegration = {
        id: 'email123',
        userId: 'otherUser',
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const parameters = {
        emailIntegrationId: 'email123',
        email: 'recipient@example.com',
        subject: 'Hello Subject',
        text: 'Hello World',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('Not authorized to use this email integration')
    })
  })
})
