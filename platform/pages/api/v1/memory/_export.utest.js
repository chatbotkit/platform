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

const { getCursorConstraints, getMetaQueryFilter, getTakeConstraints } =
  jest.requireMock('@/lib/filter')
const yaml = jest.requireMock('@/lib/yaml').default

describe('GET /api/v1/memory/export', () => {
  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  it('returns memory items and wraps meta with yaml toString proxy', async () => {
    prisma.memory.findMany.mockResolvedValue([
      {
        id: 'mem_1',
        name: 'Memory',
        description: '',
        contactId: null,
        botId: 'bot_1',
        text: 'abc',
        meta: { nested: { value: 1 } },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ])

    const result = await handler(null, {}, null, session)

    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe('mem_1')
    expect(result.items[0].meta.nested.value).toBe(1)
    expect(String(result.items[0].meta)).toBe('yaml:{"nested":{"value":1}}')
    expect(yaml.stringify).toHaveBeenCalledWith({ nested: { value: 1 } })
  })

  it('uses yaml stringification of empty object when meta is null', async () => {
    prisma.memory.findMany.mockResolvedValue([
      {
        id: 'mem_2',
        name: '',
        description: '',
        contactId: null,
        botId: null,
        text: '',
        meta: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ])

    const result = await handler(null, {}, null, session)

    expect(String(result.items[0].meta)).toBe('yaml:{}')
  })

  it('applies user and meta filters', async () => {
    getMetaQueryFilter.mockReturnValue([
      { meta: { path: ['scope'], equals: 'a' } },
    ])
    prisma.memory.findMany.mockResolvedValue([])

    await handler(null, { query: { 'meta[scope]': 'a' } }, null, session)

    expect(getMetaQueryFilter).toHaveBeenCalled()
    expect(prisma.memory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'user_1' },
            { meta: { path: ['scope'], equals: 'a' } },
          ],
        },
      })
    )
  })

  it('applies cursor and take constraints', async () => {
    getCursorConstraints.mockReturnValue({ cursor: { id: 'mem_9' }, skip: 1 })
    getTakeConstraints.mockReturnValue({ take: 10 })
    prisma.memory.findMany.mockResolvedValue([])

    await handler('mem_9', { query: { take: '10' } }, null, session)

    expect(getCursorConstraints).toHaveBeenCalledWith(
      expect.anything(),
      'mem_9'
    )
    expect(getTakeConstraints).toHaveBeenCalled()
    expect(prisma.memory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'mem_9' },
        skip: 1,
        take: 10,
      })
    )
  })
})
