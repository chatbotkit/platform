/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    supportIntegration: {
      findUniqueByIdentifier: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

describe('/api/v1/integration/support/[supportIntegrationId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  const mockSupportIntegration = {
    id: 'support-int-456',
    userId: 'user-123',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful deletion', () => {
    it('should delete support integration when user is owner', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSupportIntegration
      )
      prisma.supportIntegration.delete.mockResolvedValue(mockSupportIntegration)

      const response = await handler(req, mockSession)

      expect(
        prisma.supportIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'support-int-456', {
        select: {
          id: true,
          userId: true,
        },
      })

      expect(prisma.supportIntegration.delete).toHaveBeenCalledWith({
        where: {
          id: 'support-int-456',
        },
      })

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ id: 'support-int-456' })
    })

    it('should handle custom identifier', async () => {
      const req = {
        query: {
          supportIntegrationId: 'custom-identifier',
        },
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSupportIntegration
      )
      prisma.supportIntegration.delete.mockResolvedValue(mockSupportIntegration)

      const response = await handler(req, mockSession)

      expect(
        prisma.supportIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'custom-identifier', {
        select: {
          id: true,
          userId: true,
        },
      })

      expect(response.status).toBe(200)
    })
  })

  describe('error handling', () => {
    it('should return 404 when support integration not found', async () => {
      const req = {
        query: {
          supportIntegrationId: 'non-existent',
        },
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const response = await handler(req, mockSession)

      expect(response.status).toBe(404)
      expect(prisma.supportIntegration.delete).not.toHaveBeenCalled()
    })

    it('should return 403 when user is not the owner', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      const differentOwnerIntegration = {
        id: 'support-int-456',
        userId: 'different-user',
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        differentOwnerIntegration
      )

      const response = await handler(req, mockSession)

      expect(response.status).toBe(403)
      expect(prisma.supportIntegration.delete).not.toHaveBeenCalled()
    })

    it('should handle database error during delete', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSupportIntegration
      )
      prisma.supportIntegration.delete.mockRejectedValue(
        new Error('Database error')
      )

      await expect(handler(req, mockSession)).rejects.toThrow('Database error')
    })

    it('should handle database error during fetch', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })

  describe('authorization checks', () => {
    it('should verify user id matches integration owner', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      const integration = {
        id: 'support-int-456',
        userId: 'user-123',
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        integration
      )
      prisma.supportIntegration.delete.mockResolvedValue(integration)

      await handler(req, mockSession)

      expect(prisma.supportIntegration.delete).toHaveBeenCalled()
    })

    it('should reject when userId does not match', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      const integration = {
        id: 'support-int-456',
        userId: 'other-user',
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        integration
      )

      const response = await handler(req, mockSession)

      expect(response.status).toBe(403)
      expect(prisma.supportIntegration.delete).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle empty supportIntegrationId', async () => {
      const req = {
        query: {
          supportIntegrationId: '',
        },
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const response = await handler(req, mockSession)

      expect(response.status).toBe(404)
    })

    it('should handle null user in session', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      const nullUserSession = {
        user: {
          id: null,
        },
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSupportIntegration
      )

      const response = await handler(req, nullUserSession)

      expect(response.status).toBe(403)
    })

    it('should return correct id in response', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-xyz',
        },
      }

      const integration = {
        id: 'support-int-xyz',
        userId: 'user-123',
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        integration
      )
      prisma.supportIntegration.delete.mockResolvedValue(integration)

      const response = await handler(req, mockSession)

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ id: 'support-int-xyz' })
    })
  })
})
