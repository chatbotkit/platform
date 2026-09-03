/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './update'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    rating: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
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

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
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
      validate: (data) => ({ value: data, error: null }),
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

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((newMeta, oldMeta) => ({ ...oldMeta, ...newMeta })),
}))

describe('/api/v1/rating/[ratingId]/update', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful updates', () => {
    it('should update rating with all fields', async () => {
      const mockRating = {
        id: 'rtg_abc123',
        userId: 'user-123',
        name: 'Old Name',
        description: 'Old Description',
        value: -50,
        reason: 'Old reason',
        meta: { oldKey: 'oldValue' },
      }

      const updateBody = {
        name: 'New Name',
        description: 'New Description',
        contactId: { id: 'cnt_123' },
        botId: { id: 'bot_456' },
        conversationId: { id: 'cnv_789' },
        messageId: { id: 'msg_012' },
        value: 75,
        reason: 'Updated after review',
        meta: { newKey: 'newValue' },
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.update.mockResolvedValue({
        ...mockRating,
        ...updateBody,
      })

      const req = {
        query: { ratingId: 'rtg_abc123' },
        body: updateBody,
      }

      const result = await handler(req, mockSession, updateBody)

      expect(result).toEqual({ status: 200, body: { id: 'rtg_abc123' } })
      expect(prisma.rating.update).toHaveBeenCalledWith({
        where: { id: 'rtg_abc123' },
        data: {
          name: 'New Name',
          description: 'New Description',
          contactId: 'cnt_123',
          botId: 'bot_456',
          conversationId: 'cnv_789',
          messageId: 'msg_012',
          value: 75,
          reason: 'Updated after review',
          meta: expect.any(Object),
        },
      })
    })

    it('should update only specific fields', async () => {
      const mockRating = {
        id: 'rtg_xyz789',
        userId: 'user-123',
        value: -25,
        meta: {},
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.update.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_xyz789' },
      }

      const body = {
        value: 50,
        reason: 'Revised assessment',
      }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 200, body: { id: 'rtg_xyz789' } })
      expect(prisma.rating.update).toHaveBeenCalledWith({
        where: { id: 'rtg_xyz789' },
        data: expect.objectContaining({
          value: 50,
          reason: 'Revised assessment',
        }),
      })
    })

    it('should update metadata only', async () => {
      const mockRating = {
        id: 'rtg_meta',
        userId: 'user-123',
        meta: { status: 'pending' },
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.update.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_meta' },
      }

      const body = {
        meta: { status: 'approved', reviewedBy: 'admin' },
      }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 200, body: { id: 'rtg_meta' } })
    })
  })

  describe('resource associations', () => {
    it('should update contact association', async () => {
      const mockRating = {
        id: 'rtg_contact',
        userId: 'user-123',
        meta: {},
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.update.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_contact' },
      }

      const body = { contactId: { id: 'cnt_new' } }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 200, body: { id: 'rtg_contact' } })
      expect(prisma.rating.update).toHaveBeenCalledWith({
        where: { id: 'rtg_contact' },
        data: expect.objectContaining({
          contactId: 'cnt_new',
        }),
      })
    })

    it('should update bot and conversation associations', async () => {
      const mockRating = {
        id: 'rtg_assoc',
        userId: 'user-123',
        meta: {},
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.update.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_assoc' },
      }

      const body = {
        botId: { id: 'bot_new' },
        conversationId: { id: 'cnv_new' },
      }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 200, body: { id: 'rtg_assoc' } })
      expect(prisma.rating.update).toHaveBeenCalledWith({
        where: { id: 'rtg_assoc' },
        data: expect.objectContaining({
          botId: 'bot_new',
          conversationId: 'cnv_new',
        }),
      })
    })
  })

  describe('not found scenarios', () => {
    it('should return 404 when rating does not exist', async () => {
      prisma.rating.findUnique.mockResolvedValue(null)

      const req = {
        query: { ratingId: 'nonexistent' },
      }

      const body = { value: 100 }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 404 })
      expect(prisma.rating.update).not.toHaveBeenCalled()
    })

    it('should return 404 for empty rating id', async () => {
      prisma.rating.findUnique.mockResolvedValue(null)

      const req = {
        query: { ratingId: '' },
      }

      const body = { value: 50 }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 404 })
    })
  })

  describe('authorization scenarios', () => {
    it('should return 401 when user does not own the rating', async () => {
      const mockRating = {
        id: 'rtg_abc123',
        userId: 'different-user',
        value: 50,
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_abc123' },
      }

      const body = { value: 100 }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 401 })
      expect(prisma.rating.update).not.toHaveBeenCalled()
    })

    it('should not update rating with mismatched user id', async () => {
      const mockRating = {
        id: 'rtg_protected',
        userId: 'another-user-456',
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_protected' },
      }

      const body = { reason: 'Attempted update' }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 401 })
      expect(prisma.rating.update).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle null reason field', async () => {
      const mockRating = {
        id: 'rtg_null',
        userId: 'user-123',
        meta: {},
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.update.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_null' },
      }

      const body = { reason: null }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 200, body: { id: 'rtg_null' } })
    })

    it('should handle empty string reason', async () => {
      const mockRating = {
        id: 'rtg_empty',
        userId: 'user-123',
        meta: {},
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.update.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_empty' },
      }

      const body = { reason: '' }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 200, body: { id: 'rtg_empty' } })
    })

    it('should handle negative rating values', async () => {
      const mockRating = {
        id: 'rtg_negative',
        userId: 'user-123',
        meta: {},
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.update.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_negative' },
      }

      const body = { value: -100 }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 200, body: { id: 'rtg_negative' } })
      expect(prisma.rating.update).toHaveBeenCalledWith({
        where: { id: 'rtg_negative' },
        data: expect.objectContaining({
          value: -100,
        }),
      })
    })

    it('should handle zero rating value', async () => {
      const mockRating = {
        id: 'rtg_zero',
        userId: 'user-123',
        meta: {},
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.update.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_zero' },
      }

      const body = { value: 0 }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 200, body: { id: 'rtg_zero' } })
    })
  })

  describe('error handling', () => {
    it('should handle database errors during find', async () => {
      prisma.rating.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      )

      const req = {
        query: { ratingId: 'rtg_abc123' },
      }

      const body = { value: 50 }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Database connection failed'
      )
      expect(prisma.rating.update).not.toHaveBeenCalled()
    })

    it('should handle database errors during update', async () => {
      const mockRating = {
        id: 'rtg_abc123',
        userId: 'user-123',
        meta: {},
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.update.mockRejectedValue(new Error('Update failed'))

      const req = {
        query: { ratingId: 'rtg_abc123' },
      }

      const body = { value: 75 }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Update failed'
      )
    })
  })

  describe('metadata merging', () => {
    it('should merge new metadata with existing', async () => {
      const mockRating = {
        id: 'rtg_merge',
        userId: 'user-123',
        meta: { existingKey: 'existingValue', status: 'old' },
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.update.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_merge' },
      }

      const body = {
        meta: { status: 'new', additionalKey: 'additionalValue' },
      }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 200, body: { id: 'rtg_merge' } })
    })
  })
})
