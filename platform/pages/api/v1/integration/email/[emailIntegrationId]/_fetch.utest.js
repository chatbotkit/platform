/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    emailIntegration: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
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

describe('GET /api/v1/integration/email/[emailIntegrationId]/fetch', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should fetch email integration successfully', async () => {
      const mockEmailIntegration = {
        id: 'email-123',
        name: 'Test Email',
        description: 'Test description',
        userId: 'user-123',
        blueprintId: 'blueprint-456',
        botId: 'bot-789',
        contactCollection: true,
        sessionDuration: 3600000,
        attachments: true,
        meta: { key: 'value' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockEmailIntegration
      )

      const req = {
        query: { emailIntegrationId: 'email-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).toHaveProperty('id', 'email-123')
      expect(data).toHaveProperty('name', 'Test Email')
      expect(data).toHaveProperty('contactCollection', true)
      expect(data).toHaveProperty('attachments', true)
      expect(data).not.toHaveProperty('userId')
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockEmailIntegration = {
        id: 'email-456',
        name: 'Test Email',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        contactCollection: false,
        sessionDuration: null,
        attachments: false,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockEmailIntegration
      )

      const req = {
        query: { emailIntegrationId: 'email-456' },
      }

      await handler(req, mockSession)

      expect(
        prisma.emailIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'email-456', {
        select: {
          id: true,
          alias: true,
          name: true,
          description: true,
          userId: true,
          blueprintId: true,
          botId: true,
          contactCollection: true,
          sessionDuration: true,
          attachments: true,
          allowFrom: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    })

    it('should remove userId from response', async () => {
      const mockEmailIntegration = {
        id: 'email-123',
        name: 'Test Email',
        description: 'Test',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        contactCollection: true,
        sessionDuration: null,
        attachments: true,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockEmailIntegration
      )

      const req = {
        query: { emailIntegrationId: 'email-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).not.toHaveProperty('userId')
    })
  })

  describe('error handling', () => {
    it('should return 404 when email integration not found', async () => {
      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { emailIntegrationId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user does not own the email integration', async () => {
      const mockEmailIntegration = {
        id: 'email-123',
        name: 'Test Email',
        description: 'Test',
        userId: 'other-user-456',
        blueprintId: null,
        botId: 'bot-789',
        contactCollection: true,
        sessionDuration: null,
        attachments: true,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockEmailIntegration
      )

      const req = {
        query: { emailIntegrationId: 'email-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })

    it('should handle database query errors', async () => {
      prisma.emailIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      const req = {
        query: { emailIntegrationId: 'email-123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Database error')
    })
  })

  describe('field handling', () => {
    it('should handle null optional fields', async () => {
      const mockEmailIntegration = {
        id: 'email-123',
        name: 'Test Email',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        contactCollection: false,
        sessionDuration: null,
        attachments: false,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockEmailIntegration
      )

      const req = {
        query: { emailIntegrationId: 'email-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.blueprintId).toBeNull()
      expect(data.sessionDuration).toBeNull()
    })

    it('should handle empty meta object', async () => {
      const mockEmailIntegration = {
        id: 'email-123',
        name: 'Test Email',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        contactCollection: true,
        sessionDuration: null,
        attachments: true,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockEmailIntegration
      )

      const req = {
        query: { emailIntegrationId: 'email-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.meta).toEqual({})
    })

    it('should handle complex meta object', async () => {
      const mockEmailIntegration = {
        id: 'email-123',
        name: 'Test Email',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        contactCollection: true,
        sessionDuration: null,
        attachments: true,
        meta: {
          nested: { key: 'value' },
          array: [1, 2, 3],
          boolean: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockEmailIntegration
      )

      const req = {
        query: { emailIntegrationId: 'email-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.meta).toEqual({
        nested: { key: 'value' },
        array: [1, 2, 3],
        boolean: true,
      })
    })
  })

  describe('edge cases', () => {
    it('should handle email integration with special characters in ID', async () => {
      const mockEmailIntegration = {
        id: 'email-abc_123-xyz',
        name: 'Test Email',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        contactCollection: true,
        sessionDuration: null,
        attachments: true,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockEmailIntegration
      )

      const req = {
        query: { emailIntegrationId: 'email-abc_123-xyz' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.id).toBe('email-abc_123-xyz')
    })

    it('should handle long session duration', async () => {
      const mockEmailIntegration = {
        id: 'email-123',
        name: 'Email with Long Session',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        contactCollection: true,
        sessionDuration: 86400000,
        attachments: true,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockEmailIntegration
      )

      const req = {
        query: { emailIntegrationId: 'email-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.sessionDuration).toBe(86400000)
    })
  })

  describe('authorization', () => {
    it('should verify user ownership before returning data', async () => {
      const mockEmailIntegration = {
        id: 'email-123',
        name: 'Test Email',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        contactCollection: true,
        sessionDuration: null,
        attachments: true,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockEmailIntegration
      )

      const req = {
        query: { emailIntegrationId: 'email-123' },
      }

      const result = await handler(req, mockSession)

      expect(prisma.emailIntegration.findUniqueByIdentifier).toHaveBeenCalled()
      expect(result.status).toBe(200)
    })
  })
})
