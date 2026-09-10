// @note the suite pins the partners apex independently of deployment data
jest.mock('@/config/apexes', () => ({
  __esModule: true,
  partnersApex: 'chatbotkit.partners',
}))

import { hostToHostname } from '@/lib/host.parse'
import {
  getPartnerByHostname,
  getPartnerByIdentifier,
  getPartnerSlugFromHostname,
  isPartnerHostname,
} from '@/lib/partner.helpers'

jest.mock('@chatbotkit-dev/partners', () => ({
  __esModule: true,
  default: {
    aperture: {
      id: 'clc4nlqei0000jv085svx6fit',
      name: 'Aperture Laboratories',
      logo: '/partners/aperture/logo.svg',
    },
    faro: {
      id: 'clqw78xid0135yh0v3mlqcygh',
      name: 'Faro',
      logo: '/partners/faro/logo.svg',
    },
    testpartner: {
      id: 'test123',
      name: 'Test Partner',
      logo: '/partners/test/logo.svg',
    },
    'backend-acme-dev': {
      id: 'cm4ts8opg1i9euawcdv8ewj70',
      name: 'QSBX',
      logo: '/partners/acme/logo.svg',
      icon: '/partners/acme/icon.png',
      domain: 'backend.acme.dev',
    },
  },
}))

describe('partner helper functions', () => {
  describe('getPartnerByIdentifier', () => {
    describe('lookup by slug', () => {
      it('should find partner by valid slug', async () => {
        const partner = await getPartnerByIdentifier('aperture')

        expect(partner).toEqual({
          id: 'clc4nlqei0000jv085svx6fit',
          name: 'Aperture Laboratories',
          logo: '/partners/aperture/logo.svg',
        })
      })

      it('should find different partner by slug', async () => {
        const partner = await getPartnerByIdentifier('faro')

        expect(partner).toEqual({
          id: 'clqw78xid0135yh0v3mlqcygh',
          name: 'Faro',
          logo: '/partners/faro/logo.svg',
        })
      })

      it('should find partner by slug with multiple entries', async () => {
        const partner = await getPartnerByIdentifier('testpartner')

        expect(partner).toEqual({
          id: 'test123',
          name: 'Test Partner',
          logo: '/partners/test/logo.svg',
        })
      })
    })

    describe('lookup by ID', () => {
      it('should find partner by valid ID', async () => {
        const partner = await getPartnerByIdentifier(
          'clc4nlqei0000jv085svx6fit'
        )

        expect(partner).toEqual({
          id: 'clc4nlqei0000jv085svx6fit',
          name: 'Aperture Laboratories',
          logo: '/partners/aperture/logo.svg',
        })
      })

      it('should find different partner by ID', async () => {
        const partner = await getPartnerByIdentifier(
          'clqw78xid0135yh0v3mlqcygh'
        )

        expect(partner).toEqual({
          id: 'clqw78xid0135yh0v3mlqcygh',
          name: 'Faro',
          logo: '/partners/faro/logo.svg',
        })
      })

      it('should find partner by short ID', async () => {
        const partner = await getPartnerByIdentifier('test123')

        expect(partner).toEqual({
          id: 'test123',
          name: 'Test Partner',
          logo: '/partners/test/logo.svg',
        })
      })
    })

    describe('not found cases', () => {
      it('should return null for non-existent slug', async () => {
        const partner = await getPartnerByIdentifier('nonexistent')

        expect(partner).toBeNull()
      })

      it('should return null for non-existent ID', async () => {
        const partner = await getPartnerByIdentifier('invalid-id-12345')

        expect(partner).toBeNull()
      })

      it('should return null for empty string', async () => {
        const partner = await getPartnerByIdentifier('')

        expect(partner).toBeNull()
      })

      it('should return null for invalid identifier format', async () => {
        const partner = await getPartnerByIdentifier('not-a-valid-partner-id')

        expect(partner).toBeNull()
      })
    })

    describe('edge cases', () => {
      it('should prioritize slug match over ID match', async () => {
        // If the identifier matches a slug key, it should return that partner
        const partner = await getPartnerByIdentifier('aperture')

        expect(partner.name).toBe('Aperture Laboratories')
      })

      it('should handle slug that matches another partner ID', async () => {
        // Test that slug lookup takes priority
        const partner = await getPartnerByIdentifier('faro')

        expect(partner.id).toBe('clqw78xid0135yh0v3mlqcygh')
        expect(partner.name).toBe('Faro')
      })

      it('should handle case-sensitive slugs', async () => {
        const partner = await getPartnerByIdentifier('Aperture')

        expect(partner).toBeNull() // slugs are case-sensitive
      })

      it('should handle case-sensitive IDs', async () => {
        const partner = await getPartnerByIdentifier(
          'CLC4NLQEI0000JV085SVX6FIT'
        )

        expect(partner).toBeNull() // IDs are case-sensitive
      })
    })
  })

  describe('getPartnerSlugFromHostname', () => {
    describe('valid partner hostnames', () => {
      it('should extract slug from partner hostname', () => {
        const slug = getPartnerSlugFromHostname('aperture.chatbotkit.partners')

        expect(slug).toBe('aperture')
      })

      it('should extract different partner slug', () => {
        const slug = getPartnerSlugFromHostname('faro.chatbotkit.partners')

        expect(slug).toBe('faro')
      })

      it('should extract slug with test partner', () => {
        const slug = getPartnerSlugFromHostname(
          'testpartner.chatbotkit.partners'
        )

        expect(slug).toBe('testpartner')
      })

      it('should only extract slug if it exists in config', () => {
        const slug = getPartnerSlugFromHostname(
          'nonexistent.chatbotkit.partners'
        )

        expect(slug).toBeNull()
      })

      it('should extract slug from custom partner domain', () => {
        const slug = getPartnerSlugFromHostname('backend.acme.dev')

        expect(slug).toBe('backend-acme-dev')
      })
    })

    describe('invalid hostnames', () => {
      it('should return null for non-partner hostname', () => {
        const slug = getPartnerSlugFromHostname('example.com')

        expect(slug).toBeNull()
      })

      it('should return null for chatbotkit.com hostname', () => {
        const slug = getPartnerSlugFromHostname('www.chatbotkit.com')

        expect(slug).toBeNull()
      })

      it('should return null for empty string', () => {
        const slug = getPartnerSlugFromHostname('')

        expect(slug).toBeNull()
      })

      it('should return null for hostname without subdomain', () => {
        const slug = getPartnerSlugFromHostname('chatbotkit.partners')

        expect(slug).toBeNull()
      })

      it('should return null for hostname with wrong TLD', () => {
        const slug = getPartnerSlugFromHostname('aperture.chatbotkit.com')

        expect(slug).toBeNull()
      })

      it('should return null for malformed hostname', () => {
        const slug = getPartnerSlugFromHostname('not-a-hostname')

        expect(slug).toBeNull()
      })
    })

    describe('edge cases', () => {
      it('should handle hostname with multiple subdomains', () => {
        const slug = getPartnerSlugFromHostname(
          'sub.aperture.chatbotkit.partners'
        )

        // Only matches single subdomain before chatbotkit.partners
        expect(slug).toBeNull()
      })

      it('should handle hostname with port', () => {
        const slug = getPartnerSlugFromHostname(
          'aperture.chatbotkit.partners:8080'
        )

        // Port should not affect matching
        expect(slug).toBeNull()
      })

      it('should handle hostname with uppercase', () => {
        const slug = getPartnerSlugFromHostname('APERTURE.chatbotkit.partners')

        // Case sensitivity check - slugs are lowercase
        expect(slug).toBeNull()
      })

      it('should validate slug exists in config', () => {
        const slug = getPartnerSlugFromHostname('invalid.chatbotkit.partners')

        expect(slug).toBeNull()
      })

      it('should handle hostname with special characters', () => {
        const slug = getPartnerSlugFromHostname(
          'test-partner.chatbotkit.partners'
        )

        expect(slug).toBeNull() // Not in config
      })
    })
  })

  describe('isPartnerHostname', () => {
    describe('valid partner hosts', () => {
      it('should return true for valid partner hostname', () => {
        expect(isPartnerHostname('aperture.chatbotkit.partners')).toBe(true)
      })

      it('should return true for different partner hostname', () => {
        expect(isPartnerHostname('faro.chatbotkit.partners')).toBe(true)
      })

      it('should return true for test partner hostname', () => {
        expect(isPartnerHostname('testpartner.chatbotkit.partners')).toBe(true)
      })

      it('should return true for custom partner domain', () => {
        expect(isPartnerHostname('backend.acme.dev')).toBe(true)
      })
    })

    describe('invalid hosts', () => {
      it('should return false for non-partner hostname', () => {
        expect(isPartnerHostname('example.com')).toBe(false)
      })

      it('should return false for chatbotkit.com', () => {
        expect(isPartnerHostname('www.chatbotkit.com')).toBe(false)
      })

      it('should return false for empty string', () => {
        expect(isPartnerHostname('')).toBe(false)
      })

      it('should return false for non-existent partner', () => {
        expect(isPartnerHostname('nonexistent.chatbotkit.partners')).toBe(false)
      })

      it('should return false for hostname with wrong TLD', () => {
        expect(isPartnerHostname('aperture.chatbotkit.com')).toBe(false)
      })

      it('should return false for malformed hostname', () => {
        expect(isPartnerHostname('not-a-hostname')).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should return false for hostname with multiple subdomains', () => {
        expect(isPartnerHostname('sub.aperture.chatbotkit.partners')).toBe(false)
      })

      it('should return false for hostname with port', () => {
        expect(isPartnerHostname('aperture.chatbotkit.partners:8080')).toBe(false)
      })

      it('should return false for uppercase hostname', () => {
        expect(isPartnerHostname('APERTURE.chatbotkit.partners')).toBe(false)
      })

      it('should throw for null-ish values', () => {
        expect(() => isPartnerHostname(null)).toThrow()
        expect(() => isPartnerHostname(undefined)).toThrow()
      })
    })

    describe('integration with getPartnerSlugFromHostname', () => {
      it('should return same result as checking slug !== null', () => {
        const hostname = 'aperture.chatbotkit.partners'
        const hasSlug = getPartnerSlugFromHostname(hostname) !== null
        const isPartner = isPartnerHostname(hostname)

        expect(isPartner).toBe(hasSlug)
      })

      it('should be consistent for invalid hostname', () => {
        const hostname = 'invalid.example.com'
        const hasSlug = getPartnerSlugFromHostname(hostname) !== null
        const isPartner = isPartnerHostname(hostname)

        expect(isPartner).toBe(hasSlug)
        expect(isPartner).toBe(false)
      })

      it('should be consistent for non-existent partner', () => {
        const hostname = 'nonexistent.chatbotkit.partners'
        const hasSlug = getPartnerSlugFromHostname(hostname) !== null
        const isPartner = isPartnerHostname(hostname)

        expect(isPartner).toBe(hasSlug)
        expect(isPartner).toBe(false)
      })
    })
  })

  describe('getPartnerByHostname', () => {
    it('should return partner for chatbotkit partner hostname', async () => {
      const partner = await getPartnerByHostname('aperture.chatbotkit.partners')

      expect(partner).toEqual({
        id: 'clc4nlqei0000jv085svx6fit',
        name: 'Aperture Laboratories',
        logo: '/partners/aperture/logo.svg',
      })
    })

    it('should return partner for custom domain hostname', async () => {
      const partner = await getPartnerByHostname('backend.acme.dev')

      expect(partner).toEqual({
        id: 'cm4ts8opg1i9euawcdv8ewj70',
        name: 'QSBX',
        logo: '/partners/acme/logo.svg',
        icon: '/partners/acme/icon.png',
        domain: 'backend.acme.dev',
      })
    })

    it('takes a hostname - callers reduce a host first', async () => {
      // @note a host is not a hostname; passed as-is nothing matches
      expect(await getPartnerByHostname('backend.acme.dev:443')).toBeNull()

      const partner = await getPartnerByHostname(
        hostToHostname('backend.acme.dev:443')
      )

      expect(partner).toEqual({
        id: 'cm4ts8opg1i9euawcdv8ewj70',
        name: 'QSBX',
        logo: '/partners/acme/logo.svg',
        icon: '/partners/acme/icon.png',
        domain: 'backend.acme.dev',
      })
    })

    it('should return null for non-partner hostname', async () => {
      const partner = await getPartnerByHostname('example.com')

      expect(partner).toBeNull()
    })
  })
})
