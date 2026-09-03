import { DatasetVisibility } from '@/prisma/types'

import { canUseDataset } from '@/lib/dataset.access'
import * as userRelation from '@/lib/user.relation'

jest.mock('@/lib/user.relation', () => ({
  getRelatedUsers: jest.fn(),
}))

describe('canUseDataset', () => {
  const userId = 'user-1'
  const otherUserId = 'user-2'

  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('returns true if user is the owner of the dataset', async () => {
    const dataset = {
      userId,
      visibility: DatasetVisibility.private,
    }

    await expect(canUseDataset(userId, dataset)).resolves.toBe(true)
  })

  it('returns true if dataset is public', async () => {
    const dataset = {
      userId: otherUserId,
      visibility: DatasetVisibility.public,
    }

    await expect(canUseDataset(userId, dataset)).resolves.toBe(true)
  })

  it('returns true if dataset is protected and user is related', async () => {
    const dataset = {
      userId: otherUserId,
      visibility: DatasetVisibility.protected,
    }

    userRelation.getRelatedUsers.mockResolvedValue([{ id: otherUserId }])

    await expect(canUseDataset(userId, dataset)).resolves.toBe(true)
  })

  it('returns false if dataset is protected and user is not related', async () => {
    const dataset = {
      userId: otherUserId,
      visibility: DatasetVisibility.protected,
    }

    userRelation.getRelatedUsers.mockResolvedValue([{ id: 'user-3' }])

    await expect(canUseDataset(userId, dataset)).resolves.toBe(false)
  })

  it('returns false if dataset is private and not owned by user', async () => {
    const dataset = {
      userId: otherUserId,
      visibility: DatasetVisibility.private,
    }

    await expect(canUseDataset(userId, dataset)).resolves.toBe(false)
  })

  it('returns false if getRelatedUsers throws for protected dataset', async () => {
    const dataset = {
      userId: otherUserId,
      visibility: DatasetVisibility.protected,
    }

    userRelation.getRelatedUsers.mockRejectedValue(new Error('fail'))

    await expect(canUseDataset(userId, dataset)).resolves.toBe(false)
  })

  it('returns false for unknown visibility', async () => {
    const dataset = {
      userId: otherUserId,
      visibility: 'unknown',
    }

    await expect(canUseDataset(userId, dataset)).resolves.toBe(false)
  })
})
