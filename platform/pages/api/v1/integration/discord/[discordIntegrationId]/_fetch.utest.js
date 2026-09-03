/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  discordIntegration: {
    findUniqueByIdentifier: jest.fn(),
  },
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
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

describe('GET /api/v1/integration/discord/{discordIntegrationId}/fetch', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful fetch', () => {
    it('should fetch Discord integration when user is owner', async () => {
      const mockIntegration = {
        id: 'di-abc123',
        name: 'Test Discord Bot',
        description: 'A test Discord integration',
        userId: 'user-123',
        blueprintId: 'bp-123',
        botId: 'bot-123',
        appId: 'discord-app-123',
        handle: '/chatbot',
        contactCollection: true,
        sessionDuration: 3600,
        meta: { custom: 'data' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { discordIntegrationId: 'di-abc123' },
      }

      const result = await handler(req, mockSession)

      expect(
        prisma.discordIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'di-abc123', {
        select: {
          id: true,
          alias: true,
          name: true,
          description: true,
          userId: true,
          blueprintId: true,
          botId: true,
          appId: true,
          handle: true,
          contactCollection: true,
          sessionDuration: true,
          allowFrom: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      expect(result.status).toBe(200)

      const responseData = await result.json()

      expect(responseData.id).toBe('di-abc123')
      expect(responseData.name).toBe('Test Discord Bot')
      expect(responseData.userId).toBeUndefined()
    })

    it('should remove userId from response', async () => {
      const mockIntegration = {
        id: 'di-abc123',
        name: 'Bot',
        description: 'Desc',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-123',
        appId: 'app-123',
        handle: '/bot',
        contactCollection: false,
        sessionDuration: 1800,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { discordIntegrationId: 'di-abc123' },
      }

      const result = await handler(req, mockSession)

      const responseData = await result.json()

      expect(responseData).not.toHaveProperty('userId')
      expect(responseData.id).toBe('di-abc123')
    })

    it('should handle null optional fields', async () => {
      const mockIntegration = {
        id: 'di-abc123',
        name: 'Minimal Bot',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-123',
        appId: 'app-123',
        handle: '/minimal',
        contactCollection: false,
        sessionDuration: 3600,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { discordIntegrationId: 'di-abc123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const responseData = await result.json()

      expect(responseData.blueprintId).toBeNull()
      expect(responseData.meta).toBeNull()
    })
  })

  describe('error handling', () => {
    it('should return 404 when integration not found', async () => {
      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { discordIntegrationId: 'di-nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user is not owner', async () => {
      const mockIntegration = {
        id: 'di-abc123',
        name: 'Bot',
        description: 'Desc',
        userId: 'other-user-456',
        blueprintId: null,
        botId: 'bot-123',
        appId: 'app-123',
        handle: '/bot',
        contactCollection: false,
        sessionDuration: 3600,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { discordIntegrationId: 'di-abc123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })

    it('should handle missing discordIntegrationId', async () => {
      const req = {
        query: {},
      }

      await expect(handler(req, mockSession)).rejects.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle database errors', async () => {
      prisma.discordIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection failed')
      )

      const req = {
        query: { discordIntegrationId: 'di-abc123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle integration with complex meta', async () => {
      const mockIntegration = {
        id: 'di-abc123',
        name: 'Bot',
        description: 'Desc',
        userId: 'user-123',
        blueprintId: 'bp-123',
        botId: 'bot-123',
        appId: 'app-123',
        handle: '/bot',
        contactCollection: true,
        sessionDuration: 3600,
        meta: {
          nested: {
            data: 'value',
            array: [1, 2, 3],
          },
          string: 'test',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { discordIntegrationId: 'di-abc123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const responseData = await result.json()

      expect(responseData.meta).toEqual(mockIntegration.meta)
    })

    it('should handle custom identifier formats', async () => {
      const mockIntegration = {
        id: 'di-custom-id-123',
        name: 'Custom Bot',
        description: 'Custom identifier bot',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-123',
        appId: 'app-123',
        handle: '/custom',
        contactCollection: false,
        sessionDuration: 3600,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { discordIntegrationId: 'custom-identifier' },
      }

      const result = await handler(req, mockSession)

      expect(
        prisma.discordIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(
        mockSession.user,
        'custom-identifier',
        expect.any(Object)
      )
      expect(result.status).toBe(200)
    })
  })
})
