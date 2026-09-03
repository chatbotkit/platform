/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      user: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
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
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('GET /api/v1/user/[userId]/fetch', () => {
  const mockSession = {
    user: { id: 'parent_owner' },
  }

  const mockUser = {
    id: 'user_child_1',
    name: 'Child User',
    parentId: 'parent_owner',
    image: 'https://example.com/img.png',
    parentContextEmail: 'customer@example.com',
    limits: { tokens: 100 },
    meta: { tier: 'basic' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return user data on success', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('user_child_1')
      expect(result.body.name).toBe('Child User')
    })

    it('should expose parentContextEmail as email in the response', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession)

      expect(result.body.email).toBe('customer@example.com')
    })

    it('should not expose parentContextEmail directly in the response', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession)

      expect(result.body.parentContextEmail).toBeUndefined()
    })

    it('should not expose parentId in the response', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession)

      expect(result.body.parentId).toBeUndefined()
    })

    it('should call findUniqueByIdentifier with session user and userId param', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })

      const req = { query: { userId: 'user_child_1' } }

      await handler(req, mockSession)

      expect(prisma.user.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'user_child_1',
        expect.objectContaining({
          select: expect.objectContaining({ id: true, parentId: true }),
        })
      )
    })
  })

  describe('authorization - multi-tenant isolation', () => {
    it('should return 404 when user does not exist', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { userId: 'nonexistent_user' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user belongs to a different parent user', async () => {
      // @note this is the critical multi-tenant isolation check - a parent user must
      // only be able to fetch their own users, not another parent user's
      prisma.user.findUniqueByIdentifier.mockResolvedValue({
        ...mockUser,
        parentId: 'different_parent',
      })

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })

    it('should return 200 when parentId matches session user id', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
    })
  })

  describe('response shape', () => {
    it('should include limits in the response', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession)

      expect(result.body.limits).toEqual({ tokens: 100 })
    })

    it('should include meta in the response', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession)

      expect(result.body.meta).toEqual({ tier: 'basic' })
    })

    it('should handle null parentContextEmail by exposing null as email', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({
        ...mockUser,
        parentContextEmail: null,
      })

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession)

      expect(result.body.email).toBeNull()
    })
  })
})
