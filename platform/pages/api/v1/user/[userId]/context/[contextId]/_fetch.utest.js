/**
 * @jest-environment node
 */
import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      context: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
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

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('GET /api/v1/user/[userId]/context/[contextId]/fetch', () => {
  const prisma = jest.requireMock('@/prisma/client').default

  const mockSession = {
    user: { id: 'child_user_1' },
  }

  const mockContext = {
    id: 'ctx_abc',
    userId: 'child_user_1',
    name: 'Onboarding Context',
    description: 'Customer onboarding context',
    blueprintId: 'blueprint_xyz',
    botId: 'bot_123',
    datasetId: null,
    skillsetId: null,
    payload: { tier: 'premium', locale: 'en-US' },
    meta: { source: 'user' },
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-01'),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return context with all expected fields', async () => {
      prisma.context.findUniqueByIdentifier.mockResolvedValue({
        ...mockContext,
      })

      const result = await handler(
        { query: { contextId: 'ctx_abc' } },
        mockSession
      )

      expect(prisma.context.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'ctx_abc',
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            userId: true,
            name: true,
            description: true,
            blueprintId: true,
            botId: true,
            datasetId: true,
            skillsetId: true,
            payload: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          }),
        })
      )

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('ctx_abc')
      expect(result.body.payload).toEqual({ tier: 'premium', locale: 'en-US' })
      expect(result.body.botId).toBe('bot_123')
    })

    it('should strip userId from the response', async () => {
      prisma.context.findUniqueByIdentifier.mockResolvedValue({
        ...mockContext,
      })

      const result = await handler(
        { query: { contextId: 'ctx_abc' } },
        mockSession
      )

      expect(result.status).toBe(200)
      // @note userId is an internal field that must not be exposed to API consumers
      expect(result.body.userId).toBeUndefined()
      expect(result.body.id).toBe('ctx_abc')
    })
  })

  describe('authorization', () => {
    it('should return 404 when context is not found', async () => {
      prisma.context.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(
        { query: { contextId: 'nonexistent' } },
        mockSession
      )

      expect(result.status).toBe(404)
    })

    it('should return 403 when context belongs to a different user', async () => {
      // @note this prevents a parent user from fetching another user's contexts
      // by guessing context IDs - a critical multi-tenant isolation check
      prisma.context.findUniqueByIdentifier.mockResolvedValue({
        ...mockContext,
        userId: 'other_child_user_999',
      })

      const result = await handler(
        { query: { contextId: 'ctx_abc' } },
        mockSession
      )

      expect(result.status).toBe(403)
    })

    it('should return 200 when context belongs to the current user', async () => {
      prisma.context.findUniqueByIdentifier.mockResolvedValue({
        ...mockContext,
      })

      const result = await handler(
        { query: { contextId: 'ctx_abc' } },
        mockSession
      )

      expect(result.status).toBe(200)
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      prisma.context.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB error')
      )

      await expect(
        handler({ query: { contextId: 'ctx_abc' } }, mockSession)
      ).rejects.toThrow('DB error')
    })
  })
})
