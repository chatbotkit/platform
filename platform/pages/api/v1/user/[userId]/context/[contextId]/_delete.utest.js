/**
 * @jest-environment node
 */
import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      context: {
        findUniqueByIdentifier: jest.fn(),
        delete: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/user.handler', () => ({
  withChildUserSession: (fn) => (req, session) => fn(req, session),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

describe('POST /api/v1/user/[userId]/context/[contextId]/delete', () => {
  const prisma = jest.requireMock('@/prisma/client').default

  const mockSession = {
    user: { id: 'child_user_1' },
  }

  const mockReq = {
    query: { contextId: 'ctx_abc' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should delete context and return its id', async () => {
      prisma.context.findUniqueByIdentifier.mockResolvedValue({
        id: 'ctx_abc',
        userId: 'child_user_1',
      })
      prisma.context.delete.mockResolvedValue({})

      const result = await handler(mockReq, mockSession)

      expect(prisma.context.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'ctx_abc',
        { select: { id: true, userId: true } }
      )
      expect(prisma.context.delete).toHaveBeenCalledWith({
        where: { id: 'ctx_abc' },
      })
      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'ctx_abc' })
    })
  })

  describe('authorization', () => {
    it('should return 404 and not delete when context is not found', async () => {
      prisma.context.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.context.delete).not.toHaveBeenCalled()
    })

    it('should return 403 and not delete when context belongs to a different user', async () => {
      // @note a parent user must only be able to delete contexts that belong to
      // their own user - cross-user deletion must be rejected
      prisma.context.findUniqueByIdentifier.mockResolvedValue({
        id: 'ctx_abc',
        userId: 'other_child_user_999',
      })

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.context.delete).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should propagate database lookup errors without deleting', async () => {
      prisma.context.findUniqueByIdentifier.mockRejectedValue(
        new Error('lookup failed')
      )

      await expect(handler(mockReq, mockSession)).rejects.toThrow(
        'lookup failed'
      )
      expect(prisma.context.delete).not.toHaveBeenCalled()
    })

    it('should propagate database delete errors', async () => {
      prisma.context.findUniqueByIdentifier.mockResolvedValue({
        id: 'ctx_abc',
        userId: 'child_user_1',
      })
      prisma.context.delete.mockRejectedValue(new Error('delete failed'))

      await expect(handler(mockReq, mockSession)).rejects.toThrow(
        'delete failed'
      )
    })
  })
})
