/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    mcpserverIntegration: {
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

describe('POST /api/v1/integration/mcpserver/[mcpserverIntegrationId]/delete', () => {
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
    it('should delete mcpserver integration successfully', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-123',
        userId: 'user-123',
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )
      prisma.mcpserverIntegration.delete.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).toEqual({ id: 'mcpserver-123' })
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-456',
        userId: 'user-123',
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )
      prisma.mcpserverIntegration.delete.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-456' },
      }

      await handler(req, mockSession)

      expect(
        prisma.mcpserverIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'mcpserver-456', {
        select: {
          id: true,
          userId: true,
        },
      })
    })

    it('should call delete with correct parameters', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-789',
        userId: 'user-123',
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )
      prisma.mcpserverIntegration.delete.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-789' },
      }

      await handler(req, mockSession)

      expect(prisma.mcpserverIntegration.delete).toHaveBeenCalledWith({
        where: {
          id: 'mcpserver-789',
        },
      })
    })
  })

  describe('error handling', () => {
    it('should return 404 when mcpserver integration not found', async () => {
      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { mcpserverIntegrationId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.mcpserverIntegration.delete).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the mcpserver integration', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-123',
        userId: 'other-user-456',
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.mcpserverIntegration.delete).not.toHaveBeenCalled()
    })

    it('should handle database query errors on find', async () => {
      prisma.mcpserverIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Database error')
      expect(prisma.mcpserverIntegration.delete).not.toHaveBeenCalled()
    })

    it('should handle database errors on delete', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-123',
        userId: 'user-123',
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )
      prisma.mcpserverIntegration.delete.mockRejectedValue(
        new Error('Delete failed')
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Delete failed')
    })
  })

  describe('edge cases', () => {
    it('should handle mcpserver integration with special characters in ID', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-abc_123-xyz',
        userId: 'user-123',
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )
      prisma.mcpserverIntegration.delete.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-abc_123-xyz' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.id).toBe('mcpserver-abc_123-xyz')
    })
  })

  describe('authorization', () => {
    it('should verify user ownership before deleting', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-123',
        userId: 'user-123',
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )
      prisma.mcpserverIntegration.delete.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      await handler(req, mockSession)

      expect(
        prisma.mcpserverIntegration.findUniqueByIdentifier
      ).toHaveBeenCalled()
      expect(prisma.mcpserverIntegration.delete).toHaveBeenCalled()
    })

    it('should not delete if authorization check fails', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-123',
        userId: 'other-user',
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      await handler(req, mockSession)

      expect(prisma.mcpserverIntegration.delete).not.toHaveBeenCalled()
    })
  })
})
