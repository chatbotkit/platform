// @note the suite pins the portal apex independently of deployment data
jest.mock('@/config/apexes', () => ({
  __esModule: true,
  portalApex: 'chatbotkit.agency',
}))

import { getPortalFrontendHost } from '@/lib/portal.slug'

// @note partner ownership is covered by portal.config.utest.js; this
// suite pins only the conversion from a partner portal domain to a hostname
jest.mock('@/lib/portal.config', () => ({
  getPortalGlobalConfig: jest.fn((portal) =>
    portal.slug.endsWith('-acme-dev') && portal.slug !== '-acme-dev'
      ? { domain: 'acme.dev' }
      : null
  ),
}))

jest.mock('@/lib/url', () => ({
  tryDomain: jest.fn((url) => {
    try {
      const urlObj = new URL(url)

      return urlObj.hostname
    } catch {
      return null
    }
  }),
}))

describe('Portal Slug Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getPortalFrontendHost', () => {
    describe('QSBX.ai custom domain pattern', () => {
      it('should convert slug ending with -acme-dev to subdomain', async () => {
        const portal = {
          id: 'portal-123',
          slug: 'customer-acme-dev',
        }

        const host = await getPortalFrontendHost(portal)

        expect(host).toBe('customer.acme.dev')
      })

      it('should handle multiple hyphens in prefix', async () => {
        const portal = {
          id: 'portal-123',
          slug: 'my-company-name-acme-dev',
        }

        const host = await getPortalFrontendHost(portal)

        expect(host).toBe('my-company-name.acme.dev')
      })

      it('should handle single word prefix', async () => {
        const portal = {
          id: 'portal-123',
          slug: 'acme-acme-dev',
        }

        const host = await getPortalFrontendHost(portal)

        expect(host).toBe('acme.acme.dev')
      })

      it('should handle numeric prefix', async () => {
        const portal = {
          id: 'portal-123',
          slug: '123-acme-dev',
        }

        const host = await getPortalFrontendHost(portal)

        expect(host).toBe('123.acme.dev')
      })
    })

    describe('default ChatBotKit agency domain', () => {
      it('should use chatbotkit.agency domain for regular slugs', async () => {
        const portal = {
          id: 'portal-123',
          slug: 'my-portal',
        }

        const host = await getPortalFrontendHost(portal)

        expect(host).toBe('my-portal.chatbotkit.agency')
      })

      it('should handle slug with multiple hyphens', async () => {
        const portal = {
          id: 'portal-123',
          slug: 'my-awesome-portal',
        }

        const host = await getPortalFrontendHost(portal)

        expect(host).toBe('my-awesome-portal.chatbotkit.agency')
      })

      it('should handle single word slug', async () => {
        const portal = {
          id: 'portal-123',
          slug: 'portal',
        }

        const host = await getPortalFrontendHost(portal)

        expect(host).toBe('portal.chatbotkit.agency')
      })

      it('should handle slug with numbers', async () => {
        const portal = {
          id: 'portal-123',
          slug: 'portal123',
        }

        const host = await getPortalFrontendHost(portal)

        expect(host).toBe('portal123.chatbotkit.agency')
      })

      it('should not confuse partial acme-dev match', async () => {
        const portal = {
          id: 'portal-123',
          slug: 'my-acme',
        }

        const host = await getPortalFrontendHost(portal)

        // Should use default pattern, not acme.dev pattern
        expect(host).toBe('my-acme.chatbotkit.agency')
      })

      it('should not confuse acme-dev in middle of slug', async () => {
        const portal = {
          id: 'portal-123',
          slug: 'test-acme-dev-demo',
        }

        const host = await getPortalFrontendHost(portal)

        // Should use default pattern because -acme-dev is not at the end
        expect(host).toBe('test-acme-dev-demo.chatbotkit.agency')
      })
    })

    describe('edge cases', () => {
      it('should handle empty prefix in acme-dev slug', async () => {
        const portal = {
          id: 'portal-123',
          slug: '-acme-dev',
        }

        const host = await getPortalFrontendHost(portal)

        // @note the `*` in the config pattern requires a non-empty prefix,
        // so a bare suffix slug falls through to the default portal apex
        expect(host).toBe('-acme-dev.chatbotkit.agency')
      })

      it('should handle portal with minimal properties', async () => {
        const portal = {
          slug: 'minimal',
        }

        const host = await getPortalFrontendHost(portal)

        expect(host).toBe('minimal.chatbotkit.agency')
      })

      it('should handle very long slugs', async () => {
        const portal = {
          id: 'portal-123',
          slug: 'very-long-portal-slug-with-many-words-and-hyphens',
        }

        const host = await getPortalFrontendHost(portal)

        expect(host).toBe(
          'very-long-portal-slug-with-many-words-and-hyphens.chatbotkit.agency'
        )
      })

      it('should handle slug with special characters that are valid in domain', async () => {
        const portal = {
          id: 'portal-123',
          slug: 'my-portal_123',
        }

        const host = await getPortalFrontendHost(portal)

        expect(host).toBe('my-portal_123.chatbotkit.agency')
      })
    })
  })
})
