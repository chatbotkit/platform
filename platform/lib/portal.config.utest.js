import partners from '@chatbotkit-dev/partners'

import { getPortalGlobalConfig } from '@/lib/portal.config'
import { fastGetUserById } from '@/lib/user.get'

jest.mock('@chatbotkit-dev/partners', () => ({
  __esModule: true,
  default: {
    acme: {
      id: 'partner-account',
      name: 'Acme',
      portals: {
        '*-acme': {
          domain: 'portals.acme.test',
          name: 'Acme Portal',
        },
      },
    },
    // @note the id is deliberately not a suffix of the other partner's -
    // membership matches by id suffix, and the catalogue assert enforces this
    umbrella: {
      id: 'umbrella-corp',
      name: 'Umbrella',
      portals: {
        '*-umbrella': {
          domain: 'portals.umbrella.test',
        },
      },
    },
  },
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

describe('getPortalGlobalConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns partner portal configuration for the partner account', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'partner-account',
      parentId: null,
    })

    await expect(
      getPortalGlobalConfig({
        slug: 'customer-acme',
        userId: 'partner-account',
      })
    ).resolves.toEqual(partners.acme.portals['*-acme'])
  })

  it('returns partner portal configuration for a child account', async () => {
    fastGetUserById.mockImplementation(async (userId) => {
      if (userId === 'child-account') {
        return { id: 'child-account', parentId: 'partner-account' }
      }

      if (userId === 'partner-account') {
        return { id: 'partner-account', parentId: null }
      }

      return null
    })

    await expect(
      getPortalGlobalConfig({
        slug: 'customer-acme',
        userId: 'child-account',
      })
    ).resolves.toEqual(partners.acme.portals['*-acme'])
  })

  it('does not apply a partner mapping to an unrelated account', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'ordinary-account',
      parentId: null,
    })

    await expect(
      getPortalGlobalConfig({
        slug: 'customer-acme',
        userId: 'ordinary-account',
      })
    ).resolves.toBeNull()
  })

  it('does not apply another partner mapping to a partner account', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'partner-account',
      parentId: null,
    })

    await expect(
      getPortalGlobalConfig({
        slug: 'customer-other',
        userId: 'partner-account',
      })
    ).resolves.toBeNull()
  })

  it('does not let one partner claim a slug registered to another', async () => {
    // @note umbrella owns the portal, but the slug matches acme's pattern -
    // the mapping must only resolve through the owning partner's own patterns

    fastGetUserById.mockResolvedValue({
      id: 'umbrella-corp',
      parentId: null,
    })

    await expect(
      getPortalGlobalConfig({
        slug: 'customer-acme',
        userId: 'umbrella-corp',
      })
    ).resolves.toBeNull()
  })

  it('resolves each partner mapping for its own portals only', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'umbrella-corp',
      parentId: null,
    })

    await expect(
      getPortalGlobalConfig({
        slug: 'customer-umbrella',
        userId: 'umbrella-corp',
      })
    ).resolves.toEqual(partners.umbrella.portals['*-umbrella'])
  })

  it('anchors wildcard patterns to the whole slug', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'partner-account',
      parentId: null,
    })

    // @note a slug that merely contains the pattern must not match - the
    // mapping would otherwise leak onto lookalike slugs

    await expect(
      getPortalGlobalConfig({
        slug: 'customer-acme-evil',
        userId: 'partner-account',
      })
    ).resolves.toBeNull()
  })

  it('returns null when the owner cannot be resolved', async () => {
    fastGetUserById.mockResolvedValue(null)

    await expect(
      getPortalGlobalConfig({
        slug: 'customer-acme',
        userId: 'ghost-account',
      })
    ).resolves.toBeNull()
  })

  it('returns partner portal configuration for a grandchild account', async () => {
    fastGetUserById.mockImplementation(async (userId) => {
      if (userId === 'grandchild-account') {
        return { id: 'grandchild-account', parentId: 'child-account' }
      }

      if (userId === 'child-account') {
        return { id: 'child-account', parentId: 'partner-account' }
      }

      if (userId === 'partner-account') {
        return { id: 'partner-account', parentId: null }
      }

      return null
    })

    await expect(
      getPortalGlobalConfig({
        slug: 'customer-acme',
        userId: 'grandchild-account',
      })
    ).resolves.toEqual(partners.acme.portals['*-acme'])
  })
})
