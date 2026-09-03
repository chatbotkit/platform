/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './export'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    task: {
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
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

jest.mock('@/lib/yaml', () => ({
  stringify: jest.fn(() => `key: value\n`),
}))

describe('GET /api/v1/task/export', () => {
  const {
    getMetaQueryFilter,
    getCursorConstraints,
    getTakeConstraints,
  } = require('@/lib/filter')

  const yaml = require('@/lib/yaml')

  const mockSession = { user: { id: 'user_123' } }
  const mockReq = {}
  const mockCursor = null

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
    yaml.stringify.mockImplementation(() => `key: value\n`)
  })

  describe('basic functionality', () => {
    it('should return items array for authenticated user', async () => {
      prisma.task.findMany.mockResolvedValue([])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result).toHaveProperty('items')
      expect(Array.isArray(result.items)).toBe(true)
    })

    it('should query tasks filtered by userId', async () => {
      prisma.task.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ userId: 'user_123' }],
          },
        })
      )
    })

    it('should return tasks mapped with Proxy for meta', async () => {
      const mockTask = {
        id: 'task_1',
        name: 'Daily Report',
        description: 'Generate daily report',
        meta: { priority: 'high' },
        schedule: '0 9 * * *',
        timezone: 'America/New_York',
        contactId: null,
        botId: 'bot_1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      prisma.task.findMany.mockResolvedValue([mockTask])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toHaveProperty('id', 'task_1')
      expect(result.items[0]).toHaveProperty('meta')
      expect(result.items[0]).toHaveProperty('timezone', 'America/New_York')
      expect(result.items[0]).not.toHaveProperty('messages')
    })
  })

  describe('meta Proxy serialization', () => {
    it('should return a Proxy for meta that stringifies to YAML on toString()', async () => {
      const mockTask = {
        id: 'task_1',
        meta: { priority: 'high', tags: ['urgent'] },
      }

      prisma.task.findMany.mockResolvedValue([mockTask])
      yaml.stringify.mockReturnValue('priority: high\ntags:\n  - urgent\n')

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      const stringified = item.meta.toString()

      expect(yaml.stringify).toHaveBeenCalledWith({
        priority: 'high',
        tags: ['urgent'],
      })
      expect(stringified).toBe('priority: high\ntags:\n  - urgent\n')
    })

    it('should still expose meta properties directly on the Proxy', async () => {
      const mockTask = {
        id: 'task_1',
        meta: { environment: 'production' },
      }

      prisma.task.findMany.mockResolvedValue([mockTask])

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      expect(item.meta.environment).toBe('production')
    })

    it('should call yaml.stringify with empty object when meta is null', async () => {
      const mockTask = {
        id: 'task_1',
        meta: null,
      }

      prisma.task.findMany.mockResolvedValue([mockTask])
      yaml.stringify.mockReturnValue('')

      const result = await handler(mockCursor, mockReq, null, mockSession)
      const item = result.items[0]

      item.meta.toString()

      // meta || {} becomes {}, truthy, so yaml.stringify({}) is called
      expect(yaml.stringify).toHaveBeenCalledWith({})
    })
  })

  describe('filtering and pagination', () => {
    it('should apply meta query filters from the request', async () => {
      prisma.task.findMany.mockResolvedValue([])
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['env'], equals: 'prod' } },
      ])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { userId: 'user_123' },
              { meta: { path: ['env'], equals: 'prod' } },
            ],
          },
        })
      )
    })

    it('should apply cursor constraints', async () => {
      prisma.task.findMany.mockResolvedValue([])
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'task_cursor' },
        skip: 1,
      })

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'task_cursor' },
          skip: 1,
        })
      )
    })

    it('should apply take constraints', async () => {
      prisma.task.findMany.mockResolvedValue([])
      getTakeConstraints.mockReturnValue({ take: 50 })

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      )
    })
  })

  describe('select fields', () => {
    it('should select the expected task fields', async () => {
      prisma.task.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            name: true,
            description: true,
            contactId: true,
            botId: true,
            schedule: true,
            timezone: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          }),
        })
      )
    })
  })

  describe('multiple tasks', () => {
    it('should map all tasks with Proxy meta', async () => {
      const tasks = [
        { id: 'task_1', meta: { a: 1 } },
        { id: 'task_2', meta: { b: 2 } },
        { id: 'task_3', meta: null },
      ]

      prisma.task.findMany.mockResolvedValue(tasks)

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(3)
      expect(result.items[0].id).toBe('task_1')
      expect(result.items[1].id).toBe('task_2')
      expect(result.items[2].id).toBe('task_3')

      // Each item should have a meta Proxy
      result.items.forEach((item) => {
        expect(item).toHaveProperty('meta')
      })
    })
  })
})
