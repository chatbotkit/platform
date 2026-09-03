/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    team: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

const { makeJsonSafe } = require('@/lib/struct')

describe('GET /api/v1/team/[teamId]/fetch', () => {
  const req = { query: { teamId: 'team-1' } }
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns team when owner matches session user', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team-1',
      userId: 'user-1',
      name: 'Team',
      description: '',
      meta: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await handler(req, session)

    expect(prisma.team.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'team-1',
      expect.objectContaining({
        select: expect.objectContaining({ id: true, userId: true }),
      })
    )
    expect(makeJsonSafe).toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it('returns 404 when team is missing', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
  })

  it('returns 401 when session user is not owner', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team-1',
      userId: 'user-2',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
  })

  it('propagates lookup errors', async () => {
    prisma.team.findUniqueByIdentifier.mockRejectedValue(
      new Error('lookup failed')
    )

    await expect(handler(req, session)).rejects.toThrow('lookup failed')
  })
})
