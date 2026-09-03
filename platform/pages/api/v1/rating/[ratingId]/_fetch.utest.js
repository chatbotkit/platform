/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { makeJsonSafe } from '@/lib/struct'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query?.[param]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((obj) => obj),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('/api/v1/rating/[ratingId]/fetch', () => {
  beforeEach(() => {
    mockReset(prisma)
  })

  describe('successful fetch', () => {
    it('should fetch rating by id for authorized user', async () => {
      const mockRequest = {
        query: {
          ratingId: 'rtg_test123',
        },
      }

      const mockSession = {
        user: {
          id: 'usr_owner123',
        },
      }

      const mockRating = {
        id: 'rtg_test123',
        userId: 'usr_owner123',
        contactId: 'ctc_contact123',
        botId: 'bot_test456',
        conversationId: 'cnv_conv789',
        messageId: 'msg_message012',
        name: 'Test Rating',
        description: 'Test description',
        value: 100,
        reason: 'Excellent response',
        meta: { category: 'quality' },
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)

      const response = await handler(mockRequest, mockSession)

      expect(prisma.rating.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'rtg_test123',
        },
        select: expect.objectContaining({
          id: true,
          userId: true,
          contactId: true,
          botId: true,
          conversationId: true,
          messageId: true,
          name: true,
          description: true,
          value: true,
          reason: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        }),
      })

      expect(makeJsonSafe).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).not.toHaveProperty('userId')
    })

    it('should remove userId from response', async () => {
      const mockRequest = {
        query: {
          ratingId: 'rtg_test456',
        },
      }

      const mockSession = {
        user: {
          id: 'usr_owner456',
        },
      }

      const mockRating = {
        id: 'rtg_test456',
        userId: 'usr_owner456',
        value: 50,
        reason: 'Good',
        contactId: null,
        botId: null,
        conversationId: null,
        messageId: null,
        name: '',
        description: '',
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)

      const response = await handler(mockRequest, mockSession)

      expect(response.status).toBe(200)
      expect(response.body).not.toHaveProperty('userId')
      expect(response.body.id).toBe('rtg_test456')
    })

    it('should handle ratings with null optional fields', async () => {
      const mockRequest = {
        query: {
          ratingId: 'rtg_minimal',
        },
      }

      const mockSession = {
        user: {
          id: 'usr_owner789',
        },
      }

      const mockRating = {
        id: 'rtg_minimal',
        userId: 'usr_owner789',
        contactId: null,
        botId: null,
        conversationId: null,
        messageId: null,
        name: '',
        description: '',
        value: 0,
        reason: null,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)

      const response = await handler(mockRequest, mockSession)

      expect(response.status).toBe(200)
      expect(response.body.value).toBe(0)
      expect(response.body.reason).toBeNull()
      expect(response.body.meta).toBeNull()
    })

    it('should handle negative rating values', async () => {
      const mockRequest = {
        query: {
          ratingId: 'rtg_negative',
        },
      }

      const mockSession = {
        user: {
          id: 'usr_owner321',
        },
      }

      const mockRating = {
        id: 'rtg_negative',
        userId: 'usr_owner321',
        value: -100,
        reason: 'Poor performance',
        contactId: 'ctc_test',
        botId: 'bot_test',
        conversationId: 'cnv_test',
        messageId: 'msg_test',
        name: 'Negative Rating',
        description: 'Test negative rating',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)

      const response = await handler(mockRequest, mockSession)

      expect(response.status).toBe(200)
      expect(response.body.value).toBe(-100)
      expect(response.body.reason).toBe('Poor performance')
    })
  })

  describe('error cases', () => {
    it('should return 404 when rating not found', async () => {
      const mockRequest = {
        query: {
          ratingId: 'rtg_nonexistent',
        },
      }

      const mockSession = {
        user: {
          id: 'usr_owner123',
        },
      }

      prisma.rating.findUnique.mockResolvedValue(null)

      const response = await handler(mockRequest, mockSession)

      expect(response.status).toBe(404)
      expect(prisma.rating.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'rtg_nonexistent',
        },
        select: expect.any(Object),
      })
    })

    it('should return 401 when user does not own rating', async () => {
      const mockRequest = {
        query: {
          ratingId: 'rtg_test123',
        },
      }

      const mockSession = {
        user: {
          id: 'usr_wrongowner',
        },
      }

      const mockRating = {
        id: 'rtg_test123',
        userId: 'usr_rightowner',
        contactId: 'ctc_test',
        botId: 'bot_test',
        conversationId: 'cnv_test',
        messageId: 'msg_test',
        name: 'Test Rating',
        description: 'Test',
        value: 100,
        reason: 'Great',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)

      const response = await handler(mockRequest, mockSession)

      expect(response.status).toBe(401)
    })

    it('should handle database errors', async () => {
      const mockRequest = {
        query: {
          ratingId: 'rtg_test123',
        },
      }

      const mockSession = {
        user: {
          id: 'usr_owner123',
        },
      }

      prisma.rating.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(handler(mockRequest, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle ratings with complex meta objects', async () => {
      const mockRequest = {
        query: {
          ratingId: 'rtg_complex',
        },
      }

      const mockSession = {
        user: {
          id: 'usr_owner999',
        },
      }

      const mockRating = {
        id: 'rtg_complex',
        userId: 'usr_owner999',
        contactId: 'ctc_test',
        botId: 'bot_test',
        conversationId: 'cnv_test',
        messageId: 'msg_test',
        name: 'Complex Rating',
        description: 'Complex metadata test',
        value: 75,
        reason: 'Good with issues',
        meta: {
          category: 'quality',
          severity: 'medium',
          tags: ['helpful', 'accurate'],
          nested: {
            level1: {
              level2: 'deep value',
            },
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)

      const response = await handler(mockRequest, mockSession)

      expect(response.status).toBe(200)
      expect(response.body.meta).toEqual(mockRating.meta)
    })

    it('should handle ratings with special characters in text fields', async () => {
      const mockRequest = {
        query: {
          ratingId: 'rtg_special',
        },
      }

      const mockSession = {
        user: {
          id: 'usr_owner555',
        },
      }

      const mockRating = {
        id: 'rtg_special',
        userId: 'usr_owner555',
        contactId: 'ctc_test',
        botId: 'bot_test',
        conversationId: 'cnv_test',
        messageId: 'msg_test',
        name: 'Rating with "quotes" & <tags>',
        description: "Test's description with special chars: @#$%",
        value: 50,
        reason: 'Contains unicode: 你好 🎉',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)

      const response = await handler(mockRequest, mockSession)

      expect(response.status).toBe(200)
      expect(response.body.name).toBe('Rating with "quotes" & <tags>')
      expect(response.body.reason).toBe('Contains unicode: 你好 🎉')
    })

    it('should handle empty string ratingId', async () => {
      const mockRequest = {
        query: {
          ratingId: '',
        },
      }

      const mockSession = {
        user: {
          id: 'usr_owner123',
        },
      }

      prisma.rating.findUnique.mockResolvedValue(null)

      const response = await handler(mockRequest, mockSession)

      expect(response.status).toBe(404)
    })
  })
})
