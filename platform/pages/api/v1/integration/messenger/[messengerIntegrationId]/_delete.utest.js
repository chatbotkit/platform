/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from '@/pages/api/v1/integration/messenger/[messengerIntegrationId]/delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
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

describe('POST /api/v1/integration/messenger/[messengerIntegrationId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should delete messenger integration successfully', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-123',
        userId: 'user-123',
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )
      prisma.messengerIntegration.delete.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({
        id: 'messenger-123',
      })
      expect(prisma.messengerIntegration.delete).toHaveBeenCalledWith({
        where: { id: 'messenger-123' },
      })
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-456',
        userId: 'user-123',
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )
      prisma.messengerIntegration.delete.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-456' },
      }

      await handler(req, mockSession)

      expect(
        prisma.messengerIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'messenger-456', {
        select: {
          id: true,
          userId: true,
        },
      })
    })
  })

  describe('error handling', () => {
    it('should return 404 when messenger integration not found', async () => {
      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { messengerIntegrationId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.messengerIntegration.delete).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the messenger integration', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-123',
        userId: 'other-user-456',
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.messengerIntegration.delete).not.toHaveBeenCalled()
    })

    it('should handle database deletion errors', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-123',
        userId: 'user-123',
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )
      prisma.messengerIntegration.delete.mockRejectedValue(
        new Error('Database error')
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Database error')
    })
  })

  describe('edge cases', () => {
    it('should handle messenger integration with special characters in ID', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-abc_123-xyz',
        userId: 'user-123',
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )
      prisma.messengerIntegration.delete.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-abc_123-xyz' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({
        id: 'messenger-abc_123-xyz',
      })
    })

    it('should handle empty request body', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-123',
        userId: 'user-123',
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )
      prisma.messengerIntegration.delete.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
    })
  })

  describe('authorization', () => {
    it('should verify user ownership before deletion', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-123',
        userId: 'user-123',
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )
      prisma.messengerIntegration.delete.mockResolvedValue(
        mockMessengerIntegration
      )

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      expect(
        prisma.messengerIntegration.findUniqueByIdentifier
      ).toHaveBeenCalled()
      expect(prisma.messengerIntegration.delete).toHaveBeenCalled()
      expect(result.status).toBe(200)
    })
  })
})
