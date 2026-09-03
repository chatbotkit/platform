/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { deleteUser } from '@/lib/user.delete'

import handler from './delete'

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
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/user.delete', () => ({
  deleteUser: jest.fn(),
}))

describe('POST /api/v1/user/[userId]/delete', () => {
  const mockSession = {
    user: { id: 'parent_owner' },
  }

  const mockUser = {
    id: 'user_child_1',
    parentId: 'parent_owner',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should delete the user and return the id', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })
      deleteUser.mockResolvedValue(undefined)

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'user_child_1' })
    })

    it('should call deleteUser with the correct user id', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })
      deleteUser.mockResolvedValue(undefined)

      const req = { query: { userId: 'user_child_1' } }

      await handler(req, mockSession)

      expect(deleteUser).toHaveBeenCalledWith('user_child_1')
      expect(deleteUser).toHaveBeenCalledTimes(1)
    })

    it('should look up user by userId from URL params', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })
      deleteUser.mockResolvedValue(undefined)

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
      expect(deleteUser).not.toHaveBeenCalled()
    })

    it('should return 403 and not delete when user belongs to a different parent user', async () => {
      // @note this is the critical security check - a parent user must not be able
      // to delete users belonging to a different parent user
      prisma.user.findUniqueByIdentifier.mockResolvedValue({
        id: 'user_child_1',
        parentId: 'different_parent',
      })

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(deleteUser).not.toHaveBeenCalled()
    })

    it('should allow deletion when parentId matches session user id', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })
      deleteUser.mockResolvedValue(undefined)

      const req = { query: { userId: 'user_child_1' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(deleteUser).toHaveBeenCalledWith('user_child_1')
    })
  })

  describe('error handling', () => {
    it('should propagate errors from deleteUser', async () => {
      prisma.user.findUniqueByIdentifier.mockResolvedValue({ ...mockUser })
      deleteUser.mockRejectedValue(new Error('Deletion failed'))

      const req = { query: { userId: 'user_child_1' } }

      await expect(handler(req, mockSession)).rejects.toThrow('Deletion failed')
    })

    it('should propagate database lookup errors', async () => {
      prisma.user.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      const req = { query: { userId: 'user_child_1' } }

      await expect(handler(req, mockSession)).rejects.toThrow('Database error')
    })
  })
})
