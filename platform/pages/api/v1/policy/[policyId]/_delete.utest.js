/**
 * @jest-environment node
 */
import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      policy: {
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

describe('POST /api/v1/policy/[policyId]/delete', () => {
  const prisma = jest.requireMock('@/prisma/client').default

  const mockSession = {
    user: { id: 'user_123' },
  }

  const mockReq = {
    query: { policyId: 'policy_abc' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should delete policy and return its id', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        id: 'policy_abc',
        userId: 'user_123',
      })
      prisma.policy.delete.mockResolvedValue({})

      const result = await handler(mockReq, mockSession)

      expect(prisma.policy.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'policy_abc',
        { select: { id: true, userId: true } }
      )
      expect(prisma.policy.delete).toHaveBeenCalledWith({
        where: { id: 'policy_abc' },
      })
      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'policy_abc' })
    })
  })

  describe('authorization', () => {
    it('should return 404 and not delete when policy is not found', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.policy.delete).not.toHaveBeenCalled()
    })

    it('should return 403 and not delete when user does not own the policy', async () => {
      // @note this guards against cross-user policy deletion - a critical security
      // invariant that must never be broken
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        id: 'policy_abc',
        userId: 'other_user_999',
      })

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.policy.delete).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should propagate database lookup errors', async () => {
      prisma.policy.findUniqueByIdentifier.mockRejectedValue(
        new Error('lookup failed')
      )

      await expect(handler(mockReq, mockSession)).rejects.toThrow(
        'lookup failed'
      )
      expect(prisma.policy.delete).not.toHaveBeenCalled()
    })

    it('should propagate database delete errors', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        id: 'policy_abc',
        userId: 'user_123',
      })
      prisma.policy.delete.mockRejectedValue(new Error('delete failed'))

      await expect(handler(mockReq, mockSession)).rejects.toThrow(
        'delete failed'
      )
    })
  })
})
