/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    token: {
      findUniqueByIdentifier: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withUserSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('POST /api/v1/token/[tokenId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful deletion', () => {
    it('should delete token when user is owner', async () => {
      const mockToken = {
        id: 'token-123',
        userId: 'user-123',
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(mockToken)
      prisma.token.delete.mockResolvedValue(mockToken)

      const req = {
        query: { tokenId: 'token-123' },
      }

      const result = await handler(req, mockSession)

      expect(prisma.token.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'token-123',
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

      expect(prisma.token.delete).toHaveBeenCalledWith({
        where: {
          id: 'token-123',
        },
      })

      expect(result).toEqual({ status: 200, body: { id: 'token-123' } })
    })

    it('should return token id in response', async () => {
      const mockToken = {
        id: 'token-456',
        userId: 'user-123',
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(mockToken)
      prisma.token.delete.mockResolvedValue(mockToken)

      const req = {
        query: { tokenId: 'token-456' },
      }

      const result = await handler(req, mockSession)

      expect(result.body).toHaveProperty('id')
      expect(result.body.id).toBe('token-456')
    })
  })

  describe('not found scenarios', () => {
    it('should return 404 when token does not exist', async () => {
      prisma.token.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { tokenId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(prisma.token.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'nonexistent',
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

      expect(prisma.token.delete).not.toHaveBeenCalled()
      expect(result.status).toBe(404)
    })

    it('should not attempt delete when token not found', async () => {
      prisma.token.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { tokenId: 'missing-token' },
      }

      await handler(req, mockSession)

      expect(prisma.token.delete).not.toHaveBeenCalled()
    })
  })

  describe('authorization', () => {
    it('should return 401 when user is not token owner', async () => {
      const mockToken = {
        id: 'token-123',
        userId: 'other-user-456',
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(mockToken)

      const req = {
        query: { tokenId: 'token-123' },
      }

      const result = await handler(req, mockSession)

      expect(prisma.token.findUniqueByIdentifier).toHaveBeenCalled()
      expect(prisma.token.delete).not.toHaveBeenCalled()
      expect(result.status).toBe(401)
    })

    it('should not delete token belonging to another user', async () => {
      const mockToken = {
        id: 'token-789',
        userId: 'different-user',
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(mockToken)

      const req = {
        query: { tokenId: 'token-789' },
      }

      await handler(req, mockSession)

      expect(prisma.token.delete).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle empty tokenId', async () => {
      const req = {
        query: { tokenId: '' },
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(null)

      await handler(req, mockSession)

      expect(prisma.token.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        '',
        expect.any(Object)
      )
    })

    it('should handle special characters in tokenId', async () => {
      const tokenId = 'token-with-!@#$%'

      prisma.token.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { tokenId },
      }

      await handler(req, mockSession)

      expect(prisma.token.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        tokenId,
        expect.any(Object)
      )
    })

    it('should handle very long tokenId', async () => {
      const tokenId = 'a'.repeat(1000)

      prisma.token.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { tokenId },
      }

      await handler(req, mockSession)

      expect(prisma.token.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        tokenId,
        expect.any(Object)
      )
    })
  })

  describe('database errors', () => {
    it('should propagate findUniqueByIdentifier errors', async () => {
      const error = new Error('Database connection failed')

      prisma.token.findUniqueByIdentifier.mockRejectedValue(error)

      const req = {
        query: { tokenId: 'token-123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should propagate delete errors', async () => {
      const mockToken = {
        id: 'token-123',
        userId: 'user-123',
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(mockToken)
      prisma.token.delete.mockRejectedValue(new Error('Delete failed'))

      const req = {
        query: { tokenId: 'token-123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Delete failed')
    })
  })
})
