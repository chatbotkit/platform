/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './list'

const mockFindMany = jest.fn()

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    task: {
      findMany: (...args) => mockFindMany(...args),
    },
  },
}))

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
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getMetaQueryFilter: jest.fn(() => []),
  getFieldQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

const {
  getBlueprintIdQueryFilter,
  getMetaQueryFilter,
  getFieldQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('/api/v1/task/list', () => {
  const mockSession = {
    user: {
      id: 'user_abc123',
    },
  }

  beforeEach(() => {
    mockFindMany.mockReset()
    getBlueprintIdQueryFilter.mockReturnValue([])
    getMetaQueryFilter.mockReturnValue([])
    getFieldQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  describe('basic functionality', () => {
    it('should list all tasks for the authenticated user', async () => {
      const mockTasks = [
        {
          id: 'task_1',
          name: 'Daily Report',
          description: 'Generates a daily report',
          contactId: null,
          botId: 'bot_1',
          schedule: 'daily',
          timezone: 'America/New_York',
          status: 'idle',
          outcome: 'success',
          maxIterations: 10,
          maxTime: 300000,
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'task_2',
          name: 'Weekly Sync',
          description: 'Weekly data sync',
          contactId: 'contact_1',
          botId: null,
          schedule: 'weekly',
          timezone: null,
          status: 'running',
          outcome: 'pending',
          maxIterations: null,
          maxTime: null,
          meta: { environment: 'production' },
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ]

      mockFindMany.mockResolvedValue(mockTasks)

      const result = await handler(null, {}, null, mockSession)

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([{ userId: 'user_abc123' }]),
          },
        })
      )
      expect(result).toEqual({ items: mockTasks })
      expect(result.items[0]).toHaveProperty('timezone', 'America/New_York')
      expect(result.items[1]).toHaveProperty('timezone', null)
    })

    it('should return empty array when the user has no tasks', async () => {
      mockFindMany.mockResolvedValue([])

      const result = await handler(null, {}, null, mockSession)

      expect(result).toEqual({ items: [] })
    })

    it('should include all required task fields in the select clause', async () => {
      mockFindMany.mockResolvedValue([])

      await handler(null, {}, null, mockSession)

      const selectFields = mockFindMany.mock.calls[0][0].select

      expect(selectFields).toMatchObject({
        id: true,
        name: true,
        description: true,
        blueprintId: true,
        contactId: true,
        botId: true,
        schedule: true,
        timezone: true,
        status: true,
        outcome: true,
        maxIterations: true,
        maxTime: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      })
    })
  })

  describe('user isolation', () => {
    it('should always scope queries to the session user id', async () => {
      mockFindMany.mockResolvedValue([])

      const sessionUser1 = { user: { id: 'user_001' } }
      const sessionUser2 = { user: { id: 'user_002' } }

      await handler(null, {}, null, sessionUser1)
      await handler(null, {}, null, sessionUser2)

      const [call1, call2] = mockFindMany.mock.calls

      expect(call1[0].where.AND).toEqual(
        expect.arrayContaining([{ userId: 'user_001' }])
      )
      expect(call2[0].where.AND).toEqual(
        expect.arrayContaining([{ userId: 'user_002' }])
      )

      // ensure user_002 filter is not present in the first call
      expect(call1[0].where.AND).not.toEqual(
        expect.arrayContaining([{ userId: 'user_002' }])
      )
    })

    it('should not return tasks belonging to other users', async () => {
      // Tasks from another user should never appear because userId is always
      // injected into the WHERE clause - the mock simulates the DB already
      // filtering correctly.
      mockFindMany.mockResolvedValue([])

      await handler(null, {}, null, mockSession)

      const callArgs = mockFindMany.mock.calls[0][0]

      // The userId filter must be the first AND condition
      expect(callArgs.where.AND[0]).toEqual({ userId: 'user_abc123' })
    })
  })

  describe('field filtering', () => {
    it('should apply botId field filter when present', async () => {
      getFieldQueryFilter.mockReturnValue([{ botId: 'bot_filter_1' }])
      mockFindMany.mockResolvedValue([])

      const req = { query: { botId: 'bot_filter_1' } }

      await handler(null, req, null, mockSession)

      expect(getFieldQueryFilter).toHaveBeenCalledWith(
        req,
        expect.arrayContaining(['botId', 'contactId', 'status'])
      )
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([{ botId: 'bot_filter_1' }]),
          },
        })
      )
    })

    it('should apply contactId field filter when present', async () => {
      getFieldQueryFilter.mockReturnValue([{ contactId: 'contact_filter_1' }])
      mockFindMany.mockResolvedValue([])

      const req = { query: { contactId: 'contact_filter_1' } }

      await handler(null, req, null, mockSession)

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([{ contactId: 'contact_filter_1' }]),
          },
        })
      )
    })

    it('should apply status field filter when present', async () => {
      getFieldQueryFilter.mockReturnValue([{ status: 'running' }])
      mockFindMany.mockResolvedValue([])

      const req = { query: { status: 'running' } }

      await handler(null, req, null, mockSession)

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([{ status: 'running' }]),
          },
        })
      )
    })

    it('should filter on all supported field names', async () => {
      mockFindMany.mockResolvedValue([])

      const req = {}

      await handler(null, req, null, mockSession)

      expect(getFieldQueryFilter).toHaveBeenCalledWith(
        req,
        expect.arrayContaining(['botId', 'contactId', 'status'])
      )
    })
  })

  describe('meta filtering', () => {
    it('should apply meta query filter', async () => {
      const metaFilter = { meta: { path: ['env'], equals: 'production' } }

      getMetaQueryFilter.mockReturnValue([metaFilter])
      mockFindMany.mockResolvedValue([])

      const req = { query: { meta: { env: 'production' } } }

      await handler(null, req, null, mockSession)

      expect(getMetaQueryFilter).toHaveBeenCalledWith(req)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([metaFilter]),
          },
        })
      )
    })

    it('should combine userId, field, and meta filters in the AND clause', async () => {
      const metaFilter = {
        meta: { path: ['category'], equals: 'scheduled' },
      }
      const fieldFilter = { botId: 'bot_combined' }

      getMetaQueryFilter.mockReturnValue([metaFilter])
      getFieldQueryFilter.mockReturnValue([fieldFilter])
      mockFindMany.mockResolvedValue([])

      const req = {
        query: {
          botId: 'bot_combined',
          meta: { category: 'scheduled' },
        },
      }

      await handler(null, req, null, mockSession)

      const andClause = mockFindMany.mock.calls[0][0].where.AND

      expect(andClause).toEqual(
        expect.arrayContaining([
          { userId: 'user_abc123' },
          metaFilter,
          fieldFilter,
        ])
      )
    })
  })

  describe('pagination', () => {
    it('should pass cursor constraints from the cursor argument', async () => {
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'task_cursor_1' },
        skip: 1,
        orderBy: [{ createdAt: 'desc' }],
      })
      mockFindMany.mockResolvedValue([])

      const req = { query: { cursor: 'task_cursor_1' } }

      await handler('task_cursor_1', req, null, mockSession)

      expect(getCursorConstraints).toHaveBeenCalledWith(req, 'task_cursor_1')
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'task_cursor_1' },
          skip: 1,
          orderBy: [{ createdAt: 'desc' }],
        })
      )
    })

    it('should apply take constraints', async () => {
      getTakeConstraints.mockReturnValue({ take: 25 })
      mockFindMany.mockResolvedValue([])

      const req = { query: { take: '25' } }

      await handler(null, req, null, mockSession)

      expect(getTakeConstraints).toHaveBeenCalledWith(req)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25 })
      )
    })

    it('should handle no pagination parameters gracefully', async () => {
      getCursorConstraints.mockReturnValue({})
      getTakeConstraints.mockReturnValue({})
      mockFindMany.mockResolvedValue([])

      await handler(null, {}, null, mockSession)

      expect(mockFindMany).toHaveBeenCalled()
    })
  })

  describe('data transformation', () => {
    it('should pass results through makeJsonSafe', async () => {
      const mockTasks = [
        {
          id: 'task_safe',
          name: 'Safe Task',
          description: '',
          contactId: null,
          botId: null,
          schedule: 'never',
          status: 'idle',
          outcome: 'pending',
          maxIterations: null,
          maxTime: null,
          meta: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockFindMany.mockResolvedValue(mockTasks)

      const { makeJsonSafe } = require('@/lib/struct')

      await handler(null, {}, null, mockSession)

      expect(makeJsonSafe).toHaveBeenCalledWith(mockTasks)
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      mockFindMany.mockRejectedValue(new Error('Database connection failed'))

      await expect(handler(null, {}, null, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should propagate filter processing errors', async () => {
      getFieldQueryFilter.mockImplementation(() => {
        throw new Error('Invalid field filter')
      })

      await expect(
        handler(null, { query: { botId: 'bad' } }, null, mockSession)
      ).rejects.toThrow('Invalid field filter')
    })
  })
})
