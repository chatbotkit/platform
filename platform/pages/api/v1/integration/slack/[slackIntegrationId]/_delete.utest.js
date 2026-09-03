/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from '@/pages/api/v1/integration/slack/[slackIntegrationId]/delete'

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

describe('POST /api/v1/integration/slack/[slackIntegrationId]/delete', () => {
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
    it('should delete slack integration successfully', async () => {
      const mockSlackIntegration = {
        id: 'slack-123',
        userId: 'user-123',
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )
      prisma.slackIntegration.delete.mockResolvedValue(mockSlackIntegration)

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({
        id: 'slack-123',
      })
      expect(prisma.slackIntegration.delete).toHaveBeenCalledWith({
        where: { id: 'slack-123' },
      })
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockSlackIntegration = {
        id: 'slack-456',
        userId: 'user-123',
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )
      prisma.slackIntegration.delete.mockResolvedValue(mockSlackIntegration)

      const req = {
        query: { slackIntegrationId: 'slack-456' },
      }

      await handler(req, mockSession)

      expect(
        prisma.slackIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'slack-456', {
        select: {
          id: true,
          userId: true,
        },
      })
    })
  })

  describe('error handling', () => {
    it('should return 404 when slack integration not found', async () => {
      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { slackIntegrationId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.slackIntegration.delete).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the slack integration', async () => {
      const mockSlackIntegration = {
        id: 'slack-123',
        userId: 'other-user-456',
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.slackIntegration.delete).not.toHaveBeenCalled()
    })

    it('should handle database deletion errors', async () => {
      const mockSlackIntegration = {
        id: 'slack-123',
        userId: 'user-123',
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )
      prisma.slackIntegration.delete.mockRejectedValue(
        new Error('Database error')
      )

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Database error')
    })
  })

  describe('edge cases', () => {
    it('should handle slack integration with special characters in ID', async () => {
      const mockSlackIntegration = {
        id: 'slack-abc_123-xyz',
        userId: 'user-123',
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )
      prisma.slackIntegration.delete.mockResolvedValue(mockSlackIntegration)

      const req = {
        query: { slackIntegrationId: 'slack-abc_123-xyz' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({
        id: 'slack-abc_123-xyz',
      })
    })

    it('should handle empty request body', async () => {
      const mockSlackIntegration = {
        id: 'slack-123',
        userId: 'user-123',
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )
      prisma.slackIntegration.delete.mockResolvedValue(mockSlackIntegration)

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
    })
  })

  describe('authorization', () => {
    it('should verify user ownership before deletion', async () => {
      const mockSlackIntegration = {
        id: 'slack-123',
        userId: 'user-123',
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )
      prisma.slackIntegration.delete.mockResolvedValue(mockSlackIntegration)

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      const result = await handler(req, mockSession)

      expect(prisma.slackIntegration.findUniqueByIdentifier).toHaveBeenCalled()
      expect(prisma.slackIntegration.delete).toHaveBeenCalled()
      expect(result.status).toBe(200)
    })
  })
})
