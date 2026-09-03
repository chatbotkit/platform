/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { bodySchema } from './update'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const createChainableMock = () => {
    const mock = {
      required: () => mock,
      optional: () => mock,
      allow: () => mock,
      valid: () => mock,
      min: () => mock,
      max: () => mock,
      describe: () => ({ keys: {} }),
    }

    return mock
  }

  const mockSchema = {
    object: (fields) => ({
      ...createChainableMock(),
      describe: () => ({ keys: fields || {} }),
    }),
    string: () => createChainableMock(),
    number: () => createChainableMock(),
    boolean: () => createChainableMock(),
    array: () => createChainableMock(),
  }

  return {
    __esModule: true,
    default: mockSchema,
    withSchema: (schema, fn) => fn,
  }
})

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404, body: { error: 'Not found' } }),
  notAuthorized: () => ({ status: 403, body: { error: 'Not authorized' } }),
}))

describe('POST /api/v1/integration/telegram/[telegramIntegrationId]/update', () => {
  beforeEach(() => {
    mockReset(prisma)
  })

  const mockRequest = (telegramIntegrationId = 'telegram123') => ({
    query: { telegramIntegrationId },
  })

  const mockSession = {
    user: {
      id: 'user123',
      email: 'test@example.com',
    },
  }

  describe('successful update', () => {
    it('should update telegram integration successfully', async () => {
      const body = {
        name: 'Updated Bot',
        description: 'Updated description',
        botId: 'bot456',
        contactCollection: true,
        sessionDuration: 7200000,
        attachments: true,
      }

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        meta: null,
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.telegramIntegration.update.mockResolvedValue(mockIntegration)

      const response = await handler(mockRequest(), mockSession, body)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ id: 'telegram123' })
      expect(prisma.telegramIntegration.update).toHaveBeenCalledWith({
        where: { id: 'telegram123' },
        data: expect.objectContaining({
          name: 'Updated Bot',
          description: 'Updated description',
          botId: 'bot456',
          contactCollection: true,
          sessionDuration: 7200000,
          attachments: true,
        }),
      })
    })

    it('should handle partial updates', async () => {
      const body = {
        name: 'New Name',
      }

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        meta: null,
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.telegramIntegration.update.mockResolvedValue(mockIntegration)

      const response = await handler(mockRequest(), mockSession, body)

      expect(response.status).toBe(200)
      expect(prisma.telegramIntegration.update).toHaveBeenCalledWith({
        where: { id: 'telegram123' },
        data: expect.objectContaining({
          name: 'New Name',
        }),
      })
    })

    it('should update bot token', async () => {
      const body = {
        botToken: 'new-bot-token-12345',
      }

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        meta: null,
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.telegramIntegration.update.mockResolvedValue(mockIntegration)

      const response = await handler(mockRequest(), mockSession, body)

      expect(response.status).toBe(200)
      expect(prisma.telegramIntegration.update).toHaveBeenCalledWith({
        where: { id: 'telegram123' },
        data: expect.objectContaining({
          botToken: 'new-bot-token-12345',
        }),
      })
    })

    it('should update blueprint link', async () => {
      const body = {
        blueprintId: 'blueprint789',
      }

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        meta: null,
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.telegramIntegration.update.mockResolvedValue(mockIntegration)

      const response = await handler(mockRequest(), mockSession, body)

      expect(response.status).toBe(200)
      expect(prisma.telegramIntegration.update).toHaveBeenCalledWith({
        where: { id: 'telegram123' },
        data: expect.objectContaining({
          blueprintId: 'blueprint789',
        }),
      })
    })

    it('should handle meta updates', async () => {
      const body = {
        meta: { custom: 'data' },
      }

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        meta: { existing: 'value' },
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.telegramIntegration.update.mockResolvedValue(mockIntegration)

      const response = await handler(mockRequest(), mockSession, body)

      expect(response.status).toBe(200)
    })
  })

  describe('validation', () => {
    it('should allow null session duration', async () => {
      const body = {
        sessionDuration: null,
      }

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        meta: null,
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.telegramIntegration.update.mockResolvedValue(mockIntegration)

      const response = await handler(mockRequest(), mockSession, body)

      expect(response.status).toBe(200)
    })

    it('should allow empty bot token', async () => {
      const body = {
        botToken: '',
      }

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        meta: null,
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.telegramIntegration.update.mockResolvedValue(mockIntegration)

      const response = await handler(mockRequest(), mockSession, body)

      expect(response.status).toBe(200)
    })
  })

  describe('error handling', () => {
    it('should return 404 if integration not found', async () => {
      const body = { name: 'Test' }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const response = await handler(
        mockRequest('nonexistent'),
        mockSession,
        body
      )

      expect(response.status).toBe(404)
      expect(prisma.telegramIntegration.update).not.toHaveBeenCalled()
    })

    it('should return 403 if user does not own integration', async () => {
      const body = { name: 'Test' }

      const mockIntegration = {
        id: 'telegram123',
        userId: 'differentUser',
        meta: null,
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const response = await handler(mockRequest(), mockSession, body)

      expect(response.status).toBe(403)
      expect(prisma.telegramIntegration.update).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      const body = { name: 'Test' }

      prisma.telegramIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      await expect(handler(mockRequest(), mockSession, body)).rejects.toThrow(
        'Database error'
      )
    })
  })

  describe('authorization checks', () => {
    it('should verify user ownership before update', async () => {
      const body = { name: 'Test' }

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        meta: null,
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.telegramIntegration.update.mockResolvedValue(mockIntegration)

      await handler(mockRequest(), mockSession, body)

      expect(
        prisma.telegramIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user123' }),
        'telegram123'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle missing telegramIntegrationId', async () => {
      const body = { name: 'Test' }
      const badRequest = { query: {} }

      await expect(handler(badRequest, mockSession, body)).rejects.toThrow()
    })

    it('should update all fields at once', async () => {
      const body = {
        name: 'Complete Update',
        description: 'New description',
        blueprintId: 'blueprint123',
        botId: 'bot123',
        botToken: 'new-token',
        contactCollection: false,
        sessionDuration: 1800000,
        attachments: true,
        meta: { key: 'value' },
      }

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        meta: null,
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.telegramIntegration.update.mockResolvedValue(mockIntegration)

      const response = await handler(mockRequest(), mockSession, body)

      expect(response.status).toBe(200)
      expect(prisma.telegramIntegration.update).toHaveBeenCalledWith({
        where: { id: 'telegram123' },
        data: expect.objectContaining({
          name: 'Complete Update',
          description: 'New description',
          blueprintId: 'blueprint123',
          botId: 'bot123',
          botToken: 'new-token',
          contactCollection: false,
          sessionDuration: 1800000,
          attachments: true,
        }),
      })
    })

    it('should handle boolean false values correctly', async () => {
      const body = {
        contactCollection: false,
        attachments: false,
      }

      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        meta: null,
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.telegramIntegration.update.mockResolvedValue(mockIntegration)

      const response = await handler(mockRequest(), mockSession, body)

      expect(response.status).toBe(200)
      expect(prisma.telegramIntegration.update).toHaveBeenCalledWith({
        where: { id: 'telegram123' },
        data: expect.objectContaining({
          contactCollection: false,
          attachments: false,
        }),
      })
    })
  })

  describe('bodySchema', () => {
    it('should be defined', () => {
      expect(bodySchema).toBeDefined()
    })

    it('should have describe method', () => {
      expect(typeof bodySchema.describe).toBe('function')
    })
  })
})
