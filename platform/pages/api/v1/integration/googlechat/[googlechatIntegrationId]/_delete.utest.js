/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from '@/pages/api/v1/integration/googlechat/[googlechatIntegrationId]/delete'

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

describe('POST /api/v1/integration/googlechat/[googlechatIntegrationId]/delete', () => {
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
    it('should delete googlechat integration successfully', async () => {
      const mockIntegration = {
        id: 'gc-123',
        userId: 'user-123',
      }

      prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.googlechatIntegration.delete.mockResolvedValue(mockIntegration)

      const req = {
        query: { googlechatIntegrationId: 'gc-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({
        id: 'gc-123',
      })
      expect(prisma.googlechatIntegration.delete).toHaveBeenCalledWith({
        where: { id: 'gc-123' },
      })
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockIntegration = {
        id: 'gc-456',
        userId: 'user-123',
      }

      prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.googlechatIntegration.delete.mockResolvedValue(mockIntegration)

      const req = {
        query: { googlechatIntegrationId: 'gc-456' },
      }

      await handler(req, mockSession)

      expect(
        prisma.googlechatIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'gc-456', {
        select: {
          id: true,
          userId: true,
        },
      })
    })
  })

  describe('error handling', () => {
    it('should return 404 when integration not found', async () => {
      prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue(
        null
      )

      const req = {
        query: { googlechatIntegrationId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.googlechatIntegration.delete).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the integration', async () => {
      prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue(
        null
      )

      const req = {
        query: { googlechatIntegrationId: 'gc-other-user' },
      }

      const result = await handler(req, { user: { id: 'other-user' } })

      expect(result.status).toBe(404)
    })
  })
})
