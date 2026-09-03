/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
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

describe('/api/v1/rating/[ratingId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('successful deletion', () => {
    it('should delete rating when user is authorized', async () => {
      const mockRating = {
        id: 'rtg_abc123',
        userId: 'user-123',
        value: -50,
        reason: 'Test rating',
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.delete.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_abc123' },
      }

      const result = await handler(req, mockSession)

      expect(prisma.rating.findUnique).toHaveBeenCalledWith({
        where: { id: 'rtg_abc123' },
      })
      expect(prisma.rating.delete).toHaveBeenCalledWith({
        where: { id: 'rtg_abc123' },
      })
      expect(result).toEqual({ status: 200, body: { id: 'rtg_abc123' } })
    })

    it('should handle ratings with different user ids', async () => {
      const mockRating = {
        id: 'rtg_xyz789',
        userId: 'user-123',
        value: 75,
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.delete.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_xyz789' },
      }

      const result = await handler(req, mockSession)

      expect(result).toEqual({ status: 200, body: { id: 'rtg_xyz789' } })
    })
  })

  describe('not found scenarios', () => {
    it('should return 404 when rating does not exist', async () => {
      prisma.rating.findUnique.mockResolvedValue(null)

      const req = {
        query: { ratingId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result).toEqual({ status: 404 })
      expect(prisma.rating.delete).not.toHaveBeenCalled()
    })

    it('should return 404 for empty rating id', async () => {
      prisma.rating.findUnique.mockResolvedValue(null)

      const req = {
        query: { ratingId: '' },
      }

      const result = await handler(req, mockSession)

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

      const result = await handler(req, mockSession)

      expect(result).toEqual({ status: 401 })
      expect(prisma.rating.delete).not.toHaveBeenCalled()
    })

    it('should not delete rating with mismatched user id', async () => {
      const mockRating = {
        id: 'rtg_protected',
        userId: 'another-user-456',
        value: -25,
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_protected' },
      }

      const result = await handler(req, mockSession)

      expect(result).toEqual({ status: 401 })
      expect(prisma.rating.delete).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle rating with minimal data', async () => {
      const mockRating = {
        id: 'rtg_minimal',
        userId: 'user-123',
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.delete.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_minimal' },
      }

      const result = await handler(req, mockSession)

      expect(result).toEqual({ status: 200, body: { id: 'rtg_minimal' } })
    })

    it('should handle special characters in rating id', async () => {
      const mockRating = {
        id: 'rtg_special-123_abc',
        userId: 'user-123',
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.delete.mockResolvedValue(mockRating)

      const req = {
        query: { ratingId: 'rtg_special-123_abc' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
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

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
      expect(prisma.rating.delete).not.toHaveBeenCalled()
    })

    it('should handle database errors during delete', async () => {
      const mockRating = {
        id: 'rtg_abc123',
        userId: 'user-123',
      }

      prisma.rating.findUnique.mockResolvedValue(mockRating)
      prisma.rating.delete.mockRejectedValue(new Error('Deletion failed'))

      const req = {
        query: { ratingId: 'rtg_abc123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Deletion failed')
    })
  })
})
