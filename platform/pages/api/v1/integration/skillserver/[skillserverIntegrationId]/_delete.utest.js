/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { getSession } from '@/lib/session.get'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    skillserverIntegration: {
      findUniqueByIdentifier: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/session.get', () => ({
  getSession: jest.fn(),
}))

describe('POST /api/v1/integration/skillserver/:id/delete', () => {
  const mockSession = {
    user: { id: 'user-123', email: 'test@example.com' },
  }

  const mockIntegration = {
    id: 'skillserver-integration-1',
    userId: 'user-123',
    skillserverId: 'skillserver-1',
    name: 'Test SkillServer',
    accessToken: 'token-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  let consoleDebug
  let consoleError

  function createRequest(skillserverIntegrationId) {
    const url = new URL(
      'https://localhost/api/v1/integration/skillserver/delete'
    )

    if (arguments.length === 0) {
      url.searchParams.set('skillserverIntegrationId', mockIntegration.id)
    } else if (skillserverIntegrationId !== undefined) {
      url.searchParams.set('skillserverIntegrationId', skillserverIntegrationId)
    }

    return new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
  }

  beforeEach(() => {
    jest.resetAllMocks()
    consoleDebug = jest.spyOn(console, 'debug').mockImplementation(() => {})
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    getSession.mockResolvedValue(mockSession)
  })

  afterEach(() => {
    consoleDebug.mockRestore()
    consoleError.mockRestore()
  })

  describe('authorization', () => {
    it('should reject requests from non-owners', async () => {
      prisma.skillserverIntegration.findUniqueByIdentifier.mockResolvedValue({
        ...mockIntegration,
        userId: 'different-user-id',
      })

      const response = await handler(createRequest())

      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          code: 'NOT_AUTHORIZED',
          message: expect.any(String),
        })
      )
      expect(prisma.skillserverIntegration.delete).not.toHaveBeenCalled()
    })

    it('should allow deletion by owner', async () => {
      prisma.skillserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.skillserverIntegration.delete.mockResolvedValue(mockIntegration)

      const response = await handler(createRequest())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        id: mockIntegration.id,
      })
      expect(prisma.skillserverIntegration.delete).toHaveBeenCalledWith({
        where: { id: mockIntegration.id },
      })
    })
  })

  describe('validation', () => {
    it('should require skillserverIntegrationId URL parameter', async () => {
      const response = await handler(createRequest(undefined))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          code: 'BAD_REQUEST',
          message: expect.any(String),
        })
      )
      expect(
        prisma.skillserverIntegration.findUniqueByIdentifier
      ).not.toHaveBeenCalled()
      expect(prisma.skillserverIntegration.delete).not.toHaveBeenCalled()
    })

    it('should validate URL parameter is not empty string', async () => {
      const response = await handler(createRequest(''))

      expect(response.status).toBe(400)
      expect(
        prisma.skillserverIntegration.findUniqueByIdentifier
      ).not.toHaveBeenCalled()
      expect(prisma.skillserverIntegration.delete).not.toHaveBeenCalled()
    })
  })

  describe('not found scenarios', () => {
    it('should return 404 when integration does not exist', async () => {
      prisma.skillserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        null
      )

      const response = await handler(createRequest('nonexistent-id'))

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          code: 'NOT_FOUND',
          message: expect.stringMatching(/not found/i),
        })
      )
      expect(prisma.skillserverIntegration.delete).not.toHaveBeenCalled()
    })

    it('should fetch integration before attempting deletion', async () => {
      prisma.skillserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        null
      )

      const response = await handler(createRequest())

      expect(response.status).toBe(404)
      expect(
        prisma.skillserverIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, mockIntegration.id, {
        select: {
          id: true,
          userId: true,
        },
      })
      expect(prisma.skillserverIntegration.delete).not.toHaveBeenCalled()
    })
  })

  describe('database errors', () => {
    it('should handle deletion errors gracefully', async () => {
      prisma.skillserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.skillserverIntegration.delete.mockRejectedValue(
        new Error('Database connection failed')
      )

      const response = await handler(createRequest())

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          message: 'Database connection failed',
        })
      )
    })

    it('should handle fetch errors from database', async () => {
      prisma.skillserverIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database timeout')
      )

      const response = await handler(createRequest())

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          message: 'Database timeout',
        })
      )
      expect(prisma.skillserverIntegration.delete).not.toHaveBeenCalled()
    })
  })

  describe('user context isolation', () => {
    it('should only delete integrations owned by session user', async () => {
      prisma.skillserverIntegration.findUniqueByIdentifier.mockResolvedValue({
        ...mockIntegration,
        userId: mockSession.user.id,
      })
      prisma.skillserverIntegration.delete.mockResolvedValue(mockIntegration)

      const response = await handler(createRequest())

      expect(response.status).toBe(200)
      expect(prisma.skillserverIntegration.delete).toHaveBeenCalledWith({
        where: { id: mockIntegration.id },
      })
    })

    it('should prevent cross-user deletion even with valid ID', async () => {
      prisma.skillserverIntegration.findUniqueByIdentifier.mockResolvedValue({
        ...mockIntegration,
        userId: 'different-user-id',
      })

      const response = await handler(createRequest())

      expect(response.status).toBe(403)
      expect(prisma.skillserverIntegration.delete).not.toHaveBeenCalled()
    })

    it('should include correct session user ID in integration lookup', async () => {
      prisma.skillserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.skillserverIntegration.delete.mockResolvedValue(mockIntegration)

      await handler(createRequest())

      expect(
        prisma.skillserverIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, mockIntegration.id, {
        select: {
          id: true,
          userId: true,
        },
      })
    })
  })

  describe('response format', () => {
    it('should return deleted integration ID on success', async () => {
      prisma.skillserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.skillserverIntegration.delete.mockResolvedValue(mockIntegration)

      const response = await handler(createRequest())

      await expect(response.json()).resolves.toEqual({
        id: mockIntegration.id,
      })
    })

    it('should return 200 status on successful deletion', async () => {
      prisma.skillserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.skillserverIntegration.delete.mockResolvedValue(mockIntegration)

      const response = await handler(createRequest())

      expect(response.status).toBe(200)
    })
  })
})
