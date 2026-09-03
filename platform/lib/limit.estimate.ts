import prisma from '@/prisma/client'
import {
  getTotalAbilitiesForUser,
  getTotalBotsForUser,
  getTotalDatasetsForUser,
  getTotalFilesForUser,
  getTotalPoliciesForUser,
  getTotalPortalsForUser,
  getTotalSkillsetsForUser,
  getTotalUsersForUser,
  getTotalTeamMembersForUser,
  getTotalTeamsForUser,
} from '@/prisma/sql'

import { ttlCache } from '@/lib/cache'
import { getStore } from '@/lib/store.types'

export interface User {
  id: string
  email: string
  billingSubscriptionId?: string | null
  billingSubscriptionStatus?: string | null
}

function getCount(results: Array<{ count: bigint }>): number {
  return Number(results[0].count)
}

/**
 * Retrieves the total number of bots for the user.
 */
export async function getApproximateTotalBots(user: User): Promise<number> {
  return await ttlCache(`fast-total-bots-${user.id}`, 60, async () => {
    const results = await prisma.$queryRawTyped(
      getTotalBotsForUser(user.id, user.id)
    )

    return getCount(results)
  })
}

/**
 * Retrieves the total number of datasets for the user.
 */
export async function getApproximateTotalDatasets(user: User): Promise<number> {
  return await ttlCache(`fast-total-datasets-${user.id}`, 60, async () => {
    const results = await prisma.$queryRawTyped(
      getTotalDatasetsForUser(user.id, user.id)
    )

    return getCount(results)
  })
}

/**
 * Retrieves the total number of records for the user.
 *
 * @param user - The user object
 * @returns Promise resolving to the count of records
 * @todo this is not fast enough, we need to make it faster
 */
export async function getApproximateTotalRecords(user: User): Promise<number> {
  return await ttlCache(`fast-total-records-${user.id}`, 60, async () => {
    const datasets = await prisma.dataset.findMany({
      where: {
        user: {
          OR: [{ id: user.id }, { parentId: user.id }],
        },
      },
      select: {
        id: true,
      },
    })

    const counts = await Promise.all(
      datasets.map(async (dataset) => {
        const store = await getStore()

        return await store.countRecords({ datasetId: dataset.id })
      })
    )

    return counts.reduce((total, count) => total + count, 0)
  })
}

/**
 * Retrieves the total number of skillsets for the user.
 *
 * @param user - The user object
 * @returns Promise resolving to the count of skillsets
 * @todo this is not fast enough, we need to make it faster
 */
export async function getApproximateTotalSkillsets(
  user: User
): Promise<number> {
  return await ttlCache(`fast-total-skillsets-${user.id}`, 60, async () => {
    const results = await prisma.$queryRawTyped(
      getTotalSkillsetsForUser(user.id, user.id)
    )

    return getCount(results)
  })
}

/**
 * Retrieves the total number of abilities for the user.
 *
 * @param user - The user object
 * @returns Promise resolving to the count of abilities
 * @todo this is not fast enough, we need to make it faster
 */
export async function getApproximateTotalAbilities(
  user: User
): Promise<number> {
  return await ttlCache(`fast-total-abilities-${user.id}`, 60, async () => {
    const results = await prisma.$queryRawTyped(
      getTotalAbilitiesForUser(user.id, user.id)
    )

    return getCount(results)
  })
}

/**
 * Retrieves the total number of files for the user.
 *
 * @param user - The user object
 * @returns Promise resolving to the count of files
 * @todo this is not fast enough, we need to make it faster
 */
export async function getApproximateTotalFiles(user: User): Promise<number> {
  return await ttlCache(`fast-total-files-${user.id}`, 60, async () => {
    const results = await prisma.$queryRawTyped(
      getTotalFilesForUser(user.id, user.id)
    )

    return getCount(results)
  })
}

/**
 * Retrieves the total number of users for the user.
 *
 * @param user - The user object
 * @returns Promise resolving to the count of users
 * @todo this is not fast enough, we need to make it faster
 */
export async function getApproximateTotalUsers(user: User): Promise<number> {
  return await ttlCache(`fast-total-users-${user.id}`, 60, async () => {
    const results = await prisma.$queryRawTyped(
      getTotalUsersForUser(user.id)
    )

    return getCount(results)
  })
}

/**
 * Retrieves the total number of portals for the user.
 *
 * @param user - The user object
 * @returns Promise resolving to the count of portals
 * @todo this is not fast enough, we need to make it faster
 */
export async function getApproximateTotalPortals(user: User): Promise<number> {
  return await ttlCache(`fast-total-portals-${user.id}`, 60, async () => {
    const results = await prisma.$queryRawTyped(
      getTotalPortalsForUser(user.id, user.id)
    )

    return getCount(results)
  })
}

/**
 * Retrieves the total number of policies for the user.
 *
 * @param user - The user object
 * @returns Promise resolving to the count of policies
 * @todo this is not fast enough, we need to make it faster
 */
export async function getApproximateTotalPolicies(user: User): Promise<number> {
  return await ttlCache(`fast-total-policies-${user.id}`, 60, async () => {
    const results = await prisma.$queryRawTyped(
      getTotalPoliciesForUser(user.id, user.id)
    )

    return getCount(results)
  })
}

/**
 * Retrieves the total number of teams for the user.
 *
 * @param user - The user object
 * @returns Promise resolving to the count of teams
 * @todo this is not fast enough, we need to make it faster
 */
export async function getApproximateTotalTeams(user: User): Promise<number> {
  return await ttlCache(`fast-total-teams-${user.id}`, 60, async () => {
    const results = await prisma.$queryRawTyped(
      getTotalTeamsForUser(user.id, user.id)
    )

    return getCount(results)
  })
}

/**
 * Retrieves the total number of team members for the user.
 *
 * @param user - The user object
 * @returns Promise resolving to the count of team members
 * @todo this is not fast enough, we need to make it faster
 */
export async function getApproximateTotalTeamMembers(
  user: User
): Promise<number> {
  return await ttlCache(`fast-total-team-members-${user.id}`, 60, async () => {
    const results = await prisma.$queryRawTyped(
      getTotalTeamMembersForUser(user.id, user.id)
    )

    return getCount(results)
  })
}
