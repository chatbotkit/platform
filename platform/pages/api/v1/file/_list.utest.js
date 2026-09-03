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
} = jest.requireMock('@/lib/filter')
const { makeJsonSafe } = jest.requireMock('@/lib/struct')

describe('GET /api/v1/file/list', () => {
  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  it('returns listed files for user', async () => {
    const files = [
      {
        id: 'file_1',
        alias: 'file-one',
        name: 'A',
        description: 'B',
        blueprintId: null,
        visibility: 'private',
        meta: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]

    prisma.file.findMany.mockResolvedValue(files)

    const result = await handler(null, {}, null, session)

    expect(prisma.file.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ userId: 'user_1' }],
        },
      })
    )
    expect(makeJsonSafe).toHaveBeenCalledWith(files)
    expect(result).toEqual({ items: files })
  })

  it('applies meta and blueprint filters', async () => {
    getMetaQueryFilter.mockReturnValue([
      { meta: { path: ['kind'], equals: 'report' } },
    ])
    getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp_123' }])
    prisma.file.findMany.mockResolvedValue([])

    const req = { query: { blueprintId: 'bp_123', meta: { kind: 'report' } } }

    await handler(null, req, null, session)

    expect(getMetaQueryFilter).toHaveBeenCalledWith(req)
    expect(getBlueprintIdQueryFilter).toHaveBeenCalledWith(req)
    expect(prisma.file.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'user_1' },
            { meta: { path: ['kind'], equals: 'report' } },
            { blueprintId: 'bp_123' },
          ],
        },
      })
    )
  })

  it('applies cursor and take constraints', async () => {
    getCursorConstraints.mockReturnValue({ cursor: { id: 'f1' }, skip: 1 })
    getTakeConstraints.mockReturnValue({ take: 10 })
    prisma.file.findMany.mockResolvedValue([])

    const req = { query: { cursor: 'f1', take: '10' } }

    await handler('f1', req, null, session)

    expect(getCursorConstraints).toHaveBeenCalledWith(req, 'f1')
    expect(getTakeConstraints).toHaveBeenCalledWith(req)
    expect(prisma.file.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'f1' },
        skip: 1,
        take: 10,
      })
    )
  })
})
