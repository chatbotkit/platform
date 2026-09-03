/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  microsoftteamsIntegration: {
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

describe('DELETE /api/v1/integration/microsoftteams/{microsoftteamsIntegrationId}/delete', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful deletion', () => {
    it('should delete Teams integration when user is owner', async () => {
      const mockIntegration = {
        id: 'ti-abc123',
        userId: 'user-123',
      }

      prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.microsoftteamsIntegration.delete.mockResolvedValue(mockIntegration)

      const req = {
        query: { microsoftteamsIntegrationId: 'ti-abc123' },
      }

      const result = await handler(req, mockSession)

      expect(
        prisma.microsoftteamsIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'ti-abc123', {
        select: {
          id: true,
          userId: true,
        },
      })

      expect(prisma.microsoftteamsIntegration.delete).toHaveBeenCalledWith({
        where: {
          id: 'ti-abc123',
        },
      })

      expect(result.status).toBe(200)

      const responseData = await result.json()

      expect(responseData).toEqual({
        id: 'ti-abc123',
      })
    })

    it('should handle integration ID from query params', async () => {
      const mockIntegration = {
        id: 'ti-xyz789',
        userId: 'user-123',
      }

      prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.microsoftteamsIntegration.delete.mockResolvedValue(mockIntegration)

      const req = {
        query: { microsoftteamsIntegrationId: 'ti-xyz789' },
      }

      await handler(req, mockSession)

      expect(
        prisma.microsoftteamsIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'ti-xyz789', expect.any(Object))
    })
  })

  describe('error handling', () => {
    it('should return 404 when integration not found', async () => {
      prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { microsoftteamsIntegrationId: 'ti-nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user is not owner', async () => {
      const mockIntegration = {
        id: 'ti-abc123',
        userId: 'other-user-456',
      }

      prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { microsoftteamsIntegrationId: 'ti-abc123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.microsoftteamsIntegration.delete).not.toHaveBeenCalled()
    })

    it('should handle missing microsoftteamsIntegrationId', async () => {
      const req = {
        query: {},
      }

      await expect(handler(req, mockSession)).rejects.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle database errors during lookup', async () => {
      prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection failed')
      )

      const req = {
        query: { microsoftteamsIntegrationId: 'ti-abc123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle database errors during deletion', async () => {
      const mockIntegration = {
        id: 'ti-abc123',
        userId: 'user-123',
      }

      prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.microsoftteamsIntegration.delete.mockRejectedValue(
        new Error('Delete failed')
      )

      const req = {
        query: { microsoftteamsIntegrationId: 'ti-abc123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Delete failed')
    })
  })
})
