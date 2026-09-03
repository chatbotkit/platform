/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    triggerIntegration: {
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

describe('GET /api/v1/integration/trigger/[triggerIntegrationId]/fetch', () => {
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
    it('should fetch trigger integration successfully', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        name: 'Test Trigger',
        description: 'Test description',
        userId: 'user-123',
        blueprintId: 'blueprint-456',
        botId: 'bot-789',
        secret: 'secret-key-abc',
        authenticate: true,
        schedule: '0 0 * * *',
        timezone: 'America/New_York',
        sessionDuration: 3600000,
        meta: { key: 'value' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).toHaveProperty('id', 'trigger-123')
      expect(data).toHaveProperty('name', 'Test Trigger')
      expect(data).toHaveProperty('secret', 'secret-key-abc')
      expect(data).toHaveProperty('authenticate', true)
      expect(data).toHaveProperty('timezone', 'America/New_York')
      expect(data).not.toHaveProperty('userId')
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-456',
        name: 'Test Trigger',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        secret: 'secret-key',
        authenticate: false,
        schedule: null,
        sessionDuration: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-456' },
      }

      await handler(req, mockSession)

      expect(
        prisma.triggerIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'trigger-456', {
        select: {
          id: true,
          alias: true,
          name: true,
          description: true,
          userId: true,
          blueprintId: true,
          botId: true,
          secret: true,
          authenticate: true,
          schedule: true,
          timezone: true,
          sessionDuration: true,
          lastTriggerAt: true,
          nextTriggerAt: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    })

    it('should remove userId from response', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        name: 'Test Trigger',
        description: 'Test',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        secret: 'secret-key',
        authenticate: true,
        schedule: null,
        sessionDuration: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).not.toHaveProperty('userId')
    })
  })

  describe('schedule timestamps', () => {
    it('should include lastTriggerAt and nextTriggerAt in response when present', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        name: 'Test Trigger',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        secret: 'secret-key',
        authenticate: true,
        schedule: null,
        sessionDuration: null,
        lastTriggerAt: new Date('2024-01-10T12:00:00Z'),
        nextTriggerAt: new Date('2024-01-11T12:00:00Z'),
        meta: {},
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).toHaveProperty('lastTriggerAt')
      expect(data).toHaveProperty('nextTriggerAt')
    })

    it('should include null lastTriggerAt and nextTriggerAt when not set', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        name: 'Test Trigger',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        secret: 'secret-key',
        authenticate: true,
        schedule: null,
        sessionDuration: null,
        lastTriggerAt: null,
        nextTriggerAt: null,
        meta: {},
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.lastTriggerAt).toBeNull()
      expect(data.nextTriggerAt).toBeNull()
    })
  })

  describe('error handling', () => {
    it('should return 404 when trigger integration not found', async () => {
      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { triggerIntegrationId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user does not own the trigger integration', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        name: 'Test Trigger',
        description: 'Test',
        userId: 'other-user-456',
        blueprintId: null,
        botId: 'bot-789',
        secret: 'secret-key',
        authenticate: true,
        schedule: null,
        sessionDuration: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })

    it('should handle database query errors', async () => {
      prisma.triggerIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Database error')
    })
  })

  describe('field handling', () => {
    it('should handle null optional fields', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        name: 'Test Trigger',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        secret: 'secret-key',
        authenticate: false,
        schedule: null,
        sessionDuration: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.blueprintId).toBeNull()
      expect(data.schedule).toBeNull()
      expect(data.sessionDuration).toBeNull()
    })

    it('should handle empty meta object', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        name: 'Test Trigger',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        secret: 'secret-key',
        authenticate: true,
        schedule: null,
        sessionDuration: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.meta).toEqual({})
    })

    it('should handle complex meta object', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        name: 'Test Trigger',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        secret: 'secret-key',
        authenticate: true,
        schedule: null,
        sessionDuration: null,
        meta: {
          nested: { key: 'value' },
          array: [1, 2, 3],
          boolean: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
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
    it('should handle trigger integration with special characters in ID', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-abc_123-xyz',
        name: 'Test Trigger',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        secret: 'secret-key',
        authenticate: true,
        schedule: null,
        sessionDuration: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-abc_123-xyz' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.id).toBe('trigger-abc_123-xyz')
    })

    it('should handle cron expression in schedule', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        name: 'Scheduled Trigger',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        secret: 'secret-key',
        authenticate: true,
        schedule: '*/15 * * * *',
        sessionDuration: 7200000,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.schedule).toBe('*/15 * * * *')
    })
  })

  describe('authorization', () => {
    it('should verify user ownership before returning data', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        name: 'Test Trigger',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        secret: 'secret-key',
        authenticate: true,
        schedule: null,
        sessionDuration: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(
        prisma.triggerIntegration.findUniqueByIdentifier
      ).toHaveBeenCalled()
      expect(result.status).toBe(200)
    })
  })
})
