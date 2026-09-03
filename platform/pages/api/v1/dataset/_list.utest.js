/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './list'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      dataset: {
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
  getMetaQueryFilter: jest.fn(() => []),
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({ take: 10 })),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((v) => v),
}))

const {
  getMetaQueryFilter,
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')
const { makeJsonSafe } = require('@/lib/struct')

describe('GET /api/v1/dataset/list', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: {} }

  const mockDatasets = [
    {
      id: 'dataset-1',
      alias: 'dataset-one',
      name: 'My Dataset',
      description: 'A test dataset',
      blueprintId: null,
      visibility: 'private',
      meta: {},
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    },
    {
      id: 'dataset-2',
      alias: 'dataset-two',
      name: 'Second Dataset',
      description: '',
      blueprintId: 'bp-1',
      visibility: 'public',
      meta: { env: 'prod' },
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-02'),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    makeJsonSafe.mockImplementation((v) => v)
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({ take: 10 })
    prisma.dataset.findMany.mockResolvedValue(mockDatasets)
  })

  describe('user isolation', () => {
    it('always filters by the session user id', async () => {
      await handler(null, req, null, session)

      expect(prisma.dataset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user-1' }]),
          }),
        })
      )
    })

    it('does not return datasets from other users', async () => {
      const sessionUser2 = { user: { id: 'user-2' } }

      prisma.dataset.findMany.mockResolvedValue([])

      const result = await handler(null, req, null, sessionUser2)

      expect(result.items).toEqual([])
      expect(prisma.dataset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user-2' }]),
          }),
        })
      )
    })

    it('uses the correct user id in the where clause when users differ', async () => {
      const sessionUser3 = { user: { id: 'user-3' } }

      prisma.dataset.findMany.mockResolvedValue([])

      await handler(null, req, null, sessionUser3)

      const callArgs = prisma.dataset.findMany.mock.calls[0][0]
      const andClauses = callArgs.where.AND

      expect(andClauses).toContainEqual({ userId: 'user-3' })
      expect(andClauses).not.toContainEqual({ userId: 'user-1' })
      expect(andClauses).not.toContainEqual({ userId: 'user-2' })
    })
  })

  describe('response shape', () => {
    it('returns a list of datasets', async () => {
      const result = await handler(null, req, null, session)

      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('dataset-1')
      expect(result.items[1].id).toBe('dataset-2')
    })

    it('returns empty array when user has no datasets', async () => {
      prisma.dataset.findMany.mockResolvedValue([])

      const result = await handler(null, req, null, session)

      expect(result.items).toEqual([])
    })

    it('passes dataset list through makeJsonSafe', async () => {
      const safeDatasets = [{ id: 'safe-1' }]

      makeJsonSafe.mockReturnValue(safeDatasets)

      const result = await handler(null, req, null, session)

      expect(makeJsonSafe).toHaveBeenCalledWith(mockDatasets)
      expect(result.items).toBe(safeDatasets)
    })
  })

  describe('filtering', () => {
    it('applies meta query filters', async () => {
      getMetaQueryFilter.mockReturnValue([{ 'meta.env': 'prod' }])

      await handler(null, req, null, session)

      expect(prisma.dataset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ 'meta.env': 'prod' }]),
          }),
        })
      )
    })

    it('applies blueprint id query filters', async () => {
      getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp-abc' }])

      await handler(null, req, null, session)

      expect(prisma.dataset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ blueprintId: 'bp-abc' }]),
          }),
        })
      )
    })

    it('combines user, meta, and blueprint filters in the AND clause', async () => {
      getMetaQueryFilter.mockReturnValue([{ 'meta.type': 'knowledge' }])
      getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp-1' }])

      await handler(null, req, null, session)

      const callArgs = prisma.dataset.findMany.mock.calls[0][0]
      const andClauses = callArgs.where.AND

      expect(andClauses).toContainEqual({ userId: 'user-1' })
      expect(andClauses).toContainEqual({ 'meta.type': 'knowledge' })
      expect(andClauses).toContainEqual({ blueprintId: 'bp-1' })
    })
  })

  describe('pagination', () => {
    it('applies take constraints from the request', async () => {
      getTakeConstraints.mockReturnValue({ take: 5 })

      await handler(null, req, null, session)

      expect(prisma.dataset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      )
    })

    it('applies cursor constraints', async () => {
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'last-id' },
        skip: 1,
      })

      await handler('last-id', req, null, session)

      expect(prisma.dataset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'last-id' },
          skip: 1,
        })
      )
    })

    it('passes the cursor to getCursorConstraints', async () => {
      await handler('some-cursor', req, null, session)

      expect(getCursorConstraints).toHaveBeenCalledWith(req, 'some-cursor')
    })
  })

  describe('error handling', () => {
    it('propagates database error from findMany', async () => {
      prisma.dataset.findMany.mockRejectedValue(
        new Error('DB connection failed')
      )

      await expect(handler(null, req, null, session)).rejects.toThrow(
        'DB connection failed'
      )
    })
  })
})
