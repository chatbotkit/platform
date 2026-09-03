/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './list'

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

const {
  getMetaQueryFilter,
  getFieldQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('GET /api/v1/event/metric/list', () => {
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

    it('should return event metric items with expected fields including value', async () => {
      const mockMetric = {
        id: 'metric_1',
        name: 'token_usage',
        description: '',
        type: 'token_usage',
        value: 1500,
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
        webhookId: null,
        meta: { model: 'gpt-4' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      prisma.eventMetric.findMany.mockResolvedValue([mockMetric])

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({
        id: 'metric_1',
        type: 'token_usage',
        value: 1500,
        conversationId: 'conv_1',
        botId: 'bot_1',
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

  describe('filtering', () => {
    it('should apply meta query filters from the request', async () => {
      prisma.eventMetric.findMany.mockResolvedValue([])
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['model'], equals: 'gpt-4' } },
      ])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { userId: 'user_abc123' },
              { meta: { path: ['model'], equals: 'gpt-4' } },
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

    it('should pass the correct filterable field names to getFieldQueryFilter', async () => {
      prisma.eventMetric.findMany.mockResolvedValue([])

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
      prisma.eventMetric.findMany.mockResolvedValue([])
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'metric_cursor' },
        skip: 1,
      })

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'metric_cursor' },
          skip: 1,
        })
      )
    })

    it('should apply take constraints from the request', async () => {
      prisma.eventMetric.findMany.mockResolvedValue([])
      getTakeConstraints.mockReturnValue({ take: 100 })

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      )
    })
  })

  describe('select fields', () => {
    it('should select the expected metric fields including value and webhookId', async () => {
      prisma.eventMetric.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(prisma.eventMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            name: true,
            description: true,
            type: true,
            value: true,
            webhookId: true,
            conversationId: true,
            taskId: true,
            botId: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          }),
        })
      )
    })
  })

  describe('multiple metrics', () => {
    it('should return all metrics in the result', async () => {
      const mockMetrics = [
        { id: 'metric_1', type: 'token_usage', value: 1000, meta: {} },
        { id: 'metric_2', type: 'message_count', value: 5, meta: null },
        { id: 'metric_3', type: 'conversation_count', value: 1, meta: {} },
      ]

      prisma.eventMetric.findMany.mockResolvedValue(mockMetrics)

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items).toHaveLength(3)
      expect(result.items.map((m) => m.id)).toEqual([
        'metric_1',
        'metric_2',
        'metric_3',
      ])
    })

    it('should preserve the value field for all metrics', async () => {
      const mockMetrics = [
        { id: 'metric_1', type: 'token_usage', value: 0 },
        { id: 'metric_2', type: 'token_usage', value: 9999 },
      ]

      prisma.eventMetric.findMany.mockResolvedValue(mockMetrics)

      const result = await handler(mockCursor, mockReq, null, mockSession)

      expect(result.items[0].value).toBe(0)
      expect(result.items[1].value).toBe(9999)
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
