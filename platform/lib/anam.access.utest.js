import { Visibility } from '@/prisma/enums'

import * as userRelation from '@/lib/user.relation'

import {
  canManipulateAnamIntegration,
  canUseAnamIntegration,
} from './anam.access'

jest.mock('@/lib/user.relation', () => ({
  getRelatedUsers: jest.fn(),
}))

const captureException = jest.fn()

jest.mock('@/lib/error', () => ({
  captureException: (...args) => captureException(...args),
}))

describe('canUseAnamIntegration', () => {
  const userId = 'user-1'
  const otherUserId = 'user-2'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns false if userId is null', async () => {
    const integration = { userId: otherUserId, visibility: Visibility.public }

    await expect(canUseAnamIntegration(null, integration)).resolves.toBe(false)
  })

  it('returns false if userId is undefined', async () => {
    const integration = { userId: otherUserId, visibility: Visibility.public }

    await expect(canUseAnamIntegration(undefined, integration)).resolves.toBe(
      false
    )
  })

  it('returns true if user is the owner', async () => {
    const integration = { userId, visibility: Visibility.private }

    await expect(canUseAnamIntegration(userId, integration)).resolves.toBe(true)
  })

  it('returns true if integration is public', async () => {
    const integration = { userId: otherUserId, visibility: Visibility.public }

    await expect(canUseAnamIntegration(userId, integration)).resolves.toBe(true)
  })

  it('returns true if integration is protected and user is related', async () => {
    const integration = {
      userId: otherUserId,
      visibility: Visibility.protected,
    }

    userRelation.getRelatedUsers.mockResolvedValue([{ id: otherUserId }])

    await expect(canUseAnamIntegration(userId, integration)).resolves.toBe(true)
  })

  it('returns false if integration is protected and user is not related', async () => {
    const integration = {
      userId: otherUserId,
      visibility: Visibility.protected,
    }

    userRelation.getRelatedUsers.mockResolvedValue([{ id: 'user-3' }])

    await expect(canUseAnamIntegration(userId, integration)).resolves.toBe(
      false
    )
  })

  it('returns false if integration is private and not owned by user', async () => {
    const integration = { userId: otherUserId, visibility: Visibility.private }

    await expect(canUseAnamIntegration(userId, integration)).resolves.toBe(
      false
    )
  })

  it('returns false and captures exception if getRelatedUsers throws for protected integration', async () => {
    const integration = {
      userId: otherUserId,
      visibility: Visibility.protected,
    }

    userRelation.getRelatedUsers.mockRejectedValue(new Error('network failure'))

    await expect(canUseAnamIntegration(userId, integration)).resolves.toBe(
      false
    )

    expect(captureException).toHaveBeenCalled()
  })

  it('returns false for unknown visibility', async () => {
    const integration = { userId: otherUserId, visibility: 'unknown' }

    await expect(canUseAnamIntegration(userId, integration)).resolves.toBe(
      false
    )
  })

  it('does not call getRelatedUsers when user is the owner', async () => {
    const integration = { userId, visibility: Visibility.protected }

    await canUseAnamIntegration(userId, integration)

    expect(userRelation.getRelatedUsers).not.toHaveBeenCalled()
  })
})

describe('canManipulateAnamIntegration', () => {
  const userId = 'user-1'
  const otherUserId = 'user-2'

  it('returns true if user is the owner', async () => {
    const integration = { userId }

    await expect(
      canManipulateAnamIntegration(userId, integration)
    ).resolves.toBe(true)
  })

  it('returns false if user is not the owner', async () => {
    const integration = { userId: otherUserId }

    await expect(
      canManipulateAnamIntegration(userId, integration)
    ).resolves.toBe(false)
  })

  it('returns false if userId is null', async () => {
    const integration = { userId: otherUserId }

    await expect(canManipulateAnamIntegration(null, integration)).resolves.toBe(
      false
    )
  })

  it('returns false if userId is undefined', async () => {
    const integration = { userId: otherUserId }

    await expect(
      canManipulateAnamIntegration(undefined, integration)
    ).resolves.toBe(false)
  })
})
