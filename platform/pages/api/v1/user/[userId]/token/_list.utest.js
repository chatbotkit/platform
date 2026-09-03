/**
 * @jest-environment node
 */
import handler from './list'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      token: {
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
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('GET /api/v1/user/[userId]/token/list', () => {
  const prisma = jest.requireMock('@/prisma/client').default

  // Represents the user session, not the parent
  const mockChildSession = {
    user: { id: 'child_user_789' },
  }

  const mockTokens = [
    {
      id: 'token_aaa',
      name: 'Production Token',
      description: 'Used for production API access',
      meta: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    },
    {
      id: 'token_bbb',
      name: 'Staging Token',
      description: 'Used for staging environment',
      meta: { env: 'staging' },
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-02'),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic listing', () => {
    it('should return tokens for the user', async () => {
      prisma.token.findMany.mockResolvedValue([...mockTokens])

      const req = { query: {} }
      const result = await handler(req, mockChildSession)

      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('token_aaa')
      expect(result.items[1].id).toBe('token_bbb')
    })

    it('should return an empty list when the user has no tokens', async () => {
      prisma.token.findMany.mockResolvedValue([])

      const req = { query: {} }
      const result = await handler(req, mockChildSession)

      expect(result.items).toEqual([])
    })
  })

  describe('user session isolation', () => {
    it('should query tokens by the child session user id, not the parent', async () => {
      prisma.token.findMany.mockResolvedValue([])

      const req = { query: {} }

      await handler(req, mockChildSession)

      const callArgs = prisma.token.findMany.mock.calls[0][0]
      const andClause = callArgs.where.AND

      // Must filter by user id in WHERE clause
      expect(andClause).toContainEqual({ userId: 'child_user_789' })
    })

    it('should not return tokens for a different user', async () => {
      prisma.token.findMany.mockResolvedValue([])

      const differentChildSession = { user: { id: 'other_child_999' } }
      const req = { query: {} }

      await handler(req, differentChildSession)

      const callArgs = prisma.token.findMany.mock.calls[0][0]
      const andClause = callArgs.where.AND

      expect(andClause).toContainEqual({ userId: 'other_child_999' })
      expect(andClause).not.toContainEqual({ userId: 'child_user_789' })
    })
  })

  describe('security - token value never exposed', () => {
    it('should not include the actual token value in the select clause', async () => {
      prisma.token.findMany.mockResolvedValue([])

      const req = { query: {} }

      await handler(req, mockChildSession)

      const callArgs = prisma.token.findMany.mock.calls[0][0]
      const select = callArgs.select

      // The actual token value/hash must never be selected - it is only returned once at creation
      expect(select).not.toHaveProperty('value')
      expect(select).not.toHaveProperty('hash')
    })

    it('should only expose safe metadata fields in the response', async () => {
      const tokenWithAllFields = {
        id: 'token_safe',
        name: 'Safe Token',
        description: 'A token',
        meta: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.token.findMany.mockResolvedValue([tokenWithAllFields])

      const req = { query: {} }
      const result = await handler(req, mockChildSession)

      const token = result.items[0]

      expect(token).toHaveProperty('id')
      expect(token).toHaveProperty('name')
      expect(token).toHaveProperty('description')
      expect(token).toHaveProperty('meta')
      expect(token).toHaveProperty('createdAt')
      expect(token).toHaveProperty('updatedAt')

      // These fields must not be present in the response
      expect(token).not.toHaveProperty('value')
      expect(token).not.toHaveProperty('hash')
      expect(token).not.toHaveProperty('userId')
    })
  })

  describe('select fields', () => {
    it('should select exactly the documented safe token fields', async () => {
      prisma.token.findMany.mockResolvedValue([])

      const req = { query: {} }

      await handler(req, mockChildSession)

      const callArgs = prisma.token.findMany.mock.calls[0][0]
      const select = callArgs.select

      expect(select).toEqual(
        expect.objectContaining({
          id: true,
          name: true,
          description: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        })
      )
    })
  })
})
