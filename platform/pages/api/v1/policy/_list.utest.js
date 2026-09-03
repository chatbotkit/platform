/**
 * @jest-environment node
 */
import handler from './list'

const mockFindMany = jest.fn()

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      policy: {
        findMany: (...args) => mockFindMany(...args),
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
  getMetaQueryFilter: jest.fn(() => []),
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getFieldQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('GET /api/v1/policy/list', () => {
  const mockSession = {
    user: { id: 'user_abc123' },
  }

  beforeEach(() => {
    mockFindMany.mockReset()

    const {
      getMetaQueryFilter,
      getBlueprintIdQueryFilter,
      getFieldQueryFilter,
      getCursorConstraints,
      getTakeConstraints,
    } = jest.requireMock('@/lib/filter')

    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getFieldQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  describe('basic functionality', () => {
    it('should return policies for the authenticated user', async () => {
      const mockPolicies = [
        {
          id: 'policy_1',
          name: 'Retention 30d',
          description: '',
          blueprintId: null,
          type: 'retention',
          config: {},
          meta: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      mockFindMany.mockResolvedValue(mockPolicies)

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toEqual(mockPolicies)
    })

    it('should filter by current user id', async () => {
      mockFindMany.mockResolvedValue([])

      await handler(null, {}, null, mockSession)

      const [query] = mockFindMany.mock.calls[0]

      expect(query.where.AND).toContainEqual({ userId: 'user_abc123' })
    })

    it('should return empty items when no policies exist', async () => {
      mockFindMany.mockResolvedValue([])

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toEqual([])
    })
  })

  describe('user isolation', () => {
    it('should scope queries to the session user only', async () => {
      const sessionUser1 = { user: { id: 'user_1' } }
      const sessionUser2 = { user: { id: 'user_2' } }

      mockFindMany.mockResolvedValue([])

      await handler(null, {}, null, sessionUser1)
      await handler(null, {}, null, sessionUser2)

      const [call1, call2] = mockFindMany.mock.calls

      expect(call1[0].where.AND).toContainEqual({ userId: 'user_1' })
      expect(call2[0].where.AND).toContainEqual({ userId: 'user_2' })
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      mockFindMany.mockRejectedValue(new Error('DB unavailable'))

      await expect(handler(null, {}, null, mockSession)).rejects.toThrow(
        'DB unavailable'
      )
    })
  })
})
