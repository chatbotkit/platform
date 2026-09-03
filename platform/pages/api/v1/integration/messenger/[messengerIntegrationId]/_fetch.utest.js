/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from '@/pages/api/v1/integration/messenger/[messengerIntegrationId]/fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

describe('GET /api/v1/integration/messenger/[messengerIntegrationId]/fetch', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should fetch messenger integration successfully', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-123',
        name: 'Test Messenger',
        description: 'Test description',
        userId: 'user-123',
        blueprintId: 'blueprint-456',
        botId: 'bot-789',
        verifyToken: 'verify-token-abc',
        accessToken: 'access-token-secret',
        contactCollection: true,
        sessionDuration: 3600000,
        attachments: true,
        meta: { key: 'value' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).toHaveProperty('id', 'messenger-123')
      expect(data).toHaveProperty('name', 'Test Messenger')
      expect(data).toHaveProperty('verifyToken', 'verify-token-abc')
      expect(data).toHaveProperty('accessToken', '********')
      expect(data).toHaveProperty('contactCollection', true)
      expect(data).toHaveProperty('attachments', true)
      expect(data).not.toHaveProperty('userId')
    })

    it('should return null accessToken when not configured', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-123',
        name: 'Test Messenger',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        verifyToken: 'verify-token',
        accessToken: null,
        contactCollection: false,
        sessionDuration: 3600000,
        attachments: false,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      const data = await result.json()

      expect(data).toHaveProperty('accessToken', null)
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-456',
        name: 'Test',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        verifyToken: 'token',
        accessToken: 'secret',
        contactCollection: false,
        sessionDuration: 3600000,
        attachments: false,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-456' },
      }

      await handler(req, mockSession)

      expect(
        prisma.messengerIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'messenger-456', {
        select: {
          id: true,
          alias: true,
          name: true,
          description: true,
          userId: true,
          blueprintId: true,
          botId: true,
          verifyToken: true,
          accessToken: true,
          appSecret: true,
          contactCollection: true,
          sessionDuration: true,
          attachments: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    })
  })

  describe('error handling', () => {
    it('should return 404 when messenger integration not found', async () => {
      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { messengerIntegrationId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user does not own the messenger integration', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-123',
        name: 'Test',
        description: '',
        userId: 'other-user-456',
        blueprintId: null,
        botId: 'bot-789',
        verifyToken: 'token',
        accessToken: 'secret',
        contactCollection: false,
        sessionDuration: 3600000,
        attachments: false,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })

    it('should handle database query errors', async () => {
      prisma.messengerIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Database error')
    })
  })

  describe('edge cases', () => {
    it('should handle messenger integration with all optional fields null', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-123',
        name: '',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: null,
        verifyToken: 'token',
        accessToken: null,
        contactCollection: false,
        sessionDuration: null,
        attachments: false,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).toHaveProperty('id')
      expect(data).not.toHaveProperty('userId')
    })

    it('should handle messenger integration with special characters in ID', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-abc_123-xyz',
        name: 'Test',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        verifyToken: 'token',
        accessToken: 'secret',
        sessionDuration: 3600000,
        attachments: true,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-abc_123-xyz' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).toHaveProperty('id', 'messenger-abc_123-xyz')
    })
  })

  describe('data sanitization', () => {
    it('should mask accessToken when present', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-123',
        name: 'Test',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        verifyToken: 'token',
        accessToken: 'very-secret-token-12345',
        sessionDuration: 3600000,
        attachments: false,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      const data = await result.json()

      expect(data.accessToken).toBe('********')
      expect(data.accessToken).not.toBe('very-secret-token-12345')
    })

    it('should mask appSecret when present', async () => {
      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'messenger-123',
        userId: 'user-123',
        accessToken: 'secret',
        appSecret: 'very-secret-app-secret',
      })

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      const data = await result.json()

      expect(data.appSecret).toBe('********')
      expect(data.appSecret).not.toBe('very-secret-app-secret')
    })

    it('should return null appSecret when not configured', async () => {
      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'messenger-123',
        userId: 'user-123',
        appSecret: null,
      })

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      const data = await result.json()

      expect(data.appSecret).toBeNull()
    })

    it('should remove userId from response', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-123',
        name: 'Test',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        verifyToken: 'token',
        accessToken: 'secret',
        sessionDuration: 3600000,
        attachments: false,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      const data = await result.json()

      expect(data).not.toHaveProperty('userId')
    })
  })
})
