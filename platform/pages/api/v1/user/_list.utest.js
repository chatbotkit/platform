/**
 * @jest-environment node
 */
import handler from './list'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      user: {
        findMany: jest.fn(),
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

describe('GET /api/v1/user/list', () => {
  const prismaClient = jest.requireMock('@/prisma/client').default

  const mockSession = {
    user: { id: 'parent_account_1' },
  }

  const mockUsers = [
    {
      id: 'child_user_aaa',
      name: 'Alice',
      image: null,
      parentContextEmail: 'alice@example.com',
      limits: { maxBots: 5 },
      meta: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    },
    {
      id: 'child_user_bbb',
      name: 'Bob',
      image: 'https://example.com/bob.png',
      parentContextEmail: null,
      limits: null,
      meta: { tier: 'enterprise' },
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-04'),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('email field remapping', () => {
    it('should expose parentContextEmail as email in the response', async () => {
      prismaClient.user.findMany.mockResolvedValue([...mockUsers])

      const result = await handler(null, {}, null, mockSession)

      expect(result.items[0].email).toBe('alice@example.com')
      expect(result.items[1].email).toBeNull()
    })

    it('should not expose parentContextEmail directly in the response', async () => {
      // @note parentContextEmail is an internal field name - the public API
      // exposes it as 'email' only. Leaking the internal name would expose
      // implementation details and break the public contract.
      prismaClient.user.findMany.mockResolvedValue([...mockUsers])

      const result = await handler(null, {}, null, mockSession)

      expect(result.items[0].parentContextEmail).toBeUndefined()
      expect(result.items[1].parentContextEmail).toBeUndefined()
    })

    it('should preserve all other user fields alongside the remapped email', async () => {
      prismaClient.user.findMany.mockResolvedValue([mockUsers[0]])

      const result = await handler(null, {}, null, mockSession)

      const item = result.items[0]

      expect(item.id).toBe('child_user_aaa')
      expect(item.name).toBe('Alice')
      expect(item.limits).toEqual({ maxBots: 5 })
      expect(item.email).toBe('alice@example.com')
    })
  })

  describe('user isolation', () => {
    it('should scope the query to the session user as parentId', async () => {
      // @note this ensures a parent user can only list their own users and
      // cannot access another parent user's user list
      prismaClient.user.findMany.mockResolvedValue([])

      await handler(null, {}, null, mockSession)

      expect(prismaClient.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ parentId: 'parent_account_1' }]),
          }),
        })
      )
    })
  })

  describe('basic functionality', () => {
    it('should return empty items when no users exist', async () => {
      prismaClient.user.findMany.mockResolvedValue([])

      const result = await handler(null, {}, null, mockSession)

      expect(result).toEqual({ items: [] })
    })

    it('should return all users mapped to the items array', async () => {
      prismaClient.user.findMany.mockResolvedValue([...mockUsers])

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toHaveLength(2)
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      prismaClient.user.findMany.mockRejectedValue(new Error('db error'))

      await expect(handler(null, {}, null, mockSession)).rejects.toThrow(
        'db error'
      )
    })
  })
})
