import prisma from '@/prisma/client'
import type { Team as PrismaTeam, TeamMembership } from '@/prisma/types'

import { assert, createSpan } from '@/lib/debug'

export interface Team {
  id: string
  userId: string
  memberships: { email: string }[]
}

export type DbTeam = Pick<PrismaTeam, 'id' | 'userId'> & {
  memberships: Pick<TeamMembership, 'email'>[]
}

/**
 * Returns a frozen Team object from a Team or DbTeam
 */
export function getTeamObject(team: Team | DbTeam): Team {
  return Object.freeze({
    id: team.id,
    userId: team.userId,
    memberships: team.memberships.map((membership) => ({
      email: membership.email,
    })),
  })
}

// @todo the following implementation is not handling the case where the requests
// are made in parallel and the cache is not yet populated, hence why we need
// to change this in the future

const teamByIdCache = new Map<string, Promise<Team | null>>()

/**
 * Caches a team object in the team cache
 */
export async function cacheTeam(team: Team): Promise<void> {
  const teamObject = getTeamObject(team)

  teamByIdCache.set(teamObject.id, Promise.resolve(teamObject))
}

/**
 * Retrieves a team by ID with caching support
 */
export async function fastGetTeamById(teamId: string): Promise<Team | null> {
  assert(teamId, 'teamId is required')

  const span = createSpan({ name: 'fastGetTeamById' })

  try {
    const key = teamId

    if (!teamByIdCache.has(key)) {
      const promise: Promise<Team | null> = prisma.team
        .findUnique({
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
        .then((team) => {
          if (team) {
            const teamObject = getTeamObject(team)

            return teamObject
          }

          return null
        })
        .catch((error) => {
          teamByIdCache.delete(key)

          throw error // Rethrow error to maintain existing behavior
        })

      teamByIdCache.set(key, promise)
    }

    const team = await teamByIdCache.get(key)

    return team || null
  } finally {
    span.finish()
  }
}
