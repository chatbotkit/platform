/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    supportIntegration: {
      findUniqueByIdentifier: jest.fn(),
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
  withGet: (fn) => fn,
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('/api/v1/integration/support/[supportIntegrationId]/fetch', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  let mockSupportIntegration

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset makeJsonSafe to return data as-is
    require('@/lib/struct').makeJsonSafe.mockImplementation((data) => data)

    // Create fresh mock data for each test to avoid mutation issues
    mockSupportIntegration = {
      id: 'support-int-456',
      name: 'Support Integration',
      description: 'Test support integration',
      userId: 'user-123',
      blueprintId: 'blueprint-789',
      botId: 'bot-abc',
      email: 'support@example.com',
      meta: { custom: 'data' },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    }
  })

  describe('successful fetch', () => {
    it('should fetch support integration when user is owner', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSupportIntegration
      )

      const response = await handler(req, mockSession)

      expect(
        prisma.supportIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'support-int-456', {
        select: {
          id: true,
          alias: true,
          name: true,
          description: true,
          userId: true,
          blueprintId: true,
          botId: true,
          email: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      expect(response.status).toBe(200)

      const body = await response.json()

      expect(body).toBeDefined()
      expect(body.userId).toBeUndefined()
    })

    it('should remove userId from response', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      const integrationWithUserId = { ...mockSupportIntegration }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        integrationWithUserId
      )

      const response = await handler(req, mockSession)

      expect(response.status).toBe(200)

      const body = await response.json()

      expect(body.userId).toBeUndefined()
      expect(body.id).toBe('support-int-456')
    })

    it('should return all expected fields', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSupportIntegration
      )

      const response = await handler(req, mockSession)

      expect(response.status).toBe(200)

      const body = await response.json()

      expect(body.id).toBe('support-int-456')
      expect(body.name).toBe('Support Integration')
      expect(body.description).toBe('Test support integration')
      expect(body.blueprintId).toBe('blueprint-789')
      expect(body.botId).toBe('bot-abc')
      expect(body.email).toBe('support@example.com')
      expect(body.meta).toEqual({ custom: 'data' })
    })

    it('should handle custom identifier', async () => {
      const req = {
        query: {
          supportIntegrationId: 'custom-slug',
        },
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSupportIntegration
      )

      const response = await handler(req, mockSession)

      expect(
        prisma.supportIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(
        mockSession.user,
        'custom-slug',
        expect.any(Object)
      )

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
    })

    it('should return 403 when user is not the owner', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      const differentOwnerIntegration = {
        ...mockSupportIntegration,
        userId: 'different-user',
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        differentOwnerIntegration
      )

      const response = await handler(req, mockSession)

      expect(response.status).toBe(403)
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

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSupportIntegration
      )

      const response = await handler(req, mockSession)

      expect(response.status).toBe(200)
    })

    it('should reject when userId does not match', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      const integration = {
        ...mockSupportIntegration,
        userId: 'other-user',
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        integration
      )

      const response = await handler(req, mockSession)

      expect(response.status).toBe(403)
    })

    it('should allow owner to access their integration', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      const ownedIntegration = {
        ...mockSupportIntegration,
        userId: 'user-123',
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        ownedIntegration
      )

      const response = await handler(req, mockSession)

      expect(response.status).toBe(200)

      const body = await response.json()

      expect(body.id).toBe('support-int-456')
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

    it('should handle null blueprintId', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      const integrationWithoutBlueprint = {
        ...mockSupportIntegration,
        blueprintId: null,
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        integrationWithoutBlueprint
      )

      const response = await handler(req, mockSession)

      expect(response.status).toBe(200)

      const body = await response.json()

      expect(body.blueprintId).toBeNull()
    })

    it('should handle empty meta object', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      const integrationWithEmptyMeta = {
        ...mockSupportIntegration,
        meta: {},
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        integrationWithEmptyMeta
      )

      const response = await handler(req, mockSession)

      expect(response.status).toBe(200)

      const body = await response.json()

      expect(body.meta).toEqual({})
    })

    it('should handle null meta', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      const integrationWithNullMeta = {
        ...mockSupportIntegration,
        meta: null,
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        integrationWithNullMeta
      )

      const response = await handler(req, mockSession)

      expect(response.status).toBe(200)

      const body = await response.json()

      expect(body.meta).toBeNull()
    })

    it('should handle empty description', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      const integrationWithEmptyDescription = {
        ...mockSupportIntegration,
        description: '',
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        integrationWithEmptyDescription
      )

      const response = await handler(req, mockSession)

      expect(response.status).toBe(200)

      const body = await response.json()

      expect(body.description).toBe('')
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
  })

  describe('data serialization', () => {
    it('should call makeJsonSafe with the integration data', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      const { makeJsonSafe } = require('@/lib/struct')

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSupportIntegration
      )

      await handler(req, mockSession)

      expect(makeJsonSafe).toHaveBeenCalled()
    })

    it('should handle dates in timestamps', async () => {
      const req = {
        query: {
          supportIntegrationId: 'support-int-456',
        },
      }

      prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSupportIntegration
      )

      const response = await handler(req, mockSession)

      expect(response.status).toBe(200)

      const body = await response.json()

      expect(body.createdAt).toBeDefined()
      expect(body.updatedAt).toBeDefined()
    })
  })
})
