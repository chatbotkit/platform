/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    extractIntegration: {
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

describe('/api/v1/integration/extract/[extractIntegrationId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user123',
    },
  }

  const mockReq = (extractIntegrationId) => ({
    query: { extractIntegrationId },
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should delete extract integration successfully', async () => {
      const mockIntegration = {
        id: 'extract123',
        userId: 'user123',
      }

      prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.extractIntegration.delete.mockResolvedValue(mockIntegration)

      const req = mockReq('extract123')
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'extract123' })
      expect(prisma.extractIntegration.delete).toHaveBeenCalledWith({
        where: { id: 'extract123' },
      })
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockIntegration = {
        id: 'extract123',
        userId: 'user123',
      }

      prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.extractIntegration.delete.mockResolvedValue(mockIntegration)

      const req = mockReq('extract456')

      await handler(req, mockSession)

      expect(
        prisma.extractIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(
        mockSession.user,
        'extract456',
        expect.objectContaining({
          select: {
            id: true,
            userId: true,
          },
        })
      )
    })
  })

  describe('error handling', () => {
    it('should return 404 when integration not found', async () => {
      prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = mockReq('nonexistent')
      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.extractIntegration.delete).not.toHaveBeenCalled()
    })

    it('should return 403 when user is not authorized', async () => {
      const mockIntegration = {
        id: 'extract123',
        userId: 'otherUser',
      }

      prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = mockReq('extract123')
      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.extractIntegration.delete).not.toHaveBeenCalled()
    })

    it('should handle database errors during delete', async () => {
      const mockIntegration = {
        id: 'extract123',
        userId: 'user123',
      }

      prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.extractIntegration.delete.mockRejectedValue(
        new Error('Database error')
      )

      const req = mockReq('extract123')

      await expect(handler(req, mockSession)).rejects.toThrow('Database error')
    })

    it('should handle database errors during findUnique', async () => {
      prisma.extractIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection failed')
      )

      const req = mockReq('extract123')

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle missing extractIntegrationId parameter', async () => {
      const req = mockReq(undefined)

      await expect(handler(req, mockSession)).rejects.toThrow()
    })

    it('should handle empty extractIntegrationId', async () => {
      const req = mockReq('')

      await expect(handler(req, mockSession)).rejects.toThrow()
    })

    it('should handle special characters in extractIntegrationId', async () => {
      const mockIntegration = {
        id: 'extract-with-special_chars.123',
        userId: 'user123',
      }

      prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.extractIntegration.delete.mockResolvedValue(mockIntegration)

      const req = mockReq('extract-with-special_chars.123')
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        id: 'extract-with-special_chars.123',
      })
    })
  })

  describe('authorization', () => {
    it('should only allow owner to delete integration', async () => {
      const mockIntegration = {
        id: 'extract123',
        userId: 'differentUser',
      }

      prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = mockReq('extract123')
      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })

    it('should successfully delete when userId matches', async () => {
      const mockIntegration = {
        id: 'extract123',
        userId: 'user123',
      }

      prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.extractIntegration.delete.mockResolvedValue(mockIntegration)

      const req = mockReq('extract123')
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(prisma.extractIntegration.delete).toHaveBeenCalledTimes(1)
    })
  })
})
