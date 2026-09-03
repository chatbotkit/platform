/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import cuid from '@/lib/cuid'
import { cacheTeam, fastGetTeamById, getTeamObject } from '@/lib/team.get'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

beforeEach(() => {
  mockReset(prisma)
})

describe('fastGetTeamById', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return team when found', async () => {
    const teamId = cuid()
    const userId = cuid()

    const team = {
      id: teamId,
      userId,
      memberships: [{ email: 'a@example.com' }, { email: 'b@example.com' }],
    }

    prisma.team.findUnique.mockResolvedValue(team)

    const result = await fastGetTeamById(teamId)

    expect(result).toEqual(team)
    expect(prisma.team.findUnique).toHaveBeenCalledWith({
      where: {
        id: teamId,
      },
      select: {
        id: true,

        userId: true,

        memberships: {
          select: {
            email: true,
          },
        },
      },
      cacheStrategy: {
        ttl: 60,
        swr: 60,
      },
    })
  })

  it('should return null when team not found and cache the null', async () => {
    const teamId = cuid()

    prisma.team.findUnique.mockResolvedValue(null)

    const r1 = await fastGetTeamById(teamId)
    const r2 = await fastGetTeamById(teamId)

    expect(r1).toBeNull()
    expect(r2).toBeNull()
    expect(prisma.team.findUnique).toHaveBeenCalledTimes(1)
  })

  it('should not make multiple queries for the same team', async () => {
    const teamId = cuid()
    const userId = cuid()

    const team = {
      id: teamId,
      userId,
      memberships: [{ email: 'a@example.com' }],
    }

    prisma.team.findUnique.mockResolvedValue(team)

    const r1 = await fastGetTeamById(teamId)

    expect(r1).toEqual(team)
    expect(prisma.team.findUnique).toHaveBeenCalledTimes(1)

    const r2 = await fastGetTeamById(teamId)

    expect(r2).toEqual(team)
    expect(prisma.team.findUnique).toHaveBeenCalledTimes(1)
  })

  it('should handle database errors gracefully and retry after cache invalidation', async () => {
    const teamId = cuid()

    prisma.team.findUnique.mockRejectedValueOnce(new Error('DB error'))
    prisma.team.findUnique.mockRejectedValueOnce(new Error('DB error'))

    await expect(fastGetTeamById(teamId)).rejects.toThrow('DB error')
    await expect(fastGetTeamById(teamId)).rejects.toThrow('DB error')

    expect(prisma.team.findUnique).toHaveBeenCalledTimes(2)
  })

  it('should handle rapid successive calls for the same team', async () => {
    const teamId = cuid()
    const userId = cuid()

    const team = {
      id: teamId,
      userId,
      memberships: [{ email: 'a@example.com' }, { email: 'b@example.com' }],
    }

    prisma.team.findUnique.mockResolvedValue(team)

    const calls = Array.from({ length: 8 }, () => fastGetTeamById(teamId))
    const results = await Promise.all(calls)

    results.forEach((r) => expect(r).toEqual(team))
    expect(prisma.team.findUnique).toHaveBeenCalledTimes(1)
  })

  it('should validate input and throw when teamId is missing', async () => {
    await expect(fastGetTeamById('')).rejects.toThrow('teamId is required')
    expect(prisma.team.findUnique).not.toHaveBeenCalled()
  })
})

describe('getTeamObject', () => {
  it('should shape memberships to email-only and freeze the result', () => {
    const id = cuid()
    const userId = cuid()
    const obj = getTeamObject({
      id,
      userId,
      memberships: [
        { email: 'a@example.com', role: 'admin' },
        { email: 'b@example.com', other: 'ignored' },
      ],
    })

    expect(obj).toEqual({
      id,
      userId,
      memberships: [{ email: 'a@example.com' }, { email: 'b@example.com' }],
    })

    expect(Object.isFrozen(obj)).toBe(true)
  })
})

describe('cacheTeam', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should seed id cache to avoid DB calls', async () => {
    const id = cuid()
    const team = {
      id,
      userId: cuid(),
      memberships: [{ email: 'seed@example.com' }],
    }

    await cacheTeam(team)

    const r = await fastGetTeamById(id)

    expect(r).toEqual(
      expect.objectContaining({ id: team.id, userId: team.userId })
    )

    expect(prisma.team.findUnique).not.toHaveBeenCalled()
  })
})
