/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './export'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    eventLog: {
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

jest.mock('@/lib/yaml', () => ({
  stringify: jest.fn(() => `key: value\n`),
}))

const {
  getMetaQueryFilter,
  getFieldQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('GET /api/v1/event/log/export', () => {
  const mockSession = { user: { id: 'user_abc123' } }
  const mockReq = {}
  const mockCursor = null

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getFieldQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})

    const yaml = require('@/lib/yaml')

    yaml.stringify.mockImplementation(() => `key: value\n`)
  })

  describe('basic functionality', () => {
    it('should return items array for authenticated user', async () => {
      prisma.eventLog.findMany.mockResolvedValue([])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result).toHaveProperty('items')
      expect(Array.isArray(result.items)).toBe(true)
    })

    it('should return empty items when no events exist', async () => {
      prisma.eventLog.findMany.mockResolvedValue([])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(0)
    })
  })

  describe('user scoping - security critical', () => {
    it('should scope the query to the authenticated user only', async () => {
      prisma.eventLog.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user_abc123' }]),
          }),
        })
      )
    })

    it('should use the session userId not any value from the request', async () => {
      const sessionWithOtherUser = { user: { id: 'user_xyz999' } }

      prisma.eventLog.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, sessionWithOtherUser)

      const callArgs = prisma.eventLog.findMany.mock.calls[0][0]
      const andClauses = callArgs.where.AND

      expect(andClauses).toContainEqual({ userId: 'user_xyz999' })
      expect(andClauses).not.toContainEqual({ userId: 'user_abc123' })
    })
  })

  describe('meta Proxy serialization', () => {
    it('should wrap meta in a Proxy that stringifies to YAML on toString()', async () => {
      const yaml = require('@/lib/yaml')

      const mockEvent = {
        id: 'evt_1',
        meta: { source: 'webhook', level: 'info' },
      }

      prisma.eventLog.findMany.mockResolvedValue([mockEvent])
      yaml.stringify.mockReturnValue('source: webhook\nlevel: info\n')

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      const stringified = item.meta.toString()

      expect(yaml.stringify).toHaveBeenCalledWith({
        source: 'webhook',
        level: 'info',
      })
      expect(stringified).toBe('source: webhook\nlevel: info\n')
    })

    it('should still expose meta properties directly through the Proxy', async () => {
      const mockEvent = {
        id: 'evt_1',
        meta: { environment: 'production' },
      }

      prisma.eventLog.findMany.mockResolvedValue([mockEvent])

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      expect(item.meta.environment).toBe('production')
    })

    it('should handle null meta gracefully using empty object', async () => {
      const mockEvent = {
        id: 'evt_1',
        meta: null,
      }

      prisma.eventLog.findMany.mockResolvedValue([mockEvent])

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      // @note null meta becomes {} via `meta || {}`
      expect(item.meta).toBeDefined()

      // Should not throw when properties are accessed
      expect(item.meta.anyProp).toBeUndefined()
    })

    it('should strip meta from the rest of the item and re-attach as Proxy', async () => {
      const mockEvent = {
        id: 'evt_1',
        type: 'conversation.create',
        meta: { key: 'value' },
        createdAt: new Date('2024-01-01'),
      }

      prisma.eventLog.findMany.mockResolvedValue([mockEvent])

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      // The item should have both the original fields and the re-attached meta
      expect(item.id).toBe('evt_1')
      expect(item.type).toBe('conversation.create')
      expect(item).toHaveProperty('meta')
    })
  })

  describe('filtering', () => {
    it('should apply meta query filters from the request', async () => {
      prisma.eventLog.findMany.mockResolvedValue([])
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['env'], equals: 'prod' } },
      ])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { userId: 'user_abc123' },
              { meta: { path: ['env'], equals: 'prod' } },
            ],
          },
        })
      )
    })

    it('should apply field query filters from the request', async () => {
      prisma.eventLog.findMany.mockResolvedValue([])
      getFieldQueryFilter.mockReturnValue([
        { type: { equals: 'task.complete' } },
      ])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              { userId: 'user_abc123' },
              { type: { equals: 'task.complete' } },
            ]),
          },
        })
      )
    })
  })

  describe('pagination', () => {
    it('should apply cursor constraints from the request', async () => {
      prisma.eventLog.findMany.mockResolvedValue([])
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'evt_cursor' },
        skip: 1,
      })

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: 'evt_cursor' }, skip: 1 })
      )
    })

    it('should apply take constraints from the request', async () => {
      prisma.eventLog.findMany.mockResolvedValue([])
      getTakeConstraints.mockReturnValue({ take: 500 })

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 500 })
      )
    })
  })

  describe('multiple events', () => {
    it('should map all events with Proxy meta', async () => {
      const events = [
        { id: 'evt_1', meta: { a: 1 } },
        { id: 'evt_2', meta: { b: 2 } },
        { id: 'evt_3', meta: null },
      ]

      prisma.eventLog.findMany.mockResolvedValue(events)

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(3)
      expect(result.items[0].id).toBe('evt_1')
      expect(result.items[1].id).toBe('evt_2')
      expect(result.items[2].id).toBe('evt_3')

      result.items.forEach((item) => {
        expect(item).toHaveProperty('meta')
      })
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      prisma.eventLog.findMany.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(
        handler(mockCursor, mockReq, null, mockSession)
      ).rejects.toThrow('Database connection failed')
    })
  })
})
