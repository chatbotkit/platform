/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    webhook: {
      findUniqueByIdentifier: jest.fn(),
      delete: jest.fn(),
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
  withPost: (fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: JSON.stringify(data) }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('/api/v1/webhook/[webhookId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  const createMockWebhook = () => ({
    id: 'webhook-456',
    userId: 'user-123',
  })

  const mockReq = {
    query: {
      webhookId: 'webhook-456',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful deletion', () => {
    it('should delete webhook when user is authorized', async () => {
      const mockWebhook = createMockWebhook()

      prisma.webhook.findUniqueByIdentifier.mockResolvedValue(mockWebhook)
      prisma.webhook.delete.mockResolvedValue(mockWebhook)

      const response = await handler(mockReq, mockSession)

      expect(prisma.webhook.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'webhook-456',
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

      expect(prisma.webhook.delete).toHaveBeenCalledWith({
        where: {
          id: 'webhook-456',
        },
      })

      expect(response.status).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ id: 'webhook-456' })
    })

    it('should return webhook id in response', async () => {
      const mockWebhook = createMockWebhook()

      prisma.webhook.findUniqueByIdentifier.mockResolvedValue(mockWebhook)
      prisma.webhook.delete.mockResolvedValue(mockWebhook)

      const response = await handler(mockReq, mockSession)
      const body = JSON.parse(response.body)

      expect(body).toHaveProperty('id')
      expect(body.id).toBe('webhook-456')
    })
  })

  describe('authorization checks', () => {
    it('should return 404 when webhook does not exist', async () => {
      prisma.webhook.findUniqueByIdentifier.mockResolvedValue(null)

      const response = await handler(mockReq, mockSession)

      expect(response.status).toBe(404)
      expect(prisma.webhook.delete).not.toHaveBeenCalled()
    })

    it('should return 401 when user is not the owner', async () => {
      const otherUserWebhook = {
        id: 'webhook-456',
        userId: 'other-user-789',
      }

      prisma.webhook.findUniqueByIdentifier.mockResolvedValue(otherUserWebhook)

      const response = await handler(mockReq, mockSession)

      expect(response.status).toBe(401)
      expect(prisma.webhook.delete).not.toHaveBeenCalled()
    })

    it('should check ownership before deletion', async () => {
      const otherUserWebhook = {
        id: 'webhook-456',
        userId: 'different-user',
      }

      prisma.webhook.findUniqueByIdentifier.mockResolvedValue(otherUserWebhook)

      await handler(mockReq, mockSession)

      expect(prisma.webhook.delete).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle database errors during find', async () => {
      prisma.webhook.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      await expect(handler(mockReq, mockSession)).rejects.toThrow(
        'Database error'
      )
    })

    it('should handle database errors during delete', async () => {
      prisma.webhook.findUniqueByIdentifier.mockResolvedValue(
        createMockWebhook()
      )
      prisma.webhook.delete.mockRejectedValue(new Error('Delete failed'))

      await expect(handler(mockReq, mockSession)).rejects.toThrow(
        'Delete failed'
      )
    })

    it('should use correct webhook identifier from URL', async () => {
      const customReq = {
        query: {
          webhookId: 'custom-webhook-id',
        },
      }

      prisma.webhook.findUniqueByIdentifier.mockResolvedValue({
        id: 'custom-webhook-id',
        userId: 'user-123',
      })
      prisma.webhook.delete.mockResolvedValue({})

      await handler(customReq, mockSession)

      expect(prisma.webhook.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'custom-webhook-id',
        expect.any(Object)
      )
    })

    it('should handle webhook with matching userId', async () => {
      const webhook = {
        id: 'webhook-999',
        userId: 'user-123',
      }

      prisma.webhook.findUniqueByIdentifier.mockResolvedValue(webhook)
      prisma.webhook.delete.mockResolvedValue(webhook)

      const response = await handler(mockReq, mockSession)

      expect(response.status).toBe(200)
      expect(prisma.webhook.delete).toHaveBeenCalled()
    })
  })

  describe('query parameter handling', () => {
    it('should extract webhookId from request query', async () => {
      const req = {
        query: {
          webhookId: 'param-webhook-id',
        },
      }

      prisma.webhook.findUniqueByIdentifier.mockResolvedValue({
        id: 'param-webhook-id',
        userId: 'user-123',
      })
      prisma.webhook.delete.mockResolvedValue({})

      await handler(req, mockSession)

      expect(prisma.webhook.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'param-webhook-id',
        expect.any(Object)
      )
    })
  })
})
