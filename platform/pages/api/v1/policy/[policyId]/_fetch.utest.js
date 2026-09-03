/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    policy: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

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

describe('GET /api/v1/policy/[policyId]/fetch', () => {
  const mockSession = {
    user: { id: 'user_123' },
  }

  const mockPolicy = {
    id: 'policy_abc',
    name: 'Retention Policy',
    description: 'Keeps data for 30 days',
    userId: 'user_123',
    blueprintId: 'blueprint_xyz',
    type: 'retention',
    config: { retentionDays: 30 },
    meta: { env: 'prod' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return policy with all expected fields', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({ ...mockPolicy })

      const result = await handler(
        { query: { policyId: 'policy_abc' } },
        mockSession
      )

      expect(prisma.policy.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'policy_abc',
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            alias: true,
            name: true,
            description: true,
            userId: true,
            blueprintId: true,
            type: true,
            config: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          }),
        })
      )

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('policy_abc')
      expect(result.body.type).toBe('retention')
      expect(result.body.config).toEqual({ retentionDays: 30 })
    })

    it('should strip userId from the response', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({ ...mockPolicy })

      const result = await handler(
        { query: { policyId: 'policy_abc' } },
        mockSession
      )

      expect(result.status).toBe(200)
      expect(result.body.userId).toBeUndefined()
      expect(result.body.id).toBe('policy_abc')
    })
  })

  describe('authorization', () => {
    it('should return 404 when policy is not found', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(
        { query: { policyId: 'nonexistent' } },
        mockSession
      )

      expect(result.status).toBe(404)
    })

    it('should return 403 when user does not own the policy', async () => {
      // @note this is the critical cross-user isolation check - a user must not
      // be able to fetch another user's policy configuration
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        ...mockPolicy,
        userId: 'other_user_999',
      })

      const result = await handler(
        { query: { policyId: 'policy_abc' } },
        mockSession
      )

      expect(result.status).toBe(403)
    })

    it('should return 200 when userId matches session user', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({ ...mockPolicy })

      const result = await handler(
        { query: { policyId: 'policy_abc' } },
        mockSession
      )

      expect(result.status).toBe(200)
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      prisma.policy.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB connection failed')
      )

      await expect(
        handler({ query: { policyId: 'policy_abc' } }, mockSession)
      ).rejects.toThrow('DB connection failed')
    })
  })
})
