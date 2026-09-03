/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

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
      avatarIntegration: {
        findMany: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

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

describe('GET /api/v1/integration/avatar/list', () => {
  const session = { user: { id: 'user_123' } }

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
    makeJsonSafe.mockImplementation((data) => data)
  })

  it('returns avatar integrations for the current user', async () => {
    const rows = [
      {
        id: 'avatar_1',
        name: 'Avatar One',
        description: '',
        blueprintId: 'bp_1',
        botId: 'bot_1',
        visibility: 'private',
        meta: {},
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      },
    ]

    prisma.avatarIntegration.findMany.mockResolvedValue(rows)

    const result = await handler(null, { query: {} }, null, session)

    expect(result).toEqual({ items: rows })
    expect(prisma.avatarIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ userId: 'user_123' }],
        },
      })
    )
  })

  it('applies request filters and pagination constraints', async () => {
    getMetaQueryFilter.mockReturnValue([{ meta: { locale: 'en' } }])
    getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp_7' }])
    getCursorConstraints.mockReturnValue({
      cursor: { id: 'avatar_4' },
      skip: 1,
    })
    getTakeConstraints.mockReturnValue({ take: 5 })
    prisma.avatarIntegration.findMany.mockResolvedValue([])

    await handler('avatar_4', { query: { blueprintId: 'bp_7' } }, null, session)

    expect(prisma.avatarIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'user_123' },
            { meta: { locale: 'en' } },
            { blueprintId: 'bp_7' },
          ],
        },
        cursor: { id: 'avatar_4' },
        skip: 1,
        take: 5,
      })
    )
  })

  it('uses expected select shape and makeJsonSafe', async () => {
    const raw = [{ id: 'avatar_1', createdAt: new Date('2024-01-01') }]
    const safe = [{ id: 'avatar_1', createdAt: '2024-01-01T00:00:00.000Z' }]

    prisma.avatarIntegration.findMany.mockResolvedValue(raw)
    makeJsonSafe.mockReturnValue(safe)

    const result = await handler(null, { query: {} }, null, session)
    const call = prisma.avatarIntegration.findMany.mock.calls[0][0]

    expect(call.select).toEqual({
      id: true,
      alias: true,
      name: true,
      description: true,
      blueprintId: true,
      botId: true,
      visibility: true,
      meta: true,
      createdAt: true,
      updatedAt: true,
    })

    expect(makeJsonSafe).toHaveBeenCalledWith(raw)
    expect(result.items).toEqual(safe)
  })

  it('propagates prisma errors', async () => {
    prisma.avatarIntegration.findMany.mockRejectedValue(new Error('db failed'))

    await expect(handler(null, { query: {} }, null, session)).rejects.toThrow(
      'db failed'
    )
  })
})
