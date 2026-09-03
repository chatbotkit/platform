/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './list'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
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
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

// -------------------------------------------------------
// Test state
// -------------------------------------------------------

describe('/api/v1/blueprint/list', () => {
  const {
    getMetaQueryFilter,
    getCursorConstraints,
    getTakeConstraints,
  } = require('@/lib/filter')
  const { makeJsonSafe } = require('@/lib/struct')

  const mockSession = { user: { id: 'user_abc123' } }
  const mockCursor = null
  const mockReq = { query: {} }

  beforeEach(() => {
    mockReset(prisma)
    getMetaQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
    makeJsonSafe.mockImplementation((data) => data)
  })

  // -------------------------------------------------------
  // Basic functionality
  // -------------------------------------------------------

  describe('basic functionality', () => {
    it('should return an empty items array when no blueprints exist', async () => {
      prisma.blueprint.findMany.mockResolvedValue([])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result).toEqual({ items: [] })
    })

    it('should always filter by the authenticated user id', async () => {
      prisma.blueprint.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, { user: { id: 'user_xyz999' } })

      expect(prisma.blueprint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user_xyz999' }]),
          }),
        })
      )
    })

    it('should select the expected fields', async () => {
      prisma.blueprint.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.blueprint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            alias: true,
            visibility: true,
            config: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          }),
        })
      )
    })

    it('should return all blueprints for the user', async () => {
      const blueprints = [
        {
          id: 'bpt_1',
          alias: 'blueprint-one',
          visibility: 'private',
          config: {},
          meta: null,
        },
        {
          id: 'bpt_2',
          alias: 'blueprint-two',
          visibility: 'public',
          config: { model: 'gpt-4o' },
          meta: {},
        },
      ]

      prisma.blueprint.findMany.mockResolvedValue(blueprints)

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('bpt_1')
      expect(result.items[1].id).toBe('bpt_2')
    })

    it('should call makeJsonSafe on the results', async () => {
      const blueprints = [{ id: 'bpt_1' }]

      prisma.blueprint.findMany.mockResolvedValue(blueprints)
      makeJsonSafe.mockReturnValue([{ id: 'bpt_1_safe' }])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(makeJsonSafe).toHaveBeenCalledWith(blueprints)
      expect(result.items[0].id).toBe('bpt_1_safe')
    })
  })

  // -------------------------------------------------------
  // Meta filtering
  // -------------------------------------------------------

  describe('meta filtering', () => {
    it('should pass meta filters from the request to the query', async () => {
      const metaFilter = [{ meta: { path: ['env'], equals: 'production' } }]

      getMetaQueryFilter.mockReturnValue(metaFilter)
      prisma.blueprint.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(getMetaQueryFilter).toHaveBeenCalledWith(mockReq)
      expect(prisma.blueprint.findMany).toHaveBeenCalledWith(
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
      prisma.blueprint.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.blueprint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ userId: 'user_abc123' }] },
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
        cursor: { id: 'bpt_cursor_id' },
        skip: 1,
      })
      prisma.blueprint.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.blueprint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'bpt_cursor_id' },
          skip: 1,
        })
      )
    })

    it('should apply take constraints to the query', async () => {
      getTakeConstraints.mockReturnValue({ take: 10 })
      prisma.blueprint.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.blueprint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      )
    })

    it('should pass the cursor from withStreamCursor to getCursorConstraints', async () => {
      const cursor = 'cursor_token_xyz'

      prisma.blueprint.findMany.mockResolvedValue([])

      await handler(cursor, mockReq, null, mockSession)

      expect(getCursorConstraints).toHaveBeenCalledWith(mockReq, cursor)
    })
  })

  // -------------------------------------------------------
  // User isolation (security)
  // -------------------------------------------------------

  describe('user isolation', () => {
    it('should always include userId in the AND clause', async () => {
      prisma.blueprint.findMany.mockResolvedValue([])

      for (const userId of ['user_A', 'user_B', 'user_C']) {
        mockReset(prisma)
        getMetaQueryFilter.mockReturnValue([])
        getCursorConstraints.mockReturnValue({})
        getTakeConstraints.mockReturnValue({})
        prisma.blueprint.findMany.mockResolvedValue([])

        await handler(mockCursor, mockReq, null, { user: { id: userId } })

        const callArgs = prisma.blueprint.findMany.mock.calls[0][0]

        expect(callArgs.where.AND).toContainEqual({ userId })
      }
    })

    it('should not expose blueprints of other users', async () => {
      prisma.blueprint.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, {
        user: { id: 'user_attacker' },
      })

      const callArgs = prisma.blueprint.findMany.mock.calls[0][0]
      const userFilter = callArgs.where.AND.find((c) => c.userId !== undefined)

      expect(userFilter.userId).toBe('user_attacker')
      expect(userFilter.userId).not.toBe('user_abc123')
    })
  })

  // -------------------------------------------------------
  // Error handling
  // -------------------------------------------------------

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      prisma.blueprint.findMany.mockRejectedValue(new Error('Database timeout'))

      await expect(
        handler(mockCursor, mockReq, null, mockSession)
      ).rejects.toThrow('Database timeout')
    })
  })
})
