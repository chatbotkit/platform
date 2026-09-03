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
  getFieldQueryFilter: jest.fn(() => []),
  getValueQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

const {
  getMetaQueryFilter,
  getFieldQueryFilter,
  getValueQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('/api/v1/rating/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
    // Reset all filter mocks to default implementations
    getMetaQueryFilter.mockReturnValue([])
    getFieldQueryFilter.mockReturnValue([])
    getValueQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  describe('basic functionality', () => {
    it('should list all ratings for user', async () => {
      const mockRatings = [
        {
          id: 'rtg_1',
          name: 'Rating 1',
          description: 'First rating',
          contactId: 'ctc_123',
          botId: 'bot_456',
          conversationId: null,
          messageId: null,
          value: 100,
          reason: 'Excellent',
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'rtg_2',
          name: 'Rating 2',
          description: 'Second rating',
          contactId: null,
          botId: 'bot_456',
          conversationId: 'cnv_789',
          messageId: 'msg_012',
          value: -50,
          reason: 'Needs improvement',
          meta: { category: 'accuracy' },
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ]

      prisma.rating.findMany.mockResolvedValue(mockRatings)

      const req = {}
      const cursor = null

      const result = await handler(cursor, req, null, mockSession)

      expect(prisma.rating.findMany).toHaveBeenCalledWith({
        where: {
          AND: [{ userId: 'user_123' }],
        },
        select: {
          id: true,
          name: true,
          description: true,
          contactId: true,
          botId: true,
          conversationId: true,
          messageId: true,
          value: true,
          reason: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      expect(result).toEqual({ items: mockRatings })
    })

    it('should return empty array when no ratings exist', async () => {
      prisma.rating.findMany.mockResolvedValue([])

      const req = {}
      const cursor = null

      const result = await handler(cursor, req, null, mockSession)

      expect(result).toEqual({ items: [] })
    })
  })

  describe('filtering', () => {
    it('should apply meta query filter', async () => {
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['category'], equals: 'technical' } },
      ])

      prisma.rating.findMany.mockResolvedValue([])

      const req = { query: { meta: { category: 'technical' } } }
      const cursor = null

      await handler(cursor, req, null, mockSession)

      expect(getMetaQueryFilter).toHaveBeenCalledWith(req)
      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { userId: 'user_123' },
              { meta: { path: ['category'], equals: 'technical' } },
            ],
          },
        })
      )
    })

    it('should apply field query filter for resource IDs', async () => {
      getFieldQueryFilter.mockReturnValue([{ botId: 'bot_456' }])

      prisma.rating.findMany.mockResolvedValue([])

      const req = { query: { botId: 'bot_456' } }
      const cursor = null

      await handler(cursor, req, null, mockSession)

      expect(getFieldQueryFilter).toHaveBeenCalledWith(req, [
        'contactId',
        'botId',
        'conversationId',
        'messageId',
      ])
      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ userId: 'user_123' }, { botId: 'bot_456' }],
          },
        })
      )
    })

    it('should apply value query filter', async () => {
      getValueQueryFilter.mockReturnValue([{ value: { gte: 0 } }])

      prisma.rating.findMany.mockResolvedValue([])

      const req = { query: { value: '0' } }
      const cursor = null

      await handler(cursor, req, null, mockSession)

      expect(getValueQueryFilter).toHaveBeenCalledWith(req)
      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ userId: 'user_123' }, { value: { gte: 0 } }],
          },
        })
      )
    })

    it('should combine multiple filters', async () => {
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['source'], equals: 'automated' } },
      ])
      getFieldQueryFilter.mockReturnValue([
        { botId: 'bot_123' },
        { conversationId: 'cnv_456' },
      ])
      getValueQueryFilter.mockReturnValue([{ value: { lt: 0 } }])

      prisma.rating.findMany.mockResolvedValue([])

      const req = {
        query: {
          botId: 'bot_123',
          conversationId: 'cnv_456',
          meta: { source: 'automated' },
        },
      }
      const cursor = null

      await handler(cursor, req, null, mockSession)

      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { userId: 'user_123' },
              { meta: { path: ['source'], equals: 'automated' } },
              { botId: 'bot_123' },
              { conversationId: 'cnv_456' },
              { value: { lt: 0 } },
            ],
          },
        })
      )
    })
  })

  describe('pagination', () => {
    it('should apply cursor constraints', async () => {
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'rtg_cursor' },
        skip: 1,
      })

      prisma.rating.findMany.mockResolvedValue([])

      const req = {}
      const cursor = 'rtg_cursor'

      await handler(cursor, req, null, mockSession)

      expect(getCursorConstraints).toHaveBeenCalledWith(req, cursor)
      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'rtg_cursor' },
          skip: 1,
        })
      )
    })

    it('should apply take constraints', async () => {
      getTakeConstraints.mockReturnValue({ take: 50 })

      prisma.rating.findMany.mockResolvedValue([])

      const req = { query: { take: '50' } }
      const cursor = null

      await handler(cursor, req, null, mockSession)

      expect(getTakeConstraints).toHaveBeenCalledWith(req)
      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      )
    })

    it('should handle pagination with cursor and take', async () => {
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'rtg_page2' },
        skip: 1,
      })
      getTakeConstraints.mockReturnValue({ take: 25 })

      prisma.rating.findMany.mockResolvedValue([])

      const req = { query: { take: '25' } }
      const cursor = 'rtg_page2'

      await handler(cursor, req, null, mockSession)

      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'rtg_page2' },
          skip: 1,
          take: 25,
        })
      )
    })
  })

  describe('edge cases', () => {
    it('should handle null values in rating data', async () => {
      const mockRatings = [
        {
          id: 'rtg_null',
          name: '',
          description: '',
          contactId: null,
          botId: null,
          conversationId: null,
          messageId: null,
          value: 0,
          reason: null,
          meta: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prisma.rating.findMany.mockResolvedValue(mockRatings)

      const req = {}
      const cursor = null

      const result = await handler(cursor, req, null, mockSession)

      expect(result).toEqual({ items: mockRatings })
    })

    it('should handle large datasets efficiently', async () => {
      const largeMockRatings = Array.from({ length: 100 }, (_, i) => ({
        id: `rtg_${i}`,
        name: `Rating ${i}`,
        description: '',
        contactId: null,
        botId: null,
        conversationId: null,
        messageId: null,
        value: i,
        reason: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      prisma.rating.findMany.mockResolvedValue(largeMockRatings)

      const req = {}
      const cursor = null

      const result = await handler(cursor, req, null, mockSession)

      expect(result.items).toHaveLength(100)
    })
  })

  describe('error handling', () => {
    it('should handle database error', async () => {
      const dbError = new Error('Database connection failed')

      prisma.rating.findMany.mockRejectedValue(dbError)

      const req = {}
      const cursor = null

      await expect(handler(cursor, req, null, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle invalid query parameters gracefully', async () => {
      getMetaQueryFilter.mockImplementation(() => {
        throw new Error('Invalid meta query')
      })

      const req = { query: { meta: 'invalid' } }
      const cursor = null

      await expect(handler(cursor, req, null, mockSession)).rejects.toThrow(
        'Invalid meta query'
      )
    })
  })
})
