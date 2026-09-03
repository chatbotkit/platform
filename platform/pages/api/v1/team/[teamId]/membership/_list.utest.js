/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './list'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      team: {
        findUniqueByIdentifier: jest.fn(),
      },
      teamMembership: {
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

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/filter', () => ({
  getMetaQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: jest.fn(() => {
    throw new Error('not_found')
  }),
  throwNotAuthorized: jest.fn(() => {
    throw new Error('not_authorized')
  }),
}))

const {
  getMetaQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')
const { makeJsonSafe } = require('@/lib/struct')

describe('GET /api/v1/team/[teamId]/membership/list', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { teamId: 'team_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  it('throws not found when team does not exist', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue(null)

    await expect(handler(null, req, null, session)).rejects.toThrow('not_found')
    expect(prisma.teamMembership.findMany).not.toHaveBeenCalled()
  })

  it('throws not authorized when session user does not own the team', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'user_2',
    })

    await expect(handler(null, req, null, session)).rejects.toThrow(
      'not_authorized'
    )
    expect(prisma.teamMembership.findMany).not.toHaveBeenCalled()
  })

  it('lists memberships with filters and pagination', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'user_1',
    })
    getMetaQueryFilter.mockReturnValue([
      { meta: { path: ['role'], equals: 'a' } },
    ])
    getCursorConstraints.mockReturnValue({
      cursor: { id: 'team_member_2' },
      skip: 1,
    })
    getTakeConstraints.mockReturnValue({ take: 20 })
    prisma.teamMembership.findMany.mockResolvedValue([
      { id: 'team_member_1', email: 'member@example.com' },
    ])

    const result = await handler('team_member_2', req, null, session)

    expect(prisma.teamMembership.findMany).toHaveBeenCalledWith({
      where: {
        AND: [{ teamId: 'team_1' }, { meta: { path: ['role'], equals: 'a' } }],
      },
      cursor: { id: 'team_member_2' },
      skip: 1,
      take: 20,
      select: {
        id: true,
        name: true,
        description: true,
        email: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    expect(makeJsonSafe).toHaveBeenCalledWith([
      { id: 'team_member_1', email: 'member@example.com' },
    ])
    expect(result).toEqual({
      items: [{ id: 'team_member_1', email: 'member@example.com' }],
    })
  })
})
