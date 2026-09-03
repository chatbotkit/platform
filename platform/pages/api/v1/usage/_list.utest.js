/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import handler from './list'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: mockDeep(),
  }),
  { virtual: true }
)

const prisma = require('@/prisma/client').default

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
  getCursorConstraints: jest.fn(() => ({})),
  getFieldQueryFilter: jest.fn(() => []),
  getMetaQueryFilter: jest.fn(() => []),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((value) => value),
}))

const {
  getCursorConstraints,
  getFieldQueryFilter,
  getMetaQueryFilter,
  getTakeConstraints,
} = jest.requireMock('@/lib/filter')
const { makeJsonSafe } = jest.requireMock('@/lib/struct')

describe('GET /api/v1/usage/list', () => {
  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  it('returns usage items', async () => {
    const records = [
      {
        id: 'use_1',
        conversationId: 'conv_1',
        messageId: 'msg_1',
        taskId: null,
        contactId: null,
        blueprintId: null,
        botId: 'bot_1',
        datasetId: null,
        skillsetId: null,
        abilityId: null,
        type: 'conversation/complete',
        count: 123,
        meta: { reason: 'x' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]

    prisma.usage.findMany.mockResolvedValue(records)

    const result = await handler(null, {}, null, session)

    expect(result).toEqual({ items: records })
    expect(makeJsonSafe).toHaveBeenCalledWith(records)
  })

  it('applies user, meta, and field filters', async () => {
    getMetaQueryFilter.mockReturnValue([
      { meta: { path: ['reason'], equals: 'x' } },
    ])
    getFieldQueryFilter.mockReturnValue([{ botId: 'bot_1' }])
    prisma.usage.findMany.mockResolvedValue([])

    await handler(
      null,
      { query: { botId: 'bot_1', 'meta[reason]': 'x' } },
      null,
      session
    )

    expect(getMetaQueryFilter).toHaveBeenCalled()
    expect(getFieldQueryFilter).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining(['type', 'conversationId', 'botId', 'abilityId'])
    )
    expect(prisma.usage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'user_1' },
            { meta: { path: ['reason'], equals: 'x' } },
            { botId: 'bot_1' },
          ],
        },
      })
    )
  })

  it('applies cursor and take constraints', async () => {
    getCursorConstraints.mockReturnValue({ cursor: { id: 'use_9' }, skip: 1 })
    getTakeConstraints.mockReturnValue({ take: 20 })
    prisma.usage.findMany.mockResolvedValue([])

    await handler('use_9', { query: { take: '20' } }, null, session)

    expect(getCursorConstraints).toHaveBeenCalledWith(
      expect.anything(),
      'use_9'
    )
    expect(getTakeConstraints).toHaveBeenCalled()
    expect(prisma.usage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'use_9' },
        skip: 1,
        take: 20,
      })
    )
  })

  it('selects expected fields', async () => {
    prisma.usage.findMany.mockResolvedValue([])

    await handler(null, {}, null, session)

    expect(prisma.usage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          type: true,
          count: true,
          conversationId: true,
          abilityId: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        }),
      })
    )
  })
})
