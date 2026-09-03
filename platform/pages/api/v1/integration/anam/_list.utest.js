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
      anamIntegration: {
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

describe('GET /api/v1/integration/anam/list', () => {
  const session = { user: { id: 'user_123' } }

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
    makeJsonSafe.mockImplementation((data) => data)
  })

  it('returns items from prisma for the current user', async () => {
    const rows = [
      {
        id: 'anam_1',
        name: 'Anam One',
        description: 'desc',
        blueprintId: 'bp_1',
        botId: 'bot_1',
        personaId: 'persona_1',
        visibility: 'private',
        meta: {},
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      },
    ]

    prisma.anamIntegration.findMany.mockResolvedValue(rows)

    const result = await handler(null, { query: {} }, null, session)

    expect(result).toEqual({ items: rows })
    expect(prisma.anamIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ userId: 'user_123' }],
        },
      })
    )
  })

  it('applies meta, blueprint, cursor, and take filters', async () => {
    getMetaQueryFilter.mockReturnValue([{ meta: { env: 'prod' } }])
    getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp_42' }])
    getCursorConstraints.mockReturnValue({ cursor: { id: 'anam_5' }, skip: 1 })
    getTakeConstraints.mockReturnValue({ take: 10 })
    prisma.anamIntegration.findMany.mockResolvedValue([])

    await handler(
      'anam_5',
      { query: { meta: 'x', blueprintId: 'bp_42' } },
      null,
      session
    )

    expect(prisma.anamIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'user_123' },
            { meta: { env: 'prod' } },
            { blueprintId: 'bp_42' },
          ],
        },
        cursor: { id: 'anam_5' },
        skip: 1,
        take: 10,
      })
    )
  })

  it('selects expected fields and returns json-safe payload', async () => {
    const raw = [{ id: 'anam_1', createdAt: new Date('2024-01-01') }]
    const safe = [{ id: 'anam_1', createdAt: '2024-01-01T00:00:00.000Z' }]

    prisma.anamIntegration.findMany.mockResolvedValue(raw)
    makeJsonSafe.mockReturnValue(safe)

    const result = await handler(null, { query: {} }, null, session)

    const call = prisma.anamIntegration.findMany.mock.calls[0][0]

    expect(call.select).toEqual({
      id: true,
      alias: true,
      name: true,
      description: true,
      blueprintId: true,
      botId: true,
      personaId: true,
      visibility: true,
      meta: true,
      createdAt: true,
      updatedAt: true,
    })

    expect(makeJsonSafe).toHaveBeenCalledWith(raw)
    expect(result.items).toEqual(safe)
  })

  it('propagates prisma errors', async () => {
    prisma.anamIntegration.findMany.mockRejectedValue(new Error('db failed'))

    await expect(handler(null, { query: {} }, null, session)).rejects.toThrow(
      'db failed'
    )
  })
})
