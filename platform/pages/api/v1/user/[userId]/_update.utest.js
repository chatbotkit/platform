/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      user: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((newMeta, _existingMeta) => newMeta),
}))

describe('POST /api/v1/user/[userId]/update', () => {
  const mockSession = {
    user: { id: 'parent_owner' },
  }

  const mockUser = {
    id: 'user_child_1',
    parentId: 'parent_owner',
    meta: { existing: 'value' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should update the user and return the id', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })
      prisma.user.update.mockResolvedValue({ id: 'user_child_1' })

      const req = { query: { userId: 'user_child_1' } }

      const body = {
        name: 'Updated Name',
        description: 'New description',
        email: 'new@example.com',
        limits: { tokens: 200 },
        meta: { tier: 'pro' },
      }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'user_child_1' })
    })

    it('should update with correct data including parentContextEmail mapping', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })
      prisma.user.update.mockResolvedValue({ id: 'user_child_1' })

      const req = { query: { userId: 'user_child_1' } }

      const body = {
        name: 'Acme Corp',
        description: 'Enterprise customer',
        email: 'admin@acme.com',
        image: 'https://example.com/logo.png',
        limits: { tokens: 500 },
        meta: { tier: 'enterprise' },
      }

      await handler(req, mockSession, body)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_child_1' },
        data: {
          name: 'Acme Corp',
          description: 'Enterprise customer',
          image: 'https://example.com/logo.png',
          parentContextName: 'Acme Corp',
          parentContextEmail: 'admin@acme.com',
          limits: { tokens: 500 },
          meta: expect.anything(),
        },
      })
    })

    it('should set parentContextName to the same value as name', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })
      prisma.user.update.mockResolvedValue({ id: 'user_child_1' })

      const req = { query: { userId: 'user_child_1' } }
      const body = { name: 'New Name', email: 'test@example.com' }

      await handler(req, mockSession, body)

      const updateCall = prisma.user.update.mock.calls[0][0]

      expect(updateCall.data.parentContextName).toBe('New Name')
    })

    it('should look up user by userId from URL params', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })
      prisma.user.update.mockResolvedValue({ id: 'user_child_1' })

      const req = { query: { userId: 'user_child_1' } }

      await handler(req, mockSession, {})

      expect(prisma.user.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'user_child_1'
      )
    })
  })

  describe('authorization - multi-tenant isolation', () => {
    it('should return 404 when user does not exist', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { userId: 'nonexistent_user' } }

      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(404)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('should return 403 and not update when user belongs to a different parent user', async () => {
      // @note this is the critical security check - a parent user must not be able
      // to update users belonging to a different parent user
      prisma.user.findUniqueByIdentifier.mockResolvedValue({
        ...mockUser,
        parentId: 'different_parent',
      })

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession, { name: 'Hack attempt' })

      expect(result.status).toBe(403)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('should allow update when parentId matches session user id', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })
      prisma.user.update.mockResolvedValue({ id: 'user_child_1' })

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession, {
        name: 'Legitimate Update',
      })

      expect(result.status).toBe(200)
      expect(prisma.user.update).toHaveBeenCalledTimes(1)
    })
  })

  describe('error handling', () => {
    it('should propagate errors from prisma update', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })
      prisma.user.update.mockRejectedValue(new Error('Update failed'))

      const req = { query: { userId: 'user_child_1' } }

      await expect(handler(req, mockSession, { name: 'Test' })).rejects.toThrow(
        'Update failed'
      )
    })
  })
})
