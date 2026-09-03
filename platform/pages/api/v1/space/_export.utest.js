/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import handler from './export'

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
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getMetaQueryFilter: jest.fn(() => []),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((value) => value),
}))

jest.mock('@/lib/yaml', () => ({
  __esModule: true,
  default: {
    stringify: jest.fn((value) => `yaml:${JSON.stringify(value)}`),
  },
}))

const {
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} = jest.requireMock('@/lib/filter')
const yaml = jest.requireMock('@/lib/yaml').default

describe('GET /api/v1/space/export', () => {
  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  it('returns spaces and preserves selected fields', async () => {
    prisma.space.findMany.mockResolvedValue([
      {
        id: 'space_1',
        name: 'A',
        description: 'B',
        blueprintId: 'bp_1',
        contactId: 'contact_1',
        meta: { level: 'gold' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ])

    const result = await handler(null, {}, null, session)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'space_1',
      name: 'A',
      description: 'B',
      blueprintId: 'bp_1',
      contactId: 'contact_1',
    })
    expect(String(result.items[0].meta)).toBe('yaml:{"level":"gold"}')
    expect(yaml.stringify).toHaveBeenCalledWith({ level: 'gold' })
  })

  it('applies user, meta, and blueprint filters', async () => {
    getMetaQueryFilter.mockReturnValue([
      { meta: { path: ['team'], equals: 'ops' } },
    ])
    getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp_9' }])
    prisma.space.findMany.mockResolvedValue([])

    await handler(
      null,
      { query: { blueprintId: 'bp_9', 'meta[team]': 'ops' } },
      null,
      session
    )

    expect(getMetaQueryFilter).toHaveBeenCalled()
    expect(getBlueprintIdQueryFilter).toHaveBeenCalled()
    expect(prisma.space.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'user_1' },
            { meta: { path: ['team'], equals: 'ops' } },
            { blueprintId: 'bp_9' },
          ],
        },
      })
    )
  })

  it('applies cursor and take constraints', async () => {
    getCursorConstraints.mockReturnValue({ cursor: { id: 'space_9' }, skip: 1 })
    getTakeConstraints.mockReturnValue({ take: 5 })
    prisma.space.findMany.mockResolvedValue([])

    await handler('space_9', { query: { take: '5' } }, null, session)

    expect(getCursorConstraints).toHaveBeenCalledWith(
      expect.anything(),
      'space_9'
    )
    expect(getTakeConstraints).toHaveBeenCalled()
    expect(prisma.space.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'space_9' },
        skip: 1,
        take: 5,
      })
    )
  })
})
