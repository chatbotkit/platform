/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

import { createMocks } from 'node-mocks-http'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    emailIntegration: {
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

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

describe('DELETE /api/v1/integration/email/[emailIntegrationId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should delete email integration successfully', async () => {
      const mockIntegration = {
        id: 'email-integration-123',
        userId: 'user-123',
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.emailIntegration.delete.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          emailIntegrationId: 'email-integration-123',
        },
        body: {},
      })

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        id: 'email-integration-123',
      })
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockIntegration = {
        id: 'email-integration-123',
        userId: 'user-123',
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.emailIntegration.delete.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          emailIntegrationId: 'email-integration-123',
        },
        body: {},
      })

      await handler(req, mockSession)

      expect(
        prisma.emailIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'email-integration-123', {
        select: {
          id: true,
          userId: true,
        },
      })
    })

    it('should call delete with correct parameters', async () => {
      const mockIntegration = {
        id: 'email-integration-123',
        userId: 'user-123',
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.emailIntegration.delete.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          emailIntegrationId: 'email-integration-123',
        },
        body: {},
      })

      await handler(req, mockSession)

      expect(prisma.emailIntegration.delete).toHaveBeenCalledWith({
        where: {
          id: 'email-integration-123',
        },
      })
    })
  })

  describe('error handling', () => {
    it('should return 404 when integration not found', async () => {
      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          emailIntegrationId: 'non-existent',
        },
        body: {},
      })

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.emailIntegration.delete).not.toHaveBeenCalled()
    })

    it('should return 403 when user is not the owner', async () => {
      const mockIntegration = {
        id: 'email-integration-123',
        userId: 'different-user-456',
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          emailIntegrationId: 'email-integration-123',
        },
        body: {},
      })

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.emailIntegration.delete).not.toHaveBeenCalled()
    })

    it('should handle database errors during findUniqueByIdentifier', async () => {
      prisma.emailIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection failed')
      )

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          emailIntegrationId: 'email-integration-123',
        },
        body: {},
      })

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle database errors during delete', async () => {
      const mockIntegration = {
        id: 'email-integration-123',
        userId: 'user-123',
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.emailIntegration.delete.mockRejectedValue(
        new Error('Delete operation failed')
      )

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          emailIntegrationId: 'email-integration-123',
        },
        body: {},
      })

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Delete operation failed'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle missing emailIntegrationId parameter', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        query: {},
        body: {},
      })

      await expect(handler(req, mockSession)).rejects.toThrow()
    })

    it('should handle empty string emailIntegrationId', async () => {
      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          emailIntegrationId: '',
        },
        body: {},
      })

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should handle null userId in integration', async () => {
      const mockIntegration = {
        id: 'email-integration-123',
        userId: null,
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          emailIntegrationId: 'email-integration-123',
        },
        body: {},
      })

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.emailIntegration.delete).not.toHaveBeenCalled()
    })
  })

  describe('identifier resolution', () => {
    it('should work with integration ID', async () => {
      const mockIntegration = {
        id: 'email-integration-123',
        userId: 'user-123',
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.emailIntegration.delete.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          emailIntegrationId: 'email-integration-123',
        },
        body: {},
      })

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(
        prisma.emailIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(
        mockSession.user,
        'email-integration-123',
        expect.any(Object)
      )
    })

    it('should work with integration slug', async () => {
      const mockIntegration = {
        id: 'email-integration-123',
        userId: 'user-123',
      }

      prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.emailIntegration.delete.mockResolvedValue(mockIntegration)

      const { req, res } = createMocks({
        method: 'POST',
        query: {
          emailIntegrationId: 'my-email-integration',
        },
        body: {},
      })

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(
        prisma.emailIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(
        mockSession.user,
        'my-email-integration',
        expect.any(Object)
      )
    })
  })
})
