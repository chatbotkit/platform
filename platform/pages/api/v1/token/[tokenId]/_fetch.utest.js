/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    token: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/session.handler', () => ({
  withUserSession: (fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: JSON.stringify(data) }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

describe('/api/v1/token/[tokenId]/fetch', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  const createMockToken = () => ({
    id: 'token-456',
    userId: 'user-123',
    name: 'Test Token',
    description: 'Test Description',
    config: { key: 'value' },
    meta: { tag: 'test' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  })

  const mockReq = {
    query: {
      tokenId: 'token-456',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful fetch', () => {
    it('should fetch token when user is authorized', async () => {
      prisma.token.findUniqueByIdentifier.mockResolvedValue(createMockToken())

      const response = await handler(mockReq, mockSession)

      expect(prisma.token.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'token-456',
        {
          select: {
            id: true,
            userId: true,
            name: true,
            description: true,
            config: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          },
        }
      )

      expect(response.status).toBe(200)
    })

    it('should return token data without userId', async () => {
      prisma.token.findUniqueByIdentifier.mockResolvedValue(createMockToken())

      const response = await handler(mockReq, mockSession)
      const body = JSON.parse(response.body)

      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('name')
      expect(body).toHaveProperty('description')
      expect(body).toHaveProperty('config')
      expect(body).toHaveProperty('meta')
      expect(body).toHaveProperty('createdAt')
      expect(body).toHaveProperty('updatedAt')
      expect(body).not.toHaveProperty('userId')
    })

    it('should return all expected fields', async () => {
      prisma.token.findUniqueByIdentifier.mockResolvedValue(createMockToken())

      const response = await handler(mockReq, mockSession)
      const body = JSON.parse(response.body)

      expect(body.id).toBe('token-456')
      expect(body.name).toBe('Test Token')
      expect(body.description).toBe('Test Description')
      expect(body.config).toEqual({ key: 'value' })
      expect(body.meta).toEqual({ tag: 'test' })
    })
  })

  describe('authorization checks', () => {
    it('should return 404 when token does not exist', async () => {
      prisma.token.findUniqueByIdentifier.mockResolvedValue(null)

      const response = await handler(mockReq, mockSession)

      expect(response.status).toBe(404)
    })

    it('should return 401 when user is not the owner', async () => {
      const otherUserToken = {
        ...createMockToken(),
        userId: 'other-user-789',
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(otherUserToken)

      const response = await handler(mockReq, mockSession)

      expect(response.status).toBe(401)
    })

    it('should verify ownership before returning token', async () => {
      const otherUserToken = {
        ...createMockToken(),
        userId: 'different-user',
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(otherUserToken)

      const response = await handler(mockReq, mockSession)

      expect(response.status).toBe(401)
    })
  })

  describe('edge cases', () => {
    it('should handle database errors', async () => {
      prisma.token.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      await expect(handler(mockReq, mockSession)).rejects.toThrow(
        'Database error'
      )
    })

    it('should use correct token identifier from URL', async () => {
      const customReq = {
        query: {
          tokenId: 'custom-token-id',
        },
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue({
        ...createMockToken(),
        id: 'custom-token-id',
      })

      await handler(customReq, mockSession)

      expect(prisma.token.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'custom-token-id',
        expect.any(Object)
      )
    })

    it('should handle token with null config', async () => {
      const tokenWithNullConfig = {
        ...createMockToken(),
        config: null,
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(tokenWithNullConfig)

      const response = await handler(mockReq, mockSession)
      const body = JSON.parse(response.body)

      expect(body.config).toBeNull()
    })

    it('should handle token with null meta', async () => {
      const tokenWithNullMeta = {
        ...createMockToken(),
        meta: null,
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(tokenWithNullMeta)

      const response = await handler(mockReq, mockSession)
      const body = JSON.parse(response.body)

      expect(body.meta).toBeNull()
    })

    it('should handle token with empty description', async () => {
      const tokenWithEmptyDesc = {
        ...createMockToken(),
        description: '',
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(tokenWithEmptyDesc)

      const response = await handler(mockReq, mockSession)
      const body = JSON.parse(response.body)

      expect(body.description).toBe('')
    })

    it('should handle token with complex config object', async () => {
      const complexConfig = {
        nested: {
          key: 'value',
          array: [1, 2, 3],
          boolean: true,
        },
      }

      const tokenWithComplexConfig = {
        ...createMockToken(),
        config: complexConfig,
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(
        tokenWithComplexConfig
      )

      const response = await handler(mockReq, mockSession)
      const body = JSON.parse(response.body)

      expect(body.config).toEqual(complexConfig)
    })
  })

  describe('query parameter handling', () => {
    it('should extract tokenId from request query', async () => {
      const req = {
        query: {
          tokenId: 'param-token-id',
        },
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue({
        ...createMockToken(),
        id: 'param-token-id',
      })

      await handler(req, mockSession)

      expect(prisma.token.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'param-token-id',
        expect.any(Object)
      )
    })
  })

  describe('response structure', () => {
    it('should return JSON-safe response', async () => {
      const tokenWithDates = {
        ...createMockToken(),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(tokenWithDates)

      const response = await handler(mockReq, mockSession)
      const body = JSON.parse(response.body)

      expect(body.createdAt).toBeDefined()
      expect(body.updatedAt).toBeDefined()
    })

    it('should ensure userId is removed from response', async () => {
      const tokenWithUserId = {
        ...createMockToken(),
        userId: 'user-123',
      }

      prisma.token.findUniqueByIdentifier.mockResolvedValue(tokenWithUserId)

      const response = await handler(mockReq, mockSession)
      const body = JSON.parse(response.body)

      expect(body.userId).toBeUndefined()
    })
  })
})
