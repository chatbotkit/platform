/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './list'

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

const {
  getMetaQueryFilter,
  getFieldQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('GET /api/v1/event/log/list', () => {
  const mockSession = { user: { id: 'user_abc123' } }
  const mockReq = {}
  const mockCursor = null

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getFieldQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
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

    it('should return event log items with expected fields', async () => {
      const mockEvent = {
        id: 'evt_1',
        name: 'conversation.create',
        description: '',
        type: 'conversation.create',
        conversationId: 'conv_1',
        taskId: null,
        contactId: null,
        blueprintId: null,
        botId: 'bot_1',
        datasetId: null,
        recordId: null,
        skillsetId: null,
        abilityId: null,
        fileId: null,
        secretId: null,
        portalId: null,
        widgetIntegrationId: null,
        slackIntegrationId: null,
        discordIntegrationId: null,
        microsoftteamsIntegrationId: null,
        googlechatIntegrationId: null,
        whatsappIntegrationId: null,
        messengerIntegrationId: null,
        telegramIntegrationId: null,
        twilioIntegrationId: null,
        emailIntegrationId: null,
        sitemapIntegrationId: null,
        notionIntegrationId: null,
        triggerIntegrationId: null,
        supportIntegrationId: null,
        extractIntegrationId: null,
        mcpserverIntegrationId: null,
        meta: { source: 'api' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      prisma.eventLog.findMany.mockResolvedValue([mockEvent])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({
        id: 'evt_1',
        type: 'conversation.create',
        conversationId: 'conv_1',
        botId: 'bot_1',
      })
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

  describe('filtering', () => {
    it('should apply meta query filters from the request', async () => {
      prisma.eventLog.findMany.mockResolvedValue([])
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['source'], equals: 'webhook' } },
      ])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { userId: 'user_abc123' },
              { meta: { path: ['source'], equals: 'webhook' } },
            ],
          },
        })
      )
    })

    it('should apply field query filters from the request', async () => {
      prisma.eventLog.findMany.mockResolvedValue([])
      getFieldQueryFilter.mockReturnValue([
        { type: { equals: 'conversation.create' } },
      ])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              { userId: 'user_abc123' },
              { type: { equals: 'conversation.create' } },
            ]),
          },
        })
      )
    })

    it('should combine userId with both meta and field filters', async () => {
      prisma.eventLog.findMany.mockResolvedValue([])
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['env'], equals: 'prod' } },
      ])
      getFieldQueryFilter.mockReturnValue([{ botId: { equals: 'bot_1' } }])

      await handler(mockCursor, mockReq, null, mockSession)

      const callArgs = prisma.eventLog.findMany.mock.calls[0][0]
      const andClauses = callArgs.where.AND

      expect(andClauses).toContainEqual({ userId: 'user_abc123' })
      expect(andClauses).toContainEqual({
        meta: { path: ['env'], equals: 'prod' },
      })
      expect(andClauses).toContainEqual({ botId: { equals: 'bot_1' } })
    })

    it('should pass the correct filterable field names to getFieldQueryFilter', async () => {
      prisma.eventLog.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(getFieldQueryFilter).toHaveBeenCalledWith(
        mockReq,
        expect.arrayContaining([
          'type',
          'conversationId',
          'taskId',
          'contactId',
          'blueprintId',
          'botId',
          'datasetId',
          'recordId',
          'skillsetId',
          'abilityId',
          'fileId',
          'secretId',
          'portalId',
          'widgetIntegrationId',
          'slackIntegrationId',
          'discordIntegrationId',
          'microsoftteamsIntegrationId',
          'googlechatIntegrationId',
          'whatsappIntegrationId',
          'messengerIntegrationId',
          'telegramIntegrationId',
          'twilioIntegrationId',
          'emailIntegrationId',
          'sitemapIntegrationId',
          'notionIntegrationId',
          'triggerIntegrationId',
          'supportIntegrationId',
          'extractIntegrationId',
          'mcpserverIntegrationId',
        ])
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
      getTakeConstraints.mockReturnValue({ take: 100 })

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      )
    })
  })

  describe('select fields', () => {
    it('should select the expected event log fields', async () => {
      prisma.eventLog.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            name: true,
            description: true,
            type: true,
            conversationId: true,
            taskId: true,
            contactId: true,
            blueprintId: true,
            botId: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          }),
        })
      )
    })
  })

  describe('multiple events', () => {
    it('should return all events in the result', async () => {
      const mockEvents = [
        {
          id: 'evt_1',
          type: 'conversation.create',
          meta: {},
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'evt_2',
          type: 'bot.update',
          meta: null,
          createdAt: new Date('2024-01-02'),
        },
        {
          id: 'evt_3',
          type: 'task.complete',
          meta: { duration: 1234 },
          createdAt: new Date('2024-01-03'),
        },
      ]

      prisma.eventLog.findMany.mockResolvedValue(mockEvents)

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(3)
      expect(result.items.map((e) => e.id)).toEqual(['evt_1', 'evt_2', 'evt_3'])
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
