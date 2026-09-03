/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './fetch'

import { createMocks } from 'node-mocks-http'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (handler) => async (req, res) => {
    const session = {
      user: {
        id: 'user123',
        email: 'test@example.com',
      },
    }

    return handler(req, session, res)
  },
}))

describe('GET /api/v1/integration/telegram/[telegramIntegrationId]/fetch', () => {
  beforeEach(() => {
    mockReset(prisma)
  })

  describe('successful fetch', () => {
    it('should fetch telegram integration successfully', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { telegramIntegrationId: 'telegram123' },
      })

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        name: 'Test Bot',
        description: 'Test Description',
        blueprintId: 'blueprint123',
        botId: 'bot123',
        contactCollection: true,
        sessionDuration: 3600000,
        attachments: false,
        meta: { key: 'value' },
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)

      const data = JSON.parse(res._getData())

      expect(data.id).toBe('telegram123')
      expect(data.name).toBe('Test Bot')
      expect(data.userId).toBeUndefined() // userId should be removed
    })

    it('should remove userId from response', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { telegramIntegrationId: 'telegram123' },
      })

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        name: 'Test Bot',
        description: '',
        blueprintId: null,
        botId: 'bot123',
        contactCollection: false,
        sessionDuration: 3600000,
        attachments: true,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)

      const data = JSON.parse(res._getData())

      expect(data).not.toHaveProperty('userId')
      expect(data).not.toHaveProperty('botToken')
    })

    it('should handle all configuration fields', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { telegramIntegrationId: 'telegram123' },
      })

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        name: 'Advanced Bot',
        description: 'Complex configuration',
        blueprintId: 'blueprint456',
        botId: 'bot456',
        contactCollection: true,
        sessionDuration: 7200000,
        attachments: true,
        meta: { custom: 'data', nested: { value: 123 } },
        createdAt: new Date('2025-01-10'),
        updatedAt: new Date('2025-01-15'),
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)

      const data = JSON.parse(res._getData())

      expect(data.contactCollection).toBe(true)
      expect(data.sessionDuration).toBe(7200000)
      expect(data.attachments).toBe(true)
      expect(data.meta).toEqual({ custom: 'data', nested: { value: 123 } })
    })
  })

  describe('error handling', () => {
    it('should return 404 if integration not found', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { telegramIntegrationId: 'nonexistent' },
      })

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      await handler(req, res)

      expect(res._getStatusCode()).toBe(404)
    })

    it('should return 403 if user does not own integration', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { telegramIntegrationId: 'telegram123' },
      })

      const mockIntegration = {
        id: 'telegram123',
        userId: 'differentUser',
        name: 'Test Bot',
        description: '',
        blueprintId: null,
        botId: 'bot123',
        contactCollection: false,
        sessionDuration: 3600000,
        attachments: false,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      await handler(req, res)

      expect(res._getStatusCode()).toBe(403)
    })

    it('should handle database errors gracefully', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { telegramIntegrationId: 'telegram123' },
      })

      prisma.telegramIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection failed')
      )

      await handler(req, res)

      expect(res._getStatusCode()).toBe(500)
    })
  })

  describe('authorization checks', () => {
    it('should verify user ownership before returning data', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { telegramIntegrationId: 'telegram123' },
      })

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        name: 'Test Bot',
        description: '',
        blueprintId: null,
        botId: 'bot123',
        contactCollection: false,
        sessionDuration: 3600000,
        attachments: false,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      await handler(req, res)

      expect(
        prisma.telegramIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user123' }),
        'telegram123',
        expect.any(Object)
      )
    })
  })

  describe('edge cases', () => {
    it('should handle missing telegramIntegrationId', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {},
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
    })

    it('should handle null meta field', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { telegramIntegrationId: 'telegram123' },
      })

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        name: 'Test Bot',
        description: '',
        blueprintId: null,
        botId: 'bot123',
        contactCollection: false,
        sessionDuration: 3600000,
        attachments: false,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)

      const data = JSON.parse(res._getData())

      expect(data.meta).toBeNull()
    })

    it('should handle optional blueprint field', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { telegramIntegrationId: 'telegram123' },
      })

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        name: 'Test Bot',
        description: '',
        blueprintId: null,
        botId: 'bot123',
        contactCollection: false,
        sessionDuration: 3600000,
        attachments: false,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)

      const data = JSON.parse(res._getData())

      expect(data.blueprintId).toBeNull()
    })
  })

  describe('security', () => {
    it('should never expose botToken in response', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { telegramIntegrationId: 'telegram123' },
      })

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        name: 'Test Bot',
        description: '',
        blueprintId: null,
        botId: 'bot123',
        contactCollection: false,
        sessionDuration: 3600000,
        attachments: false,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)

      const data = JSON.parse(res._getData())

      expect(data).not.toHaveProperty('botToken')
    })
  })
})
