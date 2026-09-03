import { SecretKind, SecretVisibility } from '@/prisma/types'

import * as userRelation from '@/lib/user.relation'

import { canUseSecret } from './secret.access'

jest.mock('@/lib/user.relation', () => ({
  getRelatedUsers: jest.fn(),
}))

describe('canUseSecret', () => {
  const user = { id: 'user-1', email: 'user1@example.com' }
  const otherUser = { id: 'user-2', email: 'user2@example.com' }

  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('returns true if user is the owner of the secret', async () => {
    const secret = {
      userId: user.id,
      visibility: SecretVisibility.private,
      kind: SecretKind.personal,
    }

    await expect(canUseSecret(user, secret)).resolves.toBe(true)
  })

  it('returns true if secret is public and personal', async () => {
    const secret = {
      userId: otherUser.id,
      visibility: SecretVisibility.public,
      kind: SecretKind.personal,
    }

    await expect(canUseSecret(user, secret)).resolves.toBe(true)
  })

  it('returns false if secret is public but not personal', async () => {
    const secret = {
      userId: otherUser.id,
      visibility: SecretVisibility.public,
      kind: SecretKind.shared,
    }

    await expect(canUseSecret(user, secret)).resolves.toBe(false)
  })

  it('returns true if secret is protected, personal, and user is related', async () => {
    const secret = {
      userId: otherUser.id,
      visibility: SecretVisibility.protected,
      kind: SecretKind.personal,
    }

    userRelation.getRelatedUsers.mockResolvedValue([
      { id: otherUser.id, email: otherUser.email },
    ])

    await expect(canUseSecret(user, secret)).resolves.toBe(true)
  })

  it('returns false if secret is protected, personal, and user is not related', async () => {
    const secret = {
      userId: otherUser.id,
      visibility: SecretVisibility.protected,
      kind: SecretKind.personal,
    }

    userRelation.getRelatedUsers.mockResolvedValue([
      { id: 'user-3', email: 'user3@example.com' },
    ])

    await expect(canUseSecret(user, secret)).resolves.toBe(false)
  })

  it('returns false if secret is protected but not personal', async () => {
    const secret = {
      userId: otherUser.id,
      visibility: SecretVisibility.protected,
      kind: SecretKind.shared,
    }

    const spy = userRelation.getRelatedUsers

    await expect(canUseSecret(user, secret)).resolves.toBe(false)

    expect(spy).not.toHaveBeenCalled()
  })

  it('returns false if secret is private and not owned by user', async () => {
    const secret = {
      userId: otherUser.id,
      visibility: SecretVisibility.private,
      kind: SecretKind.personal,
    }

    await expect(canUseSecret(user, secret)).resolves.toBe(false)
  })

  it('does not leak access if getRelatedUsers throws', async () => {
    const secret = {
      userId: otherUser.id,
      visibility: SecretVisibility.protected,
      kind: SecretKind.personal,
    }

    userRelation.getRelatedUsers.mockRejectedValue(new Error('fail'))

    await expect(canUseSecret(user, secret)).resolves.toBe(false)
  })

  it('returns false for unrelated secret kinds and visibilities', async () => {
    const secret = {
      userId: otherUser.id,
      visibility: 'unknown',
      kind: 'unknown',
    }

    await expect(canUseSecret(user, secret)).resolves.toBe(false)
  })
})
