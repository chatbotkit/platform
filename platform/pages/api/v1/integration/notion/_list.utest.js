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
      notionIntegration: {
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

describe('GET /api/v1/integration/notion/list', () => {
  const session = { user: { id: 'user_123' } }

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
    makeJsonSafe.mockImplementation((value) => value)
  })

  it('returns integrations and masks configured tokens', async () => {
    const rows = [
      {
        id: 'notion_1',
        name: 'Workspace A',
        description: '',
        blueprintId: 'bp_1',
        datasetId: 'ds_1',
        token: 'secret-token',
        syncStatus: 'ready',
        syncSchedule: '0 * * * *',
        lastSyncedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresIn: 3600000,
        meta: { env: 'prod' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        id: 'notion_2',
        name: 'Workspace B',
        description: '',
        blueprintId: null,
        datasetId: 'ds_2',
        token: null,
        syncStatus: null,
        syncSchedule: null,
        lastSyncedAt: null,
        expiresIn: null,
        meta: null,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        updatedAt: new Date('2026-01-04T00:00:00.000Z'),
      },
    ]

    prisma.notionIntegration.findMany.mockResolvedValue(rows)

    const result = await handler(null, { query: {} }, null, session)
    const query = prisma.notionIntegration.findMany.mock.calls[0][0]

    expect(query.where).toEqual({ AND: [{ userId: 'user_123' }] })
    expect(query.select).toEqual({
      id: true,
      alias: true,
      name: true,
      description: true,
      blueprintId: true,
      datasetId: true,
      token: true,
      syncStatus: true,
      syncSchedule: true,
      lastSyncedAt: true,
      expiresIn: true,
      meta: true,
      createdAt: true,
      updatedAt: true,
    })
    expect(makeJsonSafe).toHaveBeenCalledTimes(1)
    expect(result.items[0].token).toBe('********')
    expect(result.items[1].token).toBeNull()
  })

  it('applies metadata, blueprint, cursor, and take filters', async () => {
    getMetaQueryFilter.mockReturnValue([{ 'meta.team': 'ops' }])
    getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp_7' }])
    getCursorConstraints.mockReturnValue({
      cursor: { id: 'notion_7' },
      skip: 1,
    })
    getTakeConstraints.mockReturnValue({ take: 10 })
    prisma.notionIntegration.findMany.mockResolvedValue([])

    await handler('notion_7', { query: { order: 'asc' } }, null, session)

    expect(prisma.notionIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'user_123' },
            { 'meta.team': 'ops' },
            { blueprintId: 'bp_7' },
          ],
        },
        cursor: { id: 'notion_7' },
        skip: 1,
        take: 10,
      })
    )
  })

  it('propagates prisma errors', async () => {
    prisma.notionIntegration.findMany.mockRejectedValue(new Error('db failed'))

    await expect(handler(null, { query: {} }, null, session)).rejects.toThrow(
      'db failed'
    )
  })
})
