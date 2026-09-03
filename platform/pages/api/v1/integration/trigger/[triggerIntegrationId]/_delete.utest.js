/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    triggerIntegration: {
      findUniqueByIdentifier: jest.fn(),
      delete: jest.fn(),
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

describe('DELETE /api/v1/integration/trigger/[triggerIntegrationId]/delete', () => {
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
    it('should delete trigger integration successfully', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        userId: 'user-123',
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )
      prisma.triggerIntegration.delete.mockResolvedValue(mockTriggerIntegration)

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({
        id: 'trigger-123',
      })
      expect(prisma.triggerIntegration.delete).toHaveBeenCalledWith({
        where: { id: 'trigger-123' },
      })
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-456',
        userId: 'user-123',
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )
      prisma.triggerIntegration.delete.mockResolvedValue(mockTriggerIntegration)

      const req = {
        query: { triggerIntegrationId: 'trigger-456' },
      }

      await handler(req, mockSession)

      expect(
        prisma.triggerIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'trigger-456', {
        select: {
          id: true,
          userId: true,
        },
      })
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
      expect(prisma.triggerIntegration.delete).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the trigger integration', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
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
      expect(prisma.triggerIntegration.delete).not.toHaveBeenCalled()
    })

    it('should handle database deletion errors', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        userId: 'user-123',
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )
      prisma.triggerIntegration.delete.mockRejectedValue(
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
        userId: 'user-123',
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )
      prisma.triggerIntegration.delete.mockResolvedValue(mockTriggerIntegration)

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
        userId: 'user-123',
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )
      prisma.triggerIntegration.delete.mockResolvedValue(mockTriggerIntegration)

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
    })
  })

  describe('authorization', () => {
    it('should verify user ownership before deletion', async () => {
      const mockTriggerIntegration = {
        id: 'trigger-123',
        userId: 'user-123',
      }

      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockTriggerIntegration
      )
      prisma.triggerIntegration.delete.mockResolvedValue(mockTriggerIntegration)

      const req = {
        query: { triggerIntegrationId: 'trigger-123' },
      }

      const result = await handler(req, mockSession)

      expect(
        prisma.triggerIntegration.findUniqueByIdentifier
      ).toHaveBeenCalled()
      expect(prisma.triggerIntegration.delete).toHaveBeenCalled()
      expect(result.status).toBe(200)
    })
  })
})
