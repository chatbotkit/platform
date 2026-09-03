/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  discordIntegration: {
    findUniqueByIdentifier: jest.fn(),
    delete: jest.fn(),
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => {
    const value = req.query[param]

    if (!value) {
      const error = new Error('Bad request')

      error.name = 'SystemError'

      throw error
    }

    return value
  }),
}))

describe('DELETE /api/v1/integration/discord/{discordIntegrationId}/delete', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful deletion', () => {
    it('should delete Discord integration when user is owner', async () => {
      const mockIntegration = {
        id: 'di-abc123',
        userId: 'user-123',
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.discordIntegration.delete.mockResolvedValue(mockIntegration)

      const req = {
        query: { discordIntegrationId: 'di-abc123' },
      }

      const result = await handler(req, mockSession)

      expect(
        prisma.discordIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'di-abc123', {
        select: {
          id: true,
          userId: true,
        },
      })

      expect(prisma.discordIntegration.delete).toHaveBeenCalledWith({
        where: {
          id: 'di-abc123',
        },
      })

      expect(result.status).toBe(200)

      const responseData = await result.json()

      expect(responseData).toEqual({
        id: 'di-abc123',
      })
    })

    it('should handle integration ID from query params', async () => {
      const mockIntegration = {
        id: 'di-xyz789',
        userId: 'user-123',
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.discordIntegration.delete.mockResolvedValue(mockIntegration)

      const req = {
        query: { discordIntegrationId: 'di-xyz789' },
      }

      await handler(req, mockSession)

      expect(
        prisma.discordIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'di-xyz789', expect.any(Object))
    })
  })

  describe('error handling', () => {
    it('should return 404 when integration not found', async () => {
      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { discordIntegrationId: 'di-nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user is not owner', async () => {
      const mockIntegration = {
        id: 'di-abc123',
        userId: 'other-user-456',
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { discordIntegrationId: 'di-abc123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.discordIntegration.delete).not.toHaveBeenCalled()
    })

    it('should handle missing discordIntegrationId', async () => {
      const req = {
        query: {},
      }

      await expect(handler(req, mockSession)).rejects.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle database errors during lookup', async () => {
      prisma.discordIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection failed')
      )

      const req = {
        query: { discordIntegrationId: 'di-abc123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle database errors during deletion', async () => {
      const mockIntegration = {
        id: 'di-abc123',
        userId: 'user-123',
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.discordIntegration.delete.mockRejectedValue(
        new Error('Deletion failed')
      )

      const req = {
        query: { discordIntegrationId: 'di-abc123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Deletion failed')
    })

    it('should handle special characters in integration ID', async () => {
      const mockIntegration = {
        id: 'di-special-123',
        userId: 'user-123',
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.discordIntegration.delete.mockResolvedValue(mockIntegration)

      const req = {
        query: { discordIntegrationId: 'di-special-123' },
      }

      await handler(req, mockSession)

      expect(
        prisma.discordIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(
        mockSession.user,
        'di-special-123',
        expect.any(Object)
      )
    })
  })
})
