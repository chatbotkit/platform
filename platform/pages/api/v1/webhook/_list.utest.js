/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import prisma from '@/prisma/client'

import handler from './list'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    webhook: {
      findMany: jest.fn(),
    },
  },
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
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

const {
  getMetaQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')
const { makeJsonSafe } = require('@/lib/struct')

describe('GET /api/v1/webhook/list', () => {
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  it('lists webhooks and splits comma-separated events', async () => {
    getMetaQueryFilter.mockReturnValue([{ meta: { path: ['x'], equals: 'y' } }])
    getCursorConstraints.mockReturnValue({ cursor: { id: 'wh-2' }, skip: 1 })
    getTakeConstraints.mockReturnValue({ take: 5 })
    prisma.webhook.findMany.mockResolvedValue([
      { id: 'wh-1', events: 'a,b', name: 'w1' },
      { id: 'wh-2', events: null, name: 'w2' },
    ])

    const result = await handler(
      'wh-2',
      { query: { cursor: 'wh-2', take: '5' } },
      null,
      session
    )

    expect(prisma.webhook.findMany).toHaveBeenCalledWith({
      where: {
        AND: [{ userId: 'user-1' }, { meta: { path: ['x'], equals: 'y' } }],
      },
      cursor: { id: 'wh-2' },
      skip: 1,
      take: 5,
      select: expect.objectContaining({
        id: true,
        name: true,
        description: true,
        request: true,
        events: true,
      }),
    })
    expect(makeJsonSafe).toHaveBeenCalledWith([
      { id: 'wh-1', events: ['a', 'b'], name: 'w1' },
      { id: 'wh-2', events: null, name: 'w2' },
    ])
    expect(result.items[0].events).toEqual(['a', 'b'])
  })

  it('returns empty list when no webhooks exist', async () => {
    prisma.webhook.findMany.mockResolvedValue([])

    const result = await handler(null, {}, null, session)

    expect(result).toEqual({ items: [] })
  })

  it('propagates prisma errors', async () => {
    prisma.webhook.findMany.mockRejectedValue(new Error('db failed'))

    await expect(handler(null, {}, null, session)).rejects.toThrow('db failed')
  })
})
