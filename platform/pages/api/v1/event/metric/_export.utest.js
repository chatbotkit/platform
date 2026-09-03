/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './export'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    eventMetric: {
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

describe('GET /api/v1/event/metric/export', () => {
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
      prisma.eventMetric.findMany.mockResolvedValue([])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result).toHaveProperty('items')
      expect(Array.isArray(result.items)).toBe(true)
    })

    it('should return empty items when no metrics exist', async () => {
      prisma.eventMetric.findMany.mockResolvedValue([])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(0)
    })

    it('should return metric items with value field preserved', async () => {
      const mockMetric = {
        id: 'metric_1',
        type: 'token_usage',
        value: 2048,
        meta: { model: 'gpt-4' },
      }

      prisma.eventMetric.findMany.mockResolvedValue([mockMetric])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items[0]).toMatchObject({
        id: 'metric_1',
        type: 'token_usage',
        value: 2048,
      })
    })
  })

  describe('user scoping - security critical', () => {
    it('should scope the query to the authenticated user only', async () => {
      prisma.eventMetric.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user_abc123' }]),
          }),
        })
      )
    })

    it('should use the session userId not any value from the request', async () => {
      const sessionWithOtherUser = { user: { id: 'user_xyz999' } }

      prisma.eventMetric.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, sessionWithOtherUser)

      const callArgs = prisma.eventMetric.findMany.mock.calls[0][0]
      const andClauses = callArgs.where.AND

      expect(andClauses).toContainEqual({ userId: 'user_xyz999' })
      expect(andClauses).not.toContainEqual({ userId: 'user_abc123' })
    })
  })

  describe('meta Proxy serialization', () => {
    it('should wrap meta in a Proxy that stringifies to YAML on toString()', async () => {
      const yaml = require('@/lib/yaml')

      const mockMetric = {
        id: 'metric_1',
        type: 'token_usage',
        value: 500,
        meta: { model: 'gpt-4', inputTokens: 300, outputTokens: 200 },
      }

      prisma.eventMetric.findMany.mockResolvedValue([mockMetric])
      yaml.stringify.mockReturnValue(
        'model: gpt-4\ninputTokens: 300\noutputTokens: 200\n'
      )

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      const stringified = item.meta.toString()

      expect(yaml.stringify).toHaveBeenCalledWith({
        model: 'gpt-4',
        inputTokens: 300,
        outputTokens: 200,
      })
      expect(stringified).toBe(
        'model: gpt-4\ninputTokens: 300\noutputTokens: 200\n'
      )
    })

    it('should expose meta properties directly through the Proxy', async () => {
      const mockMetric = {
        id: 'metric_1',
        type: 'token_usage',
        value: 100,
        meta: { reason: 'api/chat' },
      }

      prisma.eventMetric.findMany.mockResolvedValue([mockMetric])

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      expect(item.meta.reason).toBe('api/chat')
    })

    it('should handle null meta gracefully using empty object', async () => {
      const mockMetric = {
        id: 'metric_1',
        type: 'token_usage',
        value: 100,
        meta: null,
      }

      prisma.eventMetric.findMany.mockResolvedValue([mockMetric])

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      // @note null meta becomes {} via `meta || {}`
      expect(item.meta).toBeDefined()
      expect(item.meta.anyProp).toBeUndefined()
    })

    it('should strip meta from rest and re-attach as Proxy while preserving value', async () => {
      const mockMetric = {
        id: 'metric_1',
        type: 'token_usage',
        value: 750,
        meta: { key: 'val' },
        createdAt: new Date('2024-01-01'),
      }

      prisma.eventMetric.findMany.mockResolvedValue([mockMetric])

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      expect(item.id).toBe('metric_1')
      expect(item.value).toBe(750)
      expect(item).toHaveProperty('meta')
    })
  })

  describe('filtering', () => {
    it('should apply meta query filters from the request', async () => {
      prisma.eventMetric.findMany.mockResolvedValue([])
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['reason'], equals: 'api/chat' } },
      ])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { userId: 'user_abc123' },
              { meta: { path: ['reason'], equals: 'api/chat' } },
            ],
          },
        })
      )
    })

    it('should apply field query filters from the request', async () => {
      prisma.eventMetric.findMany.mockResolvedValue([])
      getFieldQueryFilter.mockReturnValue([{ type: { equals: 'token_usage' } }])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              { userId: 'user_abc123' },
              { type: { equals: 'token_usage' } },
            ]),
          },
        })
      )
    })
  })

  describe('pagination', () => {
    it('should apply cursor constraints from the request', async () => {
      prisma.eventMetric.findMany.mockResolvedValue([])
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'metric_cursor' },
        skip: 1,
      })

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: 'metric_cursor' }, skip: 1 })
      )
    })

    it('should apply take constraints from the request', async () => {
      prisma.eventMetric.findMany.mockResolvedValue([])
      getTakeConstraints.mockReturnValue({ take: 200 })

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 })
      )
    })
  })

  describe('multiple metrics', () => {
    it('should map all metrics with Proxy meta', async () => {
      const metrics = [
        { id: 'metric_1', value: 100, meta: { a: 1 } },
        { id: 'metric_2', value: 200, meta: { b: 2 } },
        { id: 'metric_3', value: 0, meta: null },
      ]

      prisma.eventMetric.findMany.mockResolvedValue(metrics)

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(3)
      expect(result.items[0].id).toBe('metric_1')
      expect(result.items[1].id).toBe('metric_2')
      expect(result.items[2].id).toBe('metric_3')

      result.items.forEach((item) => {
        expect(item).toHaveProperty('meta')
      })
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      prisma.eventMetric.findMany.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(
        handler(mockCursor, mockReq, null, mockSession)
      ).rejects.toThrow('Database connection failed')
    })
  })
})
