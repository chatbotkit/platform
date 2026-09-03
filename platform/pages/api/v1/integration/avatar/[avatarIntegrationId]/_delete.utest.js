/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

import { createMocks } from 'node-mocks-http'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      avatarIntegration: {
        findUniqueByIdentifier: jest.fn(),
        delete: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

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

describe('POST /api/v1/integration/avatar/[avatarIntegrationId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should delete avatar integration successfully', async () => {
      const mockIntegration = {
        id: 'avatar-integration-123',
        userId: 'user-123',
      }

      prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.avatarIntegration.delete.mockResolvedValue(mockIntegration)

      const { req } = createMocks({
        method: 'POST',
        query: {
          avatarIntegrationId: 'avatar-integration-123',
        },
      })

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        id: 'avatar-integration-123',
      })
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockIntegration = {
        id: 'avatar-integration-123',
        userId: 'user-123',
      }

      prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.avatarIntegration.delete.mockResolvedValue(mockIntegration)

      const { req } = createMocks({
        method: 'POST',
        query: {
          avatarIntegrationId: 'avatar-integration-123',
        },
      })

      await handler(req, mockSession)

      expect(
        prisma.avatarIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'avatar-integration-123', {
        select: {
          id: true,
          userId: true,
        },
      })
    })

    it('should call delete with correct parameters', async () => {
      const mockIntegration = {
        id: 'avatar-integration-123',
        userId: 'user-123',
      }

      prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.avatarIntegration.delete.mockResolvedValue(mockIntegration)

      const { req } = createMocks({
        method: 'POST',
        query: {
          avatarIntegrationId: 'avatar-integration-123',
        },
      })

      await handler(req, mockSession)

      expect(prisma.avatarIntegration.delete).toHaveBeenCalledWith({
        where: {
          id: 'avatar-integration-123',
        },
      })
    })
  })

  describe('error handling', () => {
    it('should return 404 when integration not found', async () => {
      prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const { req } = createMocks({
        method: 'POST',
        query: {
          avatarIntegrationId: 'missing',
        },
      })

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.avatarIntegration.delete).not.toHaveBeenCalled()
    })

    it('should return 403 when user is not the owner', async () => {
      const mockIntegration = {
        id: 'avatar-integration-123',
        userId: 'different-user-456',
      }

      prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const { req } = createMocks({
        method: 'POST',
        query: {
          avatarIntegrationId: 'avatar-integration-123',
        },
      })

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.avatarIntegration.delete).not.toHaveBeenCalled()
    })

    it('should throw when findUniqueByIdentifier fails', async () => {
      prisma.avatarIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection failed')
      )

      const { req } = createMocks({
        method: 'POST',
        query: {
          avatarIntegrationId: 'avatar-integration-123',
        },
      })

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should throw when delete fails', async () => {
      const mockIntegration = {
        id: 'avatar-integration-123',
        userId: 'user-123',
      }

      prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.avatarIntegration.delete.mockRejectedValue(
        new Error('Delete operation failed')
      )

      const { req } = createMocks({
        method: 'POST',
        query: {
          avatarIntegrationId: 'avatar-integration-123',
        },
      })

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Delete operation failed'
      )
    })
  })

  describe('edge cases', () => {
    it('should throw when avatarIntegrationId parameter is missing', async () => {
      const { req } = createMocks({
        method: 'POST',
        query: {},
      })

      await expect(handler(req, mockSession)).rejects.toThrow()
    })

    it('should handle empty string avatarIntegrationId', async () => {
      prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const { req } = createMocks({
        method: 'POST',
        query: {
          avatarIntegrationId: '',
        },
      })

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should reject when integration userId is null', async () => {
      const mockIntegration = {
        id: 'avatar-integration-123',
        userId: null,
      }

      prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const { req } = createMocks({
        method: 'POST',
        query: {
          avatarIntegrationId: 'avatar-integration-123',
        },
      })

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.avatarIntegration.delete).not.toHaveBeenCalled()
    })
  })
})
