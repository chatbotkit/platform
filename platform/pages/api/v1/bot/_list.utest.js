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
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

const {
  getMetaQueryFilter,
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('/api/v1/bot/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
    // Reset all filter mocks to default implementations
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  describe('basic functionality', () => {
    it('should list all bots for user', async () => {
      const mockBots = [
        {
          id: 'bot_1',
          alias: 'support-bot',
          name: 'Support Bot',
          description: 'Customer support assistant',
          blueprintId: 'bpt_123',
          datasetId: 'dst_456',
          skillsetId: 'sks_789',
          backstory: 'You are helpful.',
          model: 'gpt-4o',
          visibility: 'private',
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'bot_2',
          alias: 'sales-bot',
          name: 'Sales Bot',
          description: 'Sales assistant',
          blueprintId: null,
          datasetId: null,
          skillsetId: null,
          backstory: 'You are a sales expert.',
          model: 'gpt-4',
          visibility: 'public',
          meta: { category: 'sales' },
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ]

      prisma.bot.findMany.mockResolvedValue(mockBots)

      const req = {}
      const cursor = null

      const result = await handler(cursor, req, null, mockSession)

      expect(prisma.bot.findMany).toHaveBeenCalledWith({
        where: {
          AND: [{ userId: 'user_123' }],
        },
        select: {
          id: true,
          alias: true,
          name: true,
          description: true,
          blueprintId: true,
          datasetId: true,
          skillsetId: true,
          backstory: true,
          model: true,
          visibility: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      expect(result).toEqual({ items: mockBots })
    })

    it('should return empty array when no bots exist', async () => {
      prisma.bot.findMany.mockResolvedValue([])

      const req = {}
      const cursor = null

      const result = await handler(cursor, req, null, mockSession)

      expect(result).toEqual({ items: [] })
    })

    it('should include all required bot fields', async () => {
      prisma.bot.findMany.mockResolvedValue([])

      const req = {}
      const cursor = null

      await handler(cursor, req, null, mockSession)

      const selectFields = prisma.bot.findMany.mock.calls[0][0].select

      expect(selectFields).toMatchObject({
        id: true,
        alias: true,
        name: true,
        description: true,
        blueprintId: true,
        datasetId: true,
        skillsetId: true,
        backstory: true,
        model: true,
        visibility: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      })
    })
  })

  describe('filtering', () => {
    it('should apply meta query filter', async () => {
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['category'], equals: 'support' } },
      ])

      prisma.bot.findMany.mockResolvedValue([])

      const req = { query: { meta: { category: 'support' } } }
      const cursor = null

      await handler(cursor, req, null, mockSession)

      expect(getMetaQueryFilter).toHaveBeenCalledWith(req)
      expect(prisma.bot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { userId: 'user_123' },
              { meta: { path: ['category'], equals: 'support' } },
            ],
          },
        })
      )
    })

    it('should apply blueprintId query filter', async () => {
      getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bpt_filter' }])

      prisma.bot.findMany.mockResolvedValue([])

      const req = { query: { blueprintId: 'bpt_filter' } }
      const cursor = null

      await handler(cursor, req, null, mockSession)

      expect(getBlueprintIdQueryFilter).toHaveBeenCalledWith(req)
      expect(prisma.bot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ userId: 'user_123' }, { blueprintId: 'bpt_filter' }],
          },
        })
      )
    })

    it('should combine multiple filters', async () => {
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['environment'], equals: 'production' } },
      ])
      getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bpt_prod' }])

      prisma.bot.findMany.mockResolvedValue([])

      const req = {
        query: {
          blueprintId: 'bpt_prod',
          meta: { environment: 'production' },
        },
      }
      const cursor = null

      await handler(cursor, req, null, mockSession)

      expect(prisma.bot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { userId: 'user_123' },
              { meta: { path: ['environment'], equals: 'production' } },
              { blueprintId: 'bpt_prod' },
            ],
          },
        })
      )
    })
  })

  describe('pagination', () => {
    it('should apply cursor constraints', async () => {
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'bot_cursor' },
        skip: 1,
        orderBy: { createdAt: 'desc' },
      })

      prisma.bot.findMany.mockResolvedValue([])

      const req = { query: { cursor: 'bot_cursor' } }
      const cursor = 'bot_cursor'

      await handler(cursor, req, null, mockSession)

      expect(getCursorConstraints).toHaveBeenCalledWith(req, cursor)
      expect(prisma.bot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'bot_cursor' },
          skip: 1,
          orderBy: { createdAt: 'desc' },
        })
      )
    })

    it('should apply take constraints', async () => {
      getTakeConstraints.mockReturnValue({ take: 100 })

      prisma.bot.findMany.mockResolvedValue([])

      const req = { query: { take: '100' } }
      const cursor = null

      await handler(cursor, req, null, mockSession)

      expect(getTakeConstraints).toHaveBeenCalledWith(req)
      expect(prisma.bot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      )
    })

    it('should handle pagination with cursor and take', async () => {
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'bot_page2' },
        skip: 1,
      })
      getTakeConstraints.mockReturnValue({ take: 50 })

      prisma.bot.findMany.mockResolvedValue([])

      const req = { query: { take: '50', cursor: 'bot_page2' } }
      const cursor = 'bot_page2'

      await handler(cursor, req, null, mockSession)

      expect(prisma.bot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'bot_page2' },
          skip: 1,
          take: 50,
        })
      )
    })

    it('should handle no pagination parameters', async () => {
      getCursorConstraints.mockReturnValue({})
      getTakeConstraints.mockReturnValue({})

      prisma.bot.findMany.mockResolvedValue([])

      const req = {}
      const cursor = null

      await handler(cursor, req, null, mockSession)

      expect(prisma.bot.findMany).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle bots with null optional fields', async () => {
      const mockBots = [
        {
          id: 'bot_minimal',
          name: 'Minimal Bot',
          description: '',
          blueprintId: null,
          datasetId: null,
          skillsetId: null,
          backstory: '',
          model: 'gpt-4',
          visibility: 'private',
          meta: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prisma.bot.findMany.mockResolvedValue(mockBots)

      const req = {}
      const cursor = null

      const result = await handler(cursor, req, null, mockSession)

      expect(result).toEqual({ items: mockBots })
    })

    it('should handle large bot collections efficiently', async () => {
      const largeBotCollection = Array.from({ length: 500 }, (_, i) => ({
        id: `bot_${i}`,
        name: `Bot ${i}`,
        description: `Description ${i}`,
        blueprintId: i % 2 === 0 ? `bpt_${i}` : null,
        datasetId: null,
        skillsetId: null,
        backstory: `Backstory ${i}`,
        model: 'gpt-4',
        visibility: 'private',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      prisma.bot.findMany.mockResolvedValue(largeBotCollection)

      const req = {}
      const cursor = null

      const result = await handler(cursor, req, null, mockSession)

      expect(result.items).toHaveLength(500)
    })

    it('should handle bots with complex metadata', async () => {
      const mockBots = [
        {
          id: 'bot_complex',
          name: 'Complex Bot',
          description: 'Bot with complex metadata',
          blueprintId: null,
          datasetId: null,
          skillsetId: null,
          backstory: '',
          model: 'gpt-4',
          visibility: 'private',
          meta: {
            tags: ['production', 'support'],
            config: { timeout: 30, retries: 3 },
            deployment: { region: 'us-east', version: '2.0' },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prisma.bot.findMany.mockResolvedValue(mockBots)

      const req = {}
      const cursor = null

      const result = await handler(cursor, req, null, mockSession)

      expect(result.items[0].meta).toEqual({
        tags: ['production', 'support'],
        config: { timeout: 30, retries: 3 },
        deployment: { region: 'us-east', version: '2.0' },
      })
    })
  })

  describe('error handling', () => {
    it('should handle database error', async () => {
      const dbError = new Error('Database connection failed')

      prisma.bot.findMany.mockRejectedValue(dbError)

      const req = {}
      const cursor = null

      await expect(handler(cursor, req, null, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle invalid query parameters gracefully', async () => {
      getMetaQueryFilter.mockImplementation(() => {
        throw new Error('Invalid meta query format')
      })

      const req = { query: { meta: 'invalid_format' } }
      const cursor = null

      await expect(handler(cursor, req, null, mockSession)).rejects.toThrow(
        'Invalid meta query format'
      )
    })

    it('should handle cursor parsing errors', async () => {
      getCursorConstraints.mockImplementation(() => {
        throw new Error('Invalid cursor format')
      })

      const req = { query: { cursor: 'invalid_cursor' } }
      const cursor = 'invalid_cursor'

      await expect(handler(cursor, req, null, mockSession)).rejects.toThrow(
        'Invalid cursor format'
      )
    })
  })

  describe('data transformation', () => {
    it('should use makeJsonSafe on results', async () => {
      // Reset all filter mocks to default behavior
      getMetaQueryFilter.mockReturnValue([])
      getBlueprintIdQueryFilter.mockReturnValue([])
      getCursorConstraints.mockReturnValue({})
      getTakeConstraints.mockReturnValue({})

      const mockBots = [
        {
          id: 'bot_1',
          name: 'Test Bot',
          description: '',
          blueprintId: null,
          datasetId: null,
          skillsetId: null,
          backstory: '',
          model: 'gpt-4',
          visibility: 'private',
          meta: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prisma.bot.findMany.mockResolvedValue(mockBots)

      const { makeJsonSafe } = require('@/lib/struct')

      const req = {}
      const cursor = null

      await handler(cursor, req, null, mockSession)

      expect(makeJsonSafe).toHaveBeenCalledWith(mockBots)
    })
  })
})
