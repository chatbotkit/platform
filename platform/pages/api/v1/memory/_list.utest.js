/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
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
} = jest.requireMock('@/lib/filter')
const { makeJsonSafe } = jest.requireMock('@/lib/struct')

describe('GET /api/v1/memory/list', () => {
  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  it('returns listed memories for user', async () => {
    const memories = [
      {
        id: 'memory_1',
        name: 'A',
        description: 'B',
        contactId: null,
        botId: null,
        text: 'text',
        meta: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]

    prisma.memory.findMany.mockResolvedValue(memories)

    const result = await handler(null, {}, null, session)

    expect(prisma.memory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ userId: 'user_1' }],
        },
      })
    )
    expect(makeJsonSafe).toHaveBeenCalledWith(memories)
    expect(result).toEqual({ items: memories })
  })

  it('applies field and meta filters', async () => {
    getMetaQueryFilter.mockReturnValue([
      { meta: { path: ['topic'], equals: 'support' } },
    ])
    getFieldQueryFilter.mockReturnValue([{ botId: 'bot_123' }])
    prisma.memory.findMany.mockResolvedValue([])

    const req = { query: { botId: 'bot_123', meta: { topic: 'support' } } }

    await handler(null, req, null, session)

    expect(getMetaQueryFilter).toHaveBeenCalledWith(req)
    expect(getFieldQueryFilter).toHaveBeenCalledWith(req, [
      'contactId',
      'botId',
    ])
    expect(prisma.memory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'user_1' },
            { meta: { path: ['topic'], equals: 'support' } },
            { botId: 'bot_123' },
          ],
        },
      })
    )
  })

  it('applies cursor and take constraints', async () => {
    getCursorConstraints.mockReturnValue({ cursor: { id: 'm1' }, skip: 1 })
    getTakeConstraints.mockReturnValue({ take: 25 })
    prisma.memory.findMany.mockResolvedValue([])

    const req = { query: { cursor: 'm1', take: '25' } }

    await handler('m1', req, null, session)

    expect(getCursorConstraints).toHaveBeenCalledWith(req, 'm1')
    expect(getTakeConstraints).toHaveBeenCalledWith(req)
    expect(prisma.memory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'm1' },
        skip: 1,
        take: 25,
      })
    )
  })
})
