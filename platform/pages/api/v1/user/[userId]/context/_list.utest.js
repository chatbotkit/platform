/**
 * @jest-environment node
 */
import handler from './list'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      context: {
        findMany: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/user.handler', () => ({
  withChildUserSession: (fn) => (req, session) => fn(null, req, null, session),
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (cursor, req, stream, session) =>
    fn(cursor, req, stream, session),
}))

jest.mock('@/lib/filter', () => ({
  getCursorConstraints: jest.fn(() => ({})),
  getMetaQueryFilter: jest.fn(() => []),
  getTakeConstraints: jest.fn(() => ({})),
  getFieldQueryFilter: jest.fn(() => []),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('GET /api/v1/user/[userId]/context/list', () => {
  const prismaClient = jest.requireMock('@/prisma/client').default

  const mockSession = {
    user: { id: 'child_user_1' },
  }

  const mockContexts = [
    {
      id: 'ctx_aaa',
      name: 'Context One',
      description: 'First context',
      blueprintId: 'bp_1',
      botId: 'bot_1',
      datasetId: null,
      skillsetId: null,
      payload: { tier: 'starter' },
      meta: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    },
    {
      id: 'ctx_bbb',
      name: 'Context Two',
      description: 'Second context',
      blueprintId: 'bp_2',
      botId: null,
      datasetId: null,
      skillsetId: null,
      payload: null,
      meta: { env: 'production' },
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-04'),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return contexts for the child session user', async () => {
      prismaClient.context.findMany.mockResolvedValue(mockContexts)

      const result = await handler({}, mockSession)

      expect(result).toEqual({ items: mockContexts })
    })

    it('should return empty items when no contexts exist', async () => {
      prismaClient.context.findMany.mockResolvedValue([])

      const result = await handler({}, mockSession)

      expect(result).toEqual({ items: [] })
    })
  })

  describe('user isolation', () => {
    it('should scope the query to the child session user id', async () => {
      // @note this is the critical multi-tenant isolation check - the WHERE
      // clause must always be scoped to the user, not the
      // parent. Without this, a parent user could access contexts across
      // all their users indiscriminately.
      prismaClient.context.findMany.mockResolvedValue([])

      await handler({}, mockSession)

      expect(prismaClient.context.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'child_user_1' }]),
          }),
        })
      )
    })

    it('should use different userId for a different child session', async () => {
      prismaClient.context.findMany.mockResolvedValue([])

      const otherChildSession = { user: { id: 'different_child_user_42' } }

      await handler({}, otherChildSession)

      expect(prismaClient.context.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { userId: 'different_child_user_42' },
            ]),
          }),
        })
      )
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      prismaClient.context.findMany.mockRejectedValue(new Error('query failed'))

      await expect(handler({}, mockSession)).rejects.toThrow('query failed')
    })
  })
})
