/**
 * @jest-environment node
 */
import handler from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      policy: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
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

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((incoming, existing) => ({ ...existing, ...incoming })),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
  badRequest: (message) => ({ status: 400, body: { message } }),
}))

jest.mock('@/prisma/types', () => ({
  PolicyType: { retention: 'retention', usage: 'usage' },
  ResourceState: { enabled: 'enabled', disabled: 'disabled' },
}))

describe('POST /api/v1/policy/[policyId]/update', () => {
  const prisma = jest.requireMock('@/prisma/client').default

  const mockSession = {
    user: { id: 'user_123' },
  }

  const mockReq = {
    query: { policyId: 'policy_abc' },
  }

  const mockExistingPolicy = {
    id: 'policy_abc',
    userId: 'user_123',
    meta: { source: 'existing' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should update policy and return its id', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        ...mockExistingPolicy,
      })
      prisma.policy.update.mockResolvedValue({})

      const body = {
        name: 'Updated Policy',
        description: 'New description',
        type: 'retention',
        config: { expiresInDays: 60 },
        meta: { source: 'test' },
      }

      const result = await handler(mockReq, mockSession, body)

      expect(prisma.policy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'policy_abc' },
          data: expect.objectContaining({
            name: 'Updated Policy',
            description: 'New description',
            type: 'retention',
            config: { expiresInDays: 60 },
          }),
        })
      )
      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'policy_abc' })
    })

    it('should persist the lifecycle state', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        ...mockExistingPolicy,
      })
      prisma.policy.update.mockResolvedValue({})

      const body = { state: 'disabled' }

      await handler(mockReq, mockSession, body)

      expect(prisma.policy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            state: 'disabled',
          }),
        })
      )
    })

    it('should accept blueprintId as a string reference', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        ...mockExistingPolicy,
      })
      prisma.policy.update.mockResolvedValue({})

      const body = { blueprintId: 'blueprint_xyz' }

      await handler(mockReq, mockSession, body)

      expect(prisma.policy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'blueprint_xyz',
          }),
        })
      )
    })

    it('should prefer blueprintId.id when blueprint is an object', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        ...mockExistingPolicy,
      })
      prisma.policy.update.mockResolvedValue({})

      const body = { blueprintId: { id: 'blueprint_from_object' } }

      await handler(mockReq, mockSession, body)

      expect(prisma.policy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'blueprint_from_object',
          }),
        })
      )
    })

    it('should merge meta using getMeta', async () => {
      const { getMeta } = jest.requireMock('@/lib/meta')

      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        ...mockExistingPolicy,
      })
      prisma.policy.update.mockResolvedValue({})

      const body = { meta: { source: 'updated', newKey: 'newVal' } }

      await handler(mockReq, mockSession, body)

      expect(getMeta).toHaveBeenCalledWith(
        { source: 'updated', newKey: 'newVal' },
        { source: 'existing' }
      )
    })
  })

  describe('config validation by row type', () => {
    it('should persist a config validated against the policy type', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        ...mockExistingPolicy,
      })
      prisma.policy.update.mockResolvedValue({})

      const body = {
        type: 'retention',
        config: { expiresInDays: 45 },
      }

      await handler(mockReq, mockSession, body)

      expect(prisma.policy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            config: { expiresInDays: 45 },
          }),
        })
      )
    })

    it('should reject when changing type leaves the existing config mismatched', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        ...mockExistingPolicy,
        type: 'retention',
        config: { expiresInDays: 30 },
      })
      prisma.policy.update.mockResolvedValue({})

      // switching to a usage policy without providing a usage config must fail:
      // the existing retention config is validated against the new type
      const body = { type: 'usage' }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(400)
      expect(prisma.policy.update).not.toHaveBeenCalled()
    })

    it('should reject a config whose shape does not match the policy type', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        ...mockExistingPolicy,
      })

      const body = {
        type: 'usage',
        config: { expiresInDays: 30 },
      }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(400)
      expect(prisma.policy.update).not.toHaveBeenCalled()
    })
  })

  describe('authorization', () => {
    it('should return 404 and not update when policy is not found', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(404)
      expect(prisma.policy.update).not.toHaveBeenCalled()
    })

    it('should return 403 and not update when user does not own the policy', async () => {
      // @note prevents cross-user policy modification - a user must only be
      // able to update policies they own
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        ...mockExistingPolicy,
        userId: 'other_user_999',
      })

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(403)
      expect(prisma.policy.update).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should propagate database lookup errors', async () => {
      prisma.policy.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB error')
      )

      await expect(handler(mockReq, mockSession, {})).rejects.toThrow(
        'DB error'
      )
      expect(prisma.policy.update).not.toHaveBeenCalled()
    })
  })
})
