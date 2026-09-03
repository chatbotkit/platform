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
    teamMembership: {
      findFirst: jest.fn(),
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
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (obj) => obj,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('/api/v1/team/[teamId]/membership/[teamMembershipId]/fetch', () => {
  const session = { user: { id: 'user_1' } }
  const req = {
    query: {
      teamId: 'team_1',
      teamMembershipId: 'membership_1',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when team is missing', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
    expect(prisma.teamMembership.findFirst).not.toHaveBeenCalled()
  })

  it('returns 401 when team does not belong to session user', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'owner_2',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
    expect(prisma.teamMembership.findFirst).not.toHaveBeenCalled()
  })

  it('returns 404 when membership is not found for team', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'user_1',
    })
    prisma.teamMembership.findFirst.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(prisma.teamMembership.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'membership_1',
        teamId: 'team_1',
      },
      select: expect.any(Object),
    })
    expect(result).toEqual({ status: 404 })
  })

  it('returns membership payload for valid owner', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'user_1',
    })
    prisma.teamMembership.findFirst.mockResolvedValue({
      id: 'membership_1',
      name: 'Alice',
      description: 'Owner',
      teamId: 'team_1',
      email: 'alice@example.com',
      meta: { role: 'owner' },
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    })

    const result = await handler(req, session)

    expect(result).toEqual({
      status: 200,
      body: expect.objectContaining({
        id: 'membership_1',
        email: 'alice@example.com',
        teamId: 'team_1',
      }),
    })
  })

  it('propagates database errors', async () => {
    prisma.team.findUniqueByIdentifier.mockRejectedValue(new Error('db failed'))

    await expect(handler(req, session)).rejects.toThrow('db failed')
  })
})
