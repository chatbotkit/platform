/**
 * @jest-environment node
 */
import {
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { makeJsonSafe } from '@/lib/struct'

import handler from './list'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      telegramIntegration: {
        findMany: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

const prisma = jest.requireMock('@/prisma/client').default

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
  makeJsonSafe: jest.fn((value) => value),
}))

describe('GET /api/v1/integration/telegram/list', () => {
  const session = { user: { id: 'user_123' } }

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
    makeJsonSafe.mockImplementation((value) => value)
  })

  it('returns telegram integrations for the authenticated user', async () => {
    const rows = [
      {
        id: 'tg_1',
        name: 'Telegram A',
        description: '',
        blueprintId: 'bp_1',
        botId: 'bot_1',
        contactCollection: true,
        sessionDuration: 3600000,
        attachments: true,
        allowFrom: '@admin',
        meta: { env: 'prod' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]

    prisma.telegramIntegration.findMany.mockResolvedValue(rows)

    const result = await handler(null, { query: {} }, null, session)
    const query = prisma.telegramIntegration.findMany.mock.calls[0][0]

    expect(query.where).toEqual({
      AND: [{ userId: 'user_123' }],
    })
    expect(query.select).toEqual({
      id: true,
      alias: true,
      name: true,
      description: true,
      blueprintId: true,
      botId: true,
      contactCollection: true,
      sessionDuration: true,
      attachments: true,
      allowFrom: true,
      meta: true,
      createdAt: true,
      updatedAt: true,
    })
    expect(query.select.botToken).toBeUndefined()
    expect(makeJsonSafe).toHaveBeenCalledWith(rows)
    expect(result).toEqual({ items: rows })
  })

  it('applies metadata, blueprint, cursor, and take filters', async () => {
    getMetaQueryFilter.mockReturnValue([{ 'meta.team': 'ops' }])
    getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp_7' }])
    getCursorConstraints.mockReturnValue({ cursor: { id: 'tg_7' }, skip: 1 })
    getTakeConstraints.mockReturnValue({ take: 25 })

    prisma.telegramIntegration.findMany.mockResolvedValue([])

    await handler('tg_7', { query: { order: 'asc' } }, null, session)

    expect(prisma.telegramIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'user_123' },
            { 'meta.team': 'ops' },
            { blueprintId: 'bp_7' },
          ],
        },
        cursor: { id: 'tg_7' },
        skip: 1,
        take: 25,
      })
    )
  })

  it('propagates database errors', async () => {
    prisma.telegramIntegration.findMany.mockRejectedValue(
      new Error('db failed')
    )

    await expect(handler(null, { query: {} }, null, session)).rejects.toThrow(
      'db failed'
    )
  })
})
