/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { bodySchema } from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

describe('/api/v1/rating/create', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should create rating with minimal required fields', async () => {
      const mockRating = {
        id: 'rtg_abc123',
      }

      prisma.rating.create.mockResolvedValue(mockRating)

      const body = {
        value: 100,
      }

      const result = await handler(null, mockSession, body)

      expect(prisma.rating.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_123',
          name: undefined,
          description: undefined,
          contactId: undefined,
          botId: undefined,
          conversationId: undefined,
          messageId: undefined,
          value: 100,
          reason: undefined,
          meta: undefined,
        },
        select: {
          id: true,
        },
      })
      expect(result).toEqual({ status: 200, body: { id: 'rtg_abc123' } })
    })

    it('should create rating with all optional fields', async () => {
      const mockRating = {
        id: 'rtg_xyz789',
      }

      prisma.rating.create.mockResolvedValue(mockRating)

      const body = {
        name: 'Positive Feedback',
        description: 'User was very satisfied',
        contactId: { id: 'ctc_123' },
        botId: { id: 'bot_456' },
        conversationId: { id: 'cnv_789' },
        messageId: { id: 'msg_012' },
        value: 100,
        reason: 'Helpful and accurate response',
        meta: { category: 'accuracy', source: 'user' },
      }

      const result = await handler(null, mockSession, body)

      expect(prisma.rating.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_123',
          name: 'Positive Feedback',
          description: 'User was very satisfied',
          contactId: 'ctc_123',
          botId: 'bot_456',
          conversationId: 'cnv_789',
          messageId: 'msg_012',
          value: 100,
          reason: 'Helpful and accurate response',
          meta: { category: 'accuracy', source: 'user' },
        },
        select: {
          id: true,
        },
      })
      expect(result).toEqual({ status: 200, body: { id: 'rtg_xyz789' } })
    })

    it('should create negative rating', async () => {
      const mockRating = {
        id: 'rtg_neg123',
      }

      prisma.rating.create.mockResolvedValue(mockRating)

      const body = {
        value: -100,
        reason: 'Inaccurate response',
        botId: { id: 'bot_456' },
      }

      const result = await handler(null, mockSession, body)

      expect(prisma.rating.create).toHaveBeenCalled()
      expect(result).toEqual({ status: 200, body: { id: 'rtg_neg123' } })
    })
  })

  describe('resource linking', () => {
    it('should link rating to contact only', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rtg_1' })

      const body = {
        value: 50,
        contactId: { id: 'ctc_123' },
      }

      await handler(null, mockSession, body)

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contactId: 'ctc_123',
            botId: undefined,
            conversationId: undefined,
            messageId: undefined,
          }),
        })
      )
    })

    it('should link rating to bot and conversation', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rtg_2' })

      const body = {
        value: -50,
        botId: { id: 'bot_456' },
        conversationId: { id: 'cnv_789' },
      }

      await handler(null, mockSession, body)

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            botId: 'bot_456',
            conversationId: 'cnv_789',
          }),
        })
      )
    })

    it('should link rating to message and conversation', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rtg_3' })

      const body = {
        value: 0,
        conversationId: { id: 'cnv_789' },
        messageId: { id: 'msg_012' },
      }

      await handler(null, mockSession, body)

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: 'cnv_789',
            messageId: 'msg_012',
          }),
        })
      )
    })
  })

  describe('edge cases', () => {
    it('should handle null reason', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rtg_null' })

      const body = {
        value: 100,
        reason: null,
      }

      await handler(null, mockSession, body)

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: null,
          }),
        })
      )
    })

    it('should handle empty string reason', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rtg_empty' })

      const body = {
        value: 100,
        reason: '',
      }

      await handler(null, mockSession, body)

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: '',
          }),
        })
      )
    })

    it('should handle zero value rating', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rtg_zero' })

      const body = {
        value: 0,
        reason: 'Neutral response',
      }

      await handler(null, mockSession, body)

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            value: 0,
          }),
        })
      )
    })

    it('should handle fractional rating values', async () => {
      prisma.rating.create.mockResolvedValue({ id: 'rtg_frac' })

      const body = {
        value: 75.5,
      }

      await handler(null, mockSession, body)

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            value: 75.5,
          }),
        })
      )
    })
  })

  describe('error handling', () => {
    it('should handle database error', async () => {
      const dbError = new Error('Database connection failed')

      prisma.rating.create.mockRejectedValue(dbError)

      const body = {
        value: 100,
      }

      await expect(handler(null, mockSession, body)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle duplicate rating creation', async () => {
      const duplicateError = new Error('Unique constraint failed')

      prisma.rating.create.mockRejectedValue(duplicateError)

      const body = {
        value: 100,
        messageId: { id: 'msg_123' },
      }

      await expect(handler(null, mockSession, body)).rejects.toThrow(
        'Unique constraint failed'
      )
    })
  })

  describe('bodySchema validation', () => {
    it('should define required value field', () => {
      expect(bodySchema.describe().keys.value).toBeDefined()
      expect(bodySchema.describe().keys.value.flags?.presence).toBe('required')
    })

    it('should define optional fields', () => {
      const schema = bodySchema.describe()

      expect(schema.keys.contactId).toBeDefined()
      expect(schema.keys.botId).toBeDefined()
      expect(schema.keys.conversationId).toBeDefined()
      expect(schema.keys.messageId).toBeDefined()
      expect(schema.keys.reason).toBeDefined()
    })

    it('should allow null and empty string for reason', () => {
      const reasonSchema = bodySchema.describe().keys.reason

      expect(reasonSchema.allow).toContain(null)
      expect(reasonSchema.allow).toContain('')
    })
  })
})
