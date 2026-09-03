/**
 * @jest-environment node
 */

/* global BigInt */
import { mockDeep } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { ttlCache } from '@/lib/cache'
import { getStore } from '@/lib/store.types'

import {
  getApproximateTotalAbilities,
  getApproximateTotalBots,
  getApproximateTotalDatasets,
  getApproximateTotalFiles,
  getApproximateTotalPolicies,
  getApproximateTotalPortals,
  getApproximateTotalRecords,
  getApproximateTotalSkillsets,
  getApproximateTotalTeamMembers,
  getApproximateTotalTeams,
  getApproximateTotalUsers,
} from './limit.estimate'

jest.mock('@/prisma/sql', () => ({
  getTotalAbilitiesForUser: jest.fn((...args) => ({
    name: 'getTotalAbilitiesForUser',
    args,
  })),
  getTotalBotsForUser: jest.fn((...args) => ({
    name: 'getTotalBotsForUser',
    args,
  })),
  getTotalDatasetsForUser: jest.fn((...args) => ({
    name: 'getTotalDatasetsForUser',
    args,
  })),
  getTotalFilesForUser: jest.fn((...args) => ({
    name: 'getTotalFilesForUser',
    args,
  })),
  getTotalPoliciesForUser: jest.fn((...args) => ({
    name: 'getTotalPoliciesForUser',
    args,
  })),
  getTotalPortalsForUser: jest.fn((...args) => ({
    name: 'getTotalPortalsForUser',
    args,
  })),
  getTotalSkillsetsForUser: jest.fn((...args) => ({
    name: 'getTotalSkillsetsForUser',
    args,
  })),
  getTotalUsersForUser: jest.fn((...args) => ({
    name: 'getTotalUsersForUser',
    args,
  })),
  getTotalTeamMembersForUser: jest.fn((...args) => ({
    name: 'getTotalTeamMembersForUser',
    args,
  })),
  getTotalTeamsForUser: jest.fn((...args) => ({
    name: 'getTotalTeamsForUser',
    args,
  })),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/cache', () => ({
  ttlCache: jest.fn((key, ttl, fn) => fn()),
}))

jest.mock('@/lib/store.types', () => ({
  getStore: jest.fn(),
}))

describe('limit.estimate', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  }
  const mockStore = {
    countRecords: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.countRecords.mockReset()
    getStore.mockReset()
    getStore.mockResolvedValue(mockStore)
  })

  describe('getApproximateTotalBots', () => {
    it('should return count from database query', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(5) }])

      const result = await getApproximateTotalBots(mockUser)

      expect(result).toBe(5)
      expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1)
    })
  })

  describe('getApproximateTotalDatasets', () => {
    it('should return count from database query', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(5) }])

      const result = await getApproximateTotalDatasets(mockUser)

      expect(result).toBe(5)
      expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1)
    })

    it('should use ttlCache with correct parameters', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(10) }])

      await getApproximateTotalDatasets(mockUser)

      expect(ttlCache).toHaveBeenCalledWith(
        `fast-total-datasets-${mockUser.id}`,
        60,
        expect.any(Function)
      )
    })

    it('should handle zero count', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(0) }])

      const result = await getApproximateTotalDatasets(mockUser)

      expect(result).toBe(0)
    })

    it('should handle large counts', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(1000000) }])

      const result = await getApproximateTotalDatasets(mockUser)

      expect(result).toBe(1000000)
    })
  })

  describe('getApproximateTotalRecords', () => {
    it('should return count from dataset stores', async () => {
      prisma.dataset.findMany.mockResolvedValue([
        { id: 'dataset-1' },
        { id: 'dataset-2' },
      ])
      mockStore.countRecords.mockResolvedValueOnce(40).mockResolvedValueOnce(60)

      const result = await getApproximateTotalRecords(mockUser)

      expect(result).toBe(100)
      expect(prisma.dataset.findMany).toHaveBeenCalledWith({
        where: {
          user: {
            OR: [{ id: mockUser.id }, { parentId: mockUser.id }],
          },
        },
        select: {
          id: true,
        },
      })
      expect(getStore).toHaveBeenCalledTimes(2)
      expect(mockStore.countRecords).toHaveBeenCalledTimes(2)
      expect(mockStore.countRecords).toHaveBeenNthCalledWith(1, {
        datasetId: 'dataset-1',
      })
      expect(mockStore.countRecords).toHaveBeenNthCalledWith(2, {
        datasetId: 'dataset-2',
      })
      expect(prisma.$queryRawTyped).not.toHaveBeenCalled()
    })

    it('should use ttlCache with correct parameters', async () => {
      prisma.dataset.findMany.mockResolvedValue([])

      await getApproximateTotalRecords(mockUser)

      expect(ttlCache).toHaveBeenCalledWith(
        `fast-total-records-${mockUser.id}`,
        60,
        expect.any(Function)
      )
    })

    it('should handle zero records', async () => {
      prisma.dataset.findMany.mockResolvedValue([])

      const result = await getApproximateTotalRecords(mockUser)

      expect(result).toBe(0)
    })

    it('should sum counts from mixed stores', async () => {
      const otherStore = {
        countRecords: jest.fn().mockResolvedValue(17),
      }

      prisma.dataset.findMany.mockResolvedValue([
        { id: 'dataset-1' },
        { id: 'dataset-2' },
      ])
      getStore
        .mockResolvedValueOnce(mockStore)
        .mockResolvedValueOnce(otherStore)
      mockStore.countRecords.mockResolvedValueOnce(11)

      const result = await getApproximateTotalRecords(mockUser)

      expect(result).toBe(28)
      expect(prisma.$queryRawTyped).not.toHaveBeenCalled()
    })
  })

  describe('getApproximateTotalSkillsets', () => {
    it('should return count from database query', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(15) }])

      const result = await getApproximateTotalSkillsets(mockUser)

      expect(result).toBe(15)
      expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1)
    })

    it('should use ttlCache with correct parameters', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(10) }])

      await getApproximateTotalSkillsets(mockUser)

      expect(ttlCache).toHaveBeenCalledWith(
        `fast-total-skillsets-${mockUser.id}`,
        60,
        expect.any(Function)
      )
    })
  })

  describe('getApproximateTotalAbilities', () => {
    it('should return count from database query', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(25) }])

      const result = await getApproximateTotalAbilities(mockUser)

      expect(result).toBe(25)
      expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1)
    })

    it('should use ttlCache with correct parameters', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(20) }])

      await getApproximateTotalAbilities(mockUser)

      expect(ttlCache).toHaveBeenCalledWith(
        `fast-total-abilities-${mockUser.id}`,
        60,
        expect.any(Function)
      )
    })
  })

  describe('getApproximateTotalFiles', () => {
    it('should return count from database query', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(50) }])

      const result = await getApproximateTotalFiles(mockUser)

      expect(result).toBe(50)
      expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1)
    })

    it('should use ttlCache with correct parameters', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(30) }])

      await getApproximateTotalFiles(mockUser)

      expect(ttlCache).toHaveBeenCalledWith(
        `fast-total-files-${mockUser.id}`,
        60,
        expect.any(Function)
      )
    })
  })

  describe('getApproximateTotalUsers', () => {
    it('should return count from database query', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(3) }])

      const result = await getApproximateTotalUsers(mockUser)

      expect(result).toBe(3)
      expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1)
    })

    it('should use ttlCache with correct parameters', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(5) }])

      await getApproximateTotalUsers(mockUser)

      expect(ttlCache).toHaveBeenCalledWith(
        `fast-total-users-${mockUser.id}`,
        60,
        expect.any(Function)
      )
    })
  })

  describe('getApproximateTotalPortals', () => {
    it('should return count from database query', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(2) }])

      const result = await getApproximateTotalPortals(mockUser)

      expect(result).toBe(2)
      expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1)
    })

    it('should use ttlCache with correct parameters', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(4) }])

      await getApproximateTotalPortals(mockUser)

      expect(ttlCache).toHaveBeenCalledWith(
        `fast-total-portals-${mockUser.id}`,
        60,
        expect.any(Function)
      )
    })
  })

  describe('getApproximateTotalPolicies', () => {
    it('should return count from database query', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(12) }])

      const result = await getApproximateTotalPolicies(mockUser)

      expect(result).toBe(12)
      expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1)
    })

    it('should use ttlCache with correct parameters', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(10) }])

      await getApproximateTotalPolicies(mockUser)

      expect(ttlCache).toHaveBeenCalledWith(
        `fast-total-policies-${mockUser.id}`,
        60,
        expect.any(Function)
      )
    })
  })

  describe('getApproximateTotalTeams', () => {
    it('should return count from database query', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(4) }])

      const result = await getApproximateTotalTeams(mockUser)

      expect(result).toBe(4)
      expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1)
    })

    it('should use ttlCache with correct parameters', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(6) }])

      await getApproximateTotalTeams(mockUser)

      expect(ttlCache).toHaveBeenCalledWith(
        `fast-total-teams-${mockUser.id}`,
        60,
        expect.any(Function)
      )
    })
  })

  describe('getApproximateTotalTeamMembers', () => {
    it('should return count from database query', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(20) }])

      const result = await getApproximateTotalTeamMembers(mockUser)

      expect(result).toBe(20)
      expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1)
    })

    it('should use ttlCache with correct parameters', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(15) }])

      await getApproximateTotalTeamMembers(mockUser)

      expect(ttlCache).toHaveBeenCalledWith(
        `fast-total-team-members-${mockUser.id}`,
        60,
        expect.any(Function)
      )
    })
  })

  describe('edge cases', () => {
    it('should handle user with no parent', async () => {
      const userNoParent = { id: 'user-456', email: 'test2@example.com' }

      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(0) }])

      const result = await getApproximateTotalDatasets(userNoParent)

      expect(result).toBe(0)
    })

    it('should handle user with subscription', async () => {
      const userWithSubscription = {
        id: 'user-789',
        email: 'premium@example.com',
        billingSubscriptionId: 'sub_123',
        billingSubscriptionStatus: 'active',
      }

      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(100) }])

      const result = await getApproximateTotalDatasets(userWithSubscription)

      expect(result).toBe(100)
    })

    it('should convert BigInt to Number correctly', async () => {
      prisma.dataset.findMany.mockResolvedValue([
        { id: 'dataset-1' },
      ])
      mockStore.countRecords.mockResolvedValue(999999)

      const result = await getApproximateTotalRecords(mockUser)

      expect(typeof result).toBe('number')
      expect(result).toBe(999999)
    })
  })

  describe('caching behavior', () => {
    it('should pass correct cache key format for each function', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(1) }])

      await getApproximateTotalDatasets(mockUser)
      expect(ttlCache).toHaveBeenLastCalledWith(
        'fast-total-datasets-user-123',
        60,
        expect.any(Function)
      )

      await getApproximateTotalRecords(mockUser)
      expect(ttlCache).toHaveBeenLastCalledWith(
        'fast-total-records-user-123',
        60,
        expect.any(Function)
      )

      await getApproximateTotalSkillsets(mockUser)
      expect(ttlCache).toHaveBeenLastCalledWith(
        'fast-total-skillsets-user-123',
        60,
        expect.any(Function)
      )
    })

    it('should use 60 second TTL for all functions', async () => {
      prisma.$queryRawTyped.mockResolvedValue([{ count: BigInt(1) }])

      const functions = [
        getApproximateTotalDatasets,
        getApproximateTotalRecords,
        getApproximateTotalSkillsets,
        getApproximateTotalAbilities,
        getApproximateTotalFiles,
        getApproximateTotalUsers,
        getApproximateTotalPortals,
        getApproximateTotalPolicies,
        getApproximateTotalTeams,
        getApproximateTotalTeamMembers,
      ]

      for (const fn of functions) {
        jest.clearAllMocks()
        await fn(mockUser)
        expect(ttlCache).toHaveBeenCalledWith(
          expect.any(String),
          60,
          expect.any(Function)
        )
      }
    })
  })
})
