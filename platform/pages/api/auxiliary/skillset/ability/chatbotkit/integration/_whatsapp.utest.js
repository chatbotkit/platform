/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { UserInputError } from '@/lib/error'

import { sendEvent } from '@/pages/api/v1/integration/whatsapp/[whatsappIntegrationId]/queue'

import handler from './whatsapp'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@prisma/client', () => ({
  // Mock any Prisma enums or types used in the code if needed
}))

jest.mock(
  '@/pages/api/v1/integration/whatsapp/[whatsappIntegrationId]/queue',
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

describe('auxiliary/skillset/ability/chatbotkit/integration/whatsapp/conversation', () => {
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
        id: 'whatsapp123',
        userId: 'user123',
        accessToken: 'access-token-test',
        phoneNumberId: 'phone-number-id-test',
      }

      prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      sendEvent.mockResolvedValue(undefined)

      const parameters = {
        whatsappIntegrationId: 'whatsapp123',
        to: '14155238886',
        text: 'Hello WhatsApp',
      }

      const result = await startConversationFn(
        mockSession,
        parameters,
        mockHeaders
      )

      expect(
        prisma.whatsappIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'whatsapp123', {
        select: {
          id: true,
          userId: true,
          accessToken: true,
          phoneNumberId: true,
        },
      })

      expect(sendEvent).toHaveBeenCalledWith('whatsapp123', {
        type: 'initiate',
        payload: {
          to: '14155238886',
          text: 'Hello WhatsApp',
        },
      })

      expect(result).toEqual({
        success: true,
        to: '14155238886',
      })
    })

    it('should pass context to sendEvent when provided', async () => {
      const mockIntegration = {
        id: 'whatsapp123',
        userId: 'user123',
        accessToken: 'access-token-test',
        phoneNumberId: 'phone-number-id-test',
      }

      prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      sendEvent.mockResolvedValue(undefined)

      const mockHeadersWithConversation = new Headers()

      mockHeadersWithConversation.set(
        'x-chatbotkit-conversation-id',
        'conv-abc'
      )

      const parameters = {
        whatsappIntegrationId: 'whatsapp123',
        to: '14155238886',
        text: 'Hello WhatsApp',
        context: 'Customer requesting order status update',
      }

      await startConversationFn(
        mockSession,
        parameters,
        mockHeadersWithConversation
      )

      expect(sendEvent).toHaveBeenCalledWith('whatsapp123', {
        type: 'initiate',
        payload: {
          to: '14155238886',
          text: 'Hello WhatsApp',
          context: {
            linkedConversationId: 'conv-abc',
            linkedReason: 'Started',
            text: 'Customer requesting order status update',
          },
        },
      })
    })

    it('should throw error if integration not found', async () => {
      prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const parameters = {
        whatsappIntegrationId: 'nonexistent',
        to: '14155238886',
        text: 'Hello WhatsApp',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('WhatsApp integration not found')
    })

    it('should throw error if user is not owner', async () => {
      const mockIntegration = {
        id: 'whatsapp123',
        userId: 'otherUser',
        accessToken: 'access-token-test',
        phoneNumberId: 'phone-number-id-test',
      }

      prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const parameters = {
        whatsappIntegrationId: 'whatsapp123',
        to: '14155238886',
        text: 'Hello WhatsApp',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('Not authorized to use this WhatsApp integration')
    })

    it('should throw error if integration has no access token', async () => {
      const mockIntegration = {
        id: 'whatsapp123',
        userId: 'user123',
        accessToken: null,
        phoneNumberId: 'phone-number-id-test',
      }

      prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const parameters = {
        whatsappIntegrationId: 'whatsapp123',
        to: '14155238886',
        text: 'Hello WhatsApp',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow('WhatsApp integration does not have an access token')
    })

    it('should throw error if integration has no phone number ID', async () => {
      const mockIntegration = {
        id: 'whatsapp123',
        userId: 'user123',
        accessToken: 'access-token-test',
        phoneNumberId: null,
      }

      prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const parameters = {
        whatsappIntegrationId: 'whatsapp123',
        to: '14155238886',
        text: 'Hello WhatsApp',
      }

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(UserInputError)

      await expect(
        startConversationFn(mockSession, parameters, mockHeaders)
      ).rejects.toThrow(
        'WhatsApp integration does not have a phone number ID configured'
      )
    })
  })
})
