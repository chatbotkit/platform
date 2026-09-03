/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import prisma from '@/prisma/client'

import handler from './list'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    team: {
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

describe('GET /api/v1/team/list', () => {
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  it('lists teams for session user with filters and pagination', async () => {
    getMetaQueryFilter.mockReturnValue([
      { meta: { path: ['env'], equals: 'p' } },
    ])
    getCursorConstraints.mockReturnValue({ cursor: { id: 'team-2' }, skip: 1 })
    getTakeConstraints.mockReturnValue({ take: 10 })
    prisma.team.findMany.mockResolvedValue([{ id: 'team-1', name: 'A' }])

    const req = { query: { cursor: 'team-2', take: '10', meta: { env: 'p' } } }
    const result = await handler('team-2', req, null, session)

    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where: {
        AND: [{ userId: 'user-1' }, { meta: { path: ['env'], equals: 'p' } }],
      },
      cursor: { id: 'team-2' },
      skip: 1,
      take: 10,
      select: {
        id: true,
        name: true,
        description: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    expect(makeJsonSafe).toHaveBeenCalledWith([{ id: 'team-1', name: 'A' }])
    expect(result).toEqual({ items: [{ id: 'team-1', name: 'A' }] })
  })

  it('returns empty list when no teams found', async () => {
    prisma.team.findMany.mockResolvedValue([])

    const result = await handler(null, {}, null, session)

    expect(result).toEqual({ items: [] })
  })

  it('propagates prisma errors', async () => {
    prisma.team.findMany.mockRejectedValue(new Error('db failed'))

    await expect(handler(null, {}, null, session)).rejects.toThrow('db failed')
  })
})
