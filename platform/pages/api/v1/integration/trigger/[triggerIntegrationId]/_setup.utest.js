/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { doSetup } from './setup'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    triggerIntegration: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/debug', () => jest.fn())
jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
}))

describe('doSetup', () => {
  it('should execute without errors', async () => {
    const mockTriggerIntegration = {
      id: 'trigger-123',
      name: 'Test Trigger',
      userId: 'user-123',
    }

    await expect(doSetup(mockTriggerIntegration)).resolves.toBeUndefined()
  })

  it('should accept trigger integration with all fields', async () => {
    const mockTriggerIntegration = {
      id: 'trigger-123',
      name: 'Test Trigger',
      description: 'Test description',
      userId: 'user-123',
      botId: 'bot-789',
      secret: 'secret-key',
      authenticate: true,
      schedule: '0 0 * * *',
      sessionDuration: 3600000,
      meta: { key: 'value' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await expect(doSetup(mockTriggerIntegration)).resolves.toBeUndefined()
  })
})

describe('POST /api/v1/integration/trigger/[triggerIntegrationId]/setup', () => {
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
    it('should setup trigger integration successfully', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        name: 'Test Trigger',
        userId: 'user-123',
        botId: 'bot-789',
        secret: 'secret-key',
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({
        id: 'trigger-123',
      })
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-456',
        name: 'Test Trigger',
        userId: 'user-123',
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
      ).toHaveBeenCalledWith(mockSession.user, 'trigger-456')
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
        userId: 'other-user-456',
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

  describe('edge cases', () => {
    it('should handle trigger integration with special characters in ID', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-abc_123-xyz',
        name: 'Test Trigger',
        userId: 'user-123',
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-abc_123-xyz' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({
        id: 'trigger-abc_123-xyz',
      })
    })

    it('should handle empty request body', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        name: 'Test Trigger',
        userId: 'user-123',
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
    })

    it('should handle trigger integration with minimal fields', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        userId: 'user-123',
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
    })
  })

  describe('authorization', () => {
    it('should verify user ownership before setup', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        name: 'Test Trigger',
        userId: 'user-123',
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
