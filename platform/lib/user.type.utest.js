/* eslint-disable @typescript-eslint/no-require-imports */
import {
  getEffectivePartner,
  isChildUser,
  isEffectivePartnerAccount,
  isEffectiveWhitelabelAccount,
  isVip,
} from '@/lib/user.type'

jest.mock('@chatbotkit-dev/partners', () => ({
  __esModule: true,
  default: {
    standard: {
      id: 'test-standard-partner',
      whitelabel: false,
    },
    whitelabel: {
      id: 'test-whitelabel-partner',
      whitelabel: true,
    },
  },
}))

describe('isChildUser', () => {
  it('identifies a child user from its parent relationship', () => {
    expect(isChildUser({ parentId: 'parent_123' })).toBe(true)
    expect(isChildUser({ parentId: null })).toBe(false)
    expect(isChildUser({})).toBe(false)
    expect(isChildUser(null)).toBe(false)
  })

  it('does not infer account hierarchy from an email address', () => {
    expect(
      isChildUser({ email: 'child@parent.user.chatbotkit.partners' })
    ).toBe(false)
  })
})

// @note VIP flags live in OVERRIDES_CONFIG, which the test environment does
// not carry, so the suite brings its own entries
jest.mock('@/config/limits', () => ({
  ...jest.requireActual('@/config/limits'),

  overrides: {
    'test-vip-one': { vip: true },
    'test-vip-two': { vip: true },
    'test-vip-three': { vip: true },
  },
}))

describe('isVip', () => {
  describe('basic functionality', () => {
    it('should return true for VIP user IDs', () => {
      const vipUsers = [
        { id: 'test-vip-one' },
        { id: 'test-vip-two' },
        { id: 'test-vip-three' },
      ]

      vipUsers.forEach((user) => {
        expect(isVip(user)).toBe(true)
      })
    })

    it('should return false for non-VIP user IDs', () => {
      const regularUsers = [
        { id: 'user123' },
        { id: 'test-vip-four' },
        { id: 'random-user-id' },
        { id: '' },
      ]

      regularUsers.forEach((user) => {
        expect(isVip(user)).toBe(false)
      })
    })
  })

  describe('edge cases', () => {
    it('should handle null user ID', () => {
      const user = { id: null }

      expect(isVip(user)).toBe(false)
    })

    it('should handle undefined user ID', () => {
      const user = { id: undefined }

      expect(isVip(user)).toBe(false)
    })

    it('should handle empty string user ID', () => {
      const user = { id: '' }

      expect(isVip(user)).toBe(false)
    })

    it('should handle partial match of VIP ID', () => {
      const user = { id: 'test-vip' }

      expect(isVip(user)).toBe(false)
    })

    it('should be case-sensitive', () => {
      const user = { id: 'TEST-VIP-ONE' }

      expect(isVip(user)).toBe(false)
    })
  })
})

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

describe('isEffectivePartnerAccount', () => {
  let fastGetUserById

  beforeEach(() => {
    jest.clearAllMocks()

    fastGetUserById = require('@/lib/user.get').fastGetUserById
  })

  describe('user without parentId', () => {
    it('should return true when user id matches a partner', async () => {
      const user = { id: 'account-test-standard-partner' }

      await expect(isEffectivePartnerAccount(user)).resolves.toBe(true)
    })

    it('should return false when user id does not match any partner', async () => {
      const user = { id: 'random-user-id' }

      await expect(isEffectivePartnerAccount(user)).resolves.toBe(false)
    })

    it('should not call fastGetUserById when parentId is absent', async () => {
      const user = { id: 'random-user-id' }

      await isEffectivePartnerAccount(user)

      expect(fastGetUserById).not.toHaveBeenCalled()
    })

    it('should not call fastGetUserById when parentId is null', async () => {
      const user = { id: 'random-user-id', parentId: null }

      await isEffectivePartnerAccount(user)

      expect(fastGetUserById).not.toHaveBeenCalled()
    })
  })

  describe('user with parentId', () => {
    it('should return true when parent id matches a partner', async () => {
      const user = { id: 'child-id', parentId: 'parent-123' }
      const parent = { id: 'account-test-standard-partner' }

      fastGetUserById.mockResolvedValue(parent)

      await expect(isEffectivePartnerAccount(user)).resolves.toBe(true)

      expect(fastGetUserById).toHaveBeenCalledWith('parent-123')
    })

    it('should return false when parent id does not match any partner', async () => {
      const user = { id: 'child-id', parentId: 'parent-123' }
      const parent = { id: 'regular-parent-id' }

      fastGetUserById.mockResolvedValue(parent)

      await expect(isEffectivePartnerAccount(user)).resolves.toBe(false)
    })

    it('should fall back to the user when no ancestor matches', async () => {
      // user id matches a partner and the parent does not - the catalogue
      // naming the account directly wins over a non-partner parent
      const user = {
        id: 'account-test-standard-partner',
        parentId: 'parent-123',
      }
      const parent = { id: 'regular-parent-id' }

      fastGetUserById.mockResolvedValue(parent)

      await expect(isEffectivePartnerAccount(user)).resolves.toBe(true)
    })

    it('should fall back to user when parent is not found', async () => {
      const user = {
        id: 'account-test-standard-partner',
        parentId: 'parent-123',
      }

      fastGetUserById.mockResolvedValue(null)

      await expect(isEffectivePartnerAccount(user)).resolves.toBe(true)
    })

    it('should fall back to user when parent is not found and user is not a partner', async () => {
      const user = { id: 'random-user-id', parentId: 'parent-123' }

      fastGetUserById.mockResolvedValue(null)

      await expect(isEffectivePartnerAccount(user)).resolves.toBe(false)
    })
  })
})

describe('getEffectivePartner', () => {
  let fastGetUserById

  beforeEach(() => {
    jest.clearAllMocks()

    fastGetUserById = require('@/lib/user.get').fastGetUserById
  })

  it('should resolve the partner for a partner account', async () => {
    const partner = await getEffectivePartner({
      id: 'account-test-whitelabel-partner',
    })

    expect(partner?.whitelabel).toBe(true)
  })

  it('should resolve the partner via the parent user', async () => {
    fastGetUserById.mockResolvedValue({ id: 'test-whitelabel-partner' })

    const partner = await getEffectivePartner({
      id: 'child-id',
      parentId: 'parent-123',
    })

    expect(partner?.whitelabel).toBe(true)
    expect(fastGetUserById).toHaveBeenCalledWith('parent-123')
  })

  it('should fall back to the user when no ancestor matches', async () => {
    fastGetUserById.mockResolvedValue({ id: 'regular-parent-id' })

    const partner = await getEffectivePartner({
      id: 'account-test-whitelabel-partner',
      parentId: 'parent-123',
    })

    expect(partner?.whitelabel).toBe(true)
  })

  it('should resolve the partner via a grandparent', async () => {
    fastGetUserById
      .mockResolvedValueOnce({ id: 'regular-parent-id', parentId: 'gp-123' })
      .mockResolvedValueOnce({ id: 'test-whitelabel-partner' })

    const partner = await getEffectivePartner({
      id: 'grandchild-id',
      parentId: 'parent-123',
    })

    expect(partner?.whitelabel).toBe(true)
    expect(fastGetUserById).toHaveBeenNthCalledWith(1, 'parent-123')
    expect(fastGetUserById).toHaveBeenNthCalledWith(2, 'gp-123')
  })

  it('should prefer the nearest matching ancestor over the user', async () => {
    fastGetUserById.mockResolvedValue({ id: 'test-standard-partner' })

    const partner = await getEffectivePartner({
      id: 'account-test-whitelabel-partner',
      parentId: 'parent-123',
    })

    expect(partner?.whitelabel).toBe(false)
  })

  it('should terminate on a parent chain cycle', async () => {
    fastGetUserById
      .mockResolvedValueOnce({ id: 'a', parentId: 'b' })
      .mockResolvedValueOnce({ id: 'b', parentId: 'a' })

    await expect(
      getEffectivePartner({ id: 'user-id', parentId: 'a' })
    ).resolves.toBe(null)

    expect(fastGetUserById).toHaveBeenCalledTimes(2)
  })

  it('should return null for an unaffiliated user', async () => {
    await expect(getEffectivePartner({ id: 'random-user-id' })).resolves.toBe(
      null
    )
  })
})

describe('isEffectiveWhitelabelAccount', () => {
  let fastGetUserById

  beforeEach(() => {
    jest.clearAllMocks()

    fastGetUserById = require('@/lib/user.get').fastGetUserById
  })

  it('should return true for a whitelabel partner account', async () => {
    await expect(
      isEffectiveWhitelabelAccount({ id: 'account-test-whitelabel-partner' })
    ).resolves.toBe(true)
  })

  it('should return true for a whitelabel user', async () => {
    fastGetUserById.mockResolvedValue({ id: 'test-whitelabel-partner' })

    await expect(
      isEffectiveWhitelabelAccount({ id: 'child', parentId: 'parent-123' })
    ).resolves.toBe(true)
  })

  it('should return false for a non-whitelabel partner account', async () => {
    await expect(
      isEffectiveWhitelabelAccount({ id: 'account-test-standard-partner' })
    ).resolves.toBe(false)
  })

  it('should return false for an unaffiliated user', async () => {
    await expect(
      isEffectiveWhitelabelAccount({ id: 'random-user-id' })
    ).resolves.toBe(false)
  })

  it('should fall back to the user when the parent is not a partner', async () => {
    fastGetUserById.mockResolvedValue({ id: 'another-random-id' })

    await expect(
      isEffectiveWhitelabelAccount({ id: 'child', parentId: 'parent-123' })
    ).resolves.toBe(false)
  })
})
