import { SkillsetVisibility } from '@/prisma/types'

import { captureException } from '@/lib/error'
import * as userRelation from '@/lib/user.relation'

import { canUseSkillset } from './skillset.access'

jest.mock('@/lib/user.relation', () => ({
  getRelatedUsers: jest.fn(),
}))
jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

describe('canUseSkillset', () => {
  const userId = 'user-1'
  const otherUserId = 'user-2'

  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('returns true if user is the owner of the skillset', async () => {
    const skillset = {
      userId,
      visibility: SkillsetVisibility.private,
    }

    await expect(canUseSkillset(userId, skillset)).resolves.toBe(true)
  })

  it('returns true if skillset is public', async () => {
    const skillset = {
      userId: otherUserId,
      visibility: SkillsetVisibility.public,
    }

    await expect(canUseSkillset(userId, skillset)).resolves.toBe(true)
  })

  it('returns true if skillset is protected and user is related', async () => {
    const skillset = {
      userId: otherUserId,
      visibility: SkillsetVisibility.protected,
    }

    userRelation.getRelatedUsers.mockResolvedValue([{ id: otherUserId }])

    await expect(canUseSkillset(userId, skillset)).resolves.toBe(true)
  })

  it('returns false if skillset is protected and user is not related', async () => {
    const skillset = {
      userId: otherUserId,
      visibility: SkillsetVisibility.protected,
    }

    userRelation.getRelatedUsers.mockResolvedValue([{ id: 'user-3' }])

    await expect(canUseSkillset(userId, skillset)).resolves.toBe(false)
  })

  it('returns false if skillset is private and not owned by user', async () => {
    const skillset = {
      userId: otherUserId,
      visibility: SkillsetVisibility.private,
    }

    await expect(canUseSkillset(userId, skillset)).resolves.toBe(false)
  })

  it('returns false if getRelatedUsers throws for protected skillset', async () => {
    const skillset = {
      userId: otherUserId,
      visibility: SkillsetVisibility.protected,
    }

    userRelation.getRelatedUsers.mockRejectedValue(new Error('fail'))

    await expect(canUseSkillset(userId, skillset)).resolves.toBe(false)

    expect(captureException).toHaveBeenCalled()
  })

  it('returns false for unknown visibility', async () => {
    const skillset = {
      userId: otherUserId,
      visibility: 'unknown',
    }

    await expect(canUseSkillset(userId, skillset)).resolves.toBe(false)
  })
})
