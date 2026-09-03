/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './list'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findMany: jest.fn(),
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
  getMetaQueryFilter: jest.fn(() => []),
  getFieldQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

// -------------------------------------------------------
// Test state
// -------------------------------------------------------

describe('GET /api/v1/conversation/list', () => {
  const {
    getMetaQueryFilter,
    getFieldQueryFilter,
    getCursorConstraints,
    getTakeConstraints,
  } = require('@/lib/filter')
  const { makeJsonSafe } = require('@/lib/struct')

  const mockSession = { user: { id: 'user_abc123' } }
  const mockCursor = null
  const mockReq = { query: {} }

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getFieldQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
    makeJsonSafe.mockImplementation((data) => data)
  })

  // -------------------------------------------------------
  // Basic functionality
  // -------------------------------------------------------

  describe('basic functionality', () => {
    it('should return an empty items array when no conversations exist', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result).toEqual({ items: [] })
    })

    it('should always filter by the authenticated user id', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, { user: { id: 'user_xyz999' } })

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user_xyz999' }]),
          }),
        })
      )
    })

    it('should select the expected fields', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            botId: true,
            contactId: true,
            taskId: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          }),
        })
      )
    })

    it('should return all conversations for the user', async () => {
      const conversations = [
        { id: 'conv_1', botId: 'bot_1', contactId: null, taskId: null },
        { id: 'conv_2', botId: 'bot_2', contactId: 'contact_1', taskId: null },
      ]

      prisma.conversation.findMany.mockResolvedValue(conversations)

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('conv_1')
      expect(result.items[1].id).toBe('conv_2')
    })

    it('should call makeJsonSafe on the results', async () => {
      const conversations = [{ id: 'conv_1' }]

      prisma.conversation.findMany.mockResolvedValue(conversations)
      makeJsonSafe.mockReturnValue([{ id: 'conv_1_safe' }])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(makeJsonSafe).toHaveBeenCalledWith(conversations)
      expect(result.items[0].id).toBe('conv_1_safe')
    })
  })

  // -------------------------------------------------------
  // Meta filtering
  // -------------------------------------------------------

  describe('meta filtering', () => {
    it('should pass meta filters from the request to the query', async () => {
      const metaFilter = [{ meta: { path: ['key'], equals: 'value' } }]

      getMetaQueryFilter.mockReturnValue(metaFilter)
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(getMetaQueryFilter).toHaveBeenCalledWith(mockReq)
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { userId: 'user_abc123' },
              ...metaFilter,
            ]),
          }),
        })
      )
    })

    it('should include no meta conditions when getMetaQueryFilter returns empty', async () => {
      getMetaQueryFilter.mockReturnValue([])
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ userId: 'user_abc123' }] },
        })
      )
    })
  })

  // -------------------------------------------------------
  // Field filtering (botId, contactId, taskId)
  // -------------------------------------------------------

  describe('field filtering', () => {
    it('should pass field filters for botId, contactId, and taskId', async () => {
      const fieldFilters = [{ botId: 'bot_abc123' }]

      getFieldQueryFilter.mockReturnValue(fieldFilters)
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(getFieldQueryFilter).toHaveBeenCalledWith(
        mockReq,
        expect.arrayContaining(['botId', 'contactId', 'taskId'])
      )
    })

    it('should include field filters in the query AND clause', async () => {
      const fieldFilter = [{ botId: 'bot_xyz' }]

      getFieldQueryFilter.mockReturnValue(fieldFilter)
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              { userId: 'user_abc123' },
              { botId: 'bot_xyz' },
            ]),
          },
        })
      )
    })

    it('should support filtering by multiple fields simultaneously', async () => {
      const fieldFilters = [{ botId: 'bot_1' }, { contactId: 'contact_1' }]

      getFieldQueryFilter.mockReturnValue(fieldFilters)
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              { userId: 'user_abc123' },
              { botId: 'bot_1' },
              { contactId: 'contact_1' },
            ]),
          },
        })
      )
    })
  })

  // -------------------------------------------------------
  // Pagination
  // -------------------------------------------------------

  describe('pagination', () => {
    it('should apply cursor constraints to the query', async () => {
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'conv_cursor_id' },
        skip: 1,
      })
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'conv_cursor_id' },
          skip: 1,
        })
      )
    })

    it('should apply take constraints to the query', async () => {
      getTakeConstraints.mockReturnValue({ take: 20 })
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 })
      )
    })

    it('should pass the cursor from withStreamCursor to getCursorConstraints', async () => {
      const cursor = 'cursor_token_abc'

      prisma.conversation.findMany.mockResolvedValue([])

      await handler(cursor, mockReq, null, mockSession)

      expect(getCursorConstraints).toHaveBeenCalledWith(mockReq, cursor)
    })
  })

  // -------------------------------------------------------
  // User isolation (security)
  // -------------------------------------------------------

  describe('user isolation', () => {
    it('should not return conversations belonging to a different user', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, {
        user: { id: 'user_attacker' },
      })

      // Verify the userId filter is set to the authenticated user, not a different one
      const callArgs = prisma.conversation.findMany.mock.calls[0][0]
      const userFilter = callArgs.where.AND.find((c) => c.userId !== undefined)

      expect(userFilter.userId).toBe('user_attacker')
      expect(userFilter.userId).not.toBe('user_abc123')
    })

    it('should always include userId in the AND clause', async () => {
      prisma.conversation.findMany.mockResolvedValue([])

      for (const userId of ['user_1', 'user_2', 'user_3']) {
        jest.clearAllMocks()
        getMetaQueryFilter.mockReturnValue([])
        getFieldQueryFilter.mockReturnValue([])
        getCursorConstraints.mockReturnValue({})
        getTakeConstraints.mockReturnValue({})

        await handler(mockCursor, mockReq, null, { user: { id: userId } })

        const callArgs = prisma.conversation.findMany.mock.calls[0][0]

        expect(callArgs.where.AND).toContainEqual({ userId })
      }
    })
  })

  // -------------------------------------------------------
  // Combined filters
  // -------------------------------------------------------

  describe('combined filters', () => {
    it('should combine userId, meta, and field filters in AND clause', async () => {
      const metaFilter = [{ meta: { path: ['tag'], equals: 'support' } }]
      const fieldFilter = [{ taskId: 'task_123' }]

      getMetaQueryFilter.mockReturnValue(metaFilter)
      getFieldQueryFilter.mockReturnValue(fieldFilter)
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      const callArgs = prisma.conversation.findMany.mock.calls[0][0]

      expect(callArgs.where.AND).toContainEqual({ userId: 'user_abc123' })
      expect(callArgs.where.AND).toContainEqual(metaFilter[0])
      expect(callArgs.where.AND).toContainEqual(fieldFilter[0])
    })
  })

  // -------------------------------------------------------
  // Error handling
  // -------------------------------------------------------

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      prisma.conversation.findMany.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(
        handler(mockCursor, mockReq, null, mockSession)
      ).rejects.toThrow('Database connection failed')
    })
  })
})
