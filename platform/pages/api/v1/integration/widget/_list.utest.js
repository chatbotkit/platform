/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './list'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    widgetIntegration: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({
  BotVisibility: { private: 'private', public: 'public', unlisted: 'unlisted' },
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

const { makeJsonSafe } = require('@/lib/struct')

describe('/api/v1/integration/widget/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
    makeJsonSafe.mockImplementation((data) => data)
  })

  describe('basic functionality', () => {
    it('returns empty items array when no widgets exist', async () => {
      prisma.widgetIntegration.findMany.mockResolvedValue([])

      const result = await handler(null, {}, null, mockSession)

      expect(result).toEqual({ items: [] })
    })

    it('returns all widget integrations for the user', async () => {
      const mockWidgets = [
        {
          id: 'wgt_1',
          name: 'Support Widget',
          description: 'Customer support chat',
          blueprintId: 'bp_123',
          botId: 'bot_456',
          theme: { primaryColor: '#0066cc' },
          title: 'How can we help?',
          stream: true,
          attachments: true,
          voiceIn: false,
          contactCollection: true,
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'wgt_2',
          name: 'Sales Widget',
          description: 'Sales assistant',
          blueprintId: null,
          botId: 'bot_789',
          theme: null,
          title: null,
          stream: false,
          attachments: false,
          voiceIn: false,
          contactCollection: false,
          meta: { environment: 'production' },
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ]

      prisma.widgetIntegration.findMany.mockResolvedValue(mockWidgets)

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toEqual(mockWidgets)
      expect(result.items).toHaveLength(2)
    })

    it('filters by userId from session', async () => {
      prisma.widgetIntegration.findMany.mockResolvedValue([])

      await handler(null, {}, null, mockSession)

      expect(prisma.widgetIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user_123' }]),
          }),
        })
      )
    })

    it('applies meta query filter from request', async () => {
      getMetaQueryFilter.mockReturnValue([{ meta: { env: 'prod' } }])
      prisma.widgetIntegration.findMany.mockResolvedValue([])

      const mockReq = { query: { meta: { env: 'prod' } } }

      await handler(null, mockReq, null, mockSession)

      expect(prisma.widgetIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              { userId: 'user_123' },
              { meta: { env: 'prod' } },
            ]),
          },
        })
      )
    })

    it('applies blueprint id filter from request', async () => {
      getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp_abc' }])
      prisma.widgetIntegration.findMany.mockResolvedValue([])

      const mockReq = { query: { blueprintId: 'bp_abc' } }

      await handler(null, mockReq, null, mockSession)

      expect(prisma.widgetIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([{ blueprintId: 'bp_abc' }]),
          },
        })
      )
    })

    it('applies cursor and take constraints', async () => {
      getCursorConstraints.mockReturnValue({ cursor: { id: 'wgt_5' }, skip: 1 })
      getTakeConstraints.mockReturnValue({ take: 10 })
      prisma.widgetIntegration.findMany.mockResolvedValue([])

      await handler('wgt_5', {}, null, mockSession)

      expect(prisma.widgetIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'wgt_5' },
          skip: 1,
          take: 10,
        })
      )
    })

    it('calls makeJsonSafe on the results', async () => {
      const raw = [{ id: 'wgt_1', createdAt: new Date('2024-01-01') }]
      const safe = [{ id: 'wgt_1', createdAt: '2024-01-01T00:00:00.000Z' }]

      prisma.widgetIntegration.findMany.mockResolvedValue(raw)
      makeJsonSafe.mockReturnValue(safe)

      const result = await handler(null, {}, null, mockSession)

      expect(makeJsonSafe).toHaveBeenCalledWith(raw)
      expect(result.items).toEqual(safe)
    })
  })

  describe('field selection', () => {
    it('selects all expected fields', async () => {
      prisma.widgetIntegration.findMany.mockResolvedValue([])

      await handler(null, {}, null, mockSession)

      const call = prisma.widgetIntegration.findMany.mock.calls[0][0]

      expect(call.select).toMatchObject({
        id: true,
        alias: true,
        name: true,
        description: true,
        blueprintId: true,
        botId: true,
        theme: true,
        layout: true,
        title: true,
        stream: true,
        attachments: true,
        voiceIn: true,
        voiceOut: true,
        contactCollection: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      })
    })
  })

  describe('error handling', () => {
    it('propagates prisma errors', async () => {
      const dbError = new Error('Database connection failed')

      prisma.widgetIntegration.findMany.mockRejectedValue(dbError)

      await expect(handler(null, {}, null, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })
})
