/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  microsoftteamsIntegration: {
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

describe('GET /api/v1/integration/microsoftteams/{microsoftteamsIntegrationId}/fetch', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful fetch', () => {
    it('should return Teams integration when user is owner', async () => {
      const mockIntegration = {
        id: 'ti-abc123',
        userId: 'user-123',
        name: 'My Teams Bot',
        description: 'A Teams bot',
        botFrameworkAppId: 'app-id-123',
        botId: 'bot-456',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { microsoftteamsIntegrationId: 'ti-abc123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const responseData = await result.json()

      expect(responseData.id).toBe('ti-abc123')
      expect(responseData.name).toBe('My Teams Bot')
      expect(responseData.userId).toBeUndefined()
    })

    it('should strip userId from response', async () => {
      const mockIntegration = {
        id: 'ti-abc123',
        userId: 'user-123',
        name: 'Test Bot',
      }

      prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { microsoftteamsIntegrationId: 'ti-abc123' },
      }

      const result = await handler(req, mockSession)
      const responseData = await result.json()

      expect(responseData.userId).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('should return 404 when integration not found', async () => {
      prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { microsoftteamsIntegrationId: 'ti-nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user is not owner', async () => {
      const mockIntegration = {
        id: 'ti-abc123',
        userId: 'other-user-456',
      }

      prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { microsoftteamsIntegrationId: 'ti-abc123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })

    it('should handle missing microsoftteamsIntegrationId', async () => {
      const req = {
        query: {},
      }

      await expect(handler(req, mockSession)).rejects.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle database errors', async () => {
      prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection failed')
      )

      const req = {
        query: { microsoftteamsIntegrationId: 'ti-abc123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })
})
