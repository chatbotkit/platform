/* eslint-disable @typescript-eslint/no-require-imports */
import {
  getPortalSlug,
  getPortalSlugFromHostname,
  getPortalURL,
  isPortalHostname,
} from './portal.hostname'

// @note the suite pins the portal apex independently of deployment data
jest.mock('@/config/apexes', () => ({
  __esModule: true,
  portalApex: 'chatbotkit.agency',
}))

jest.mock('@/lib/context.store', () => ({
  getContextFrontendHost: jest.fn(),
  getContextRequestHost: jest.fn(),
}))

describe('portal.hostname', () => {
  let getContextFrontendHost, getContextRequestHost

  beforeEach(() => {
    jest.clearAllMocks()
    getContextFrontendHost =
      require('@/lib/context.store').getContextFrontendHost
    getContextRequestHost = require('@/lib/context.store').getContextRequestHost
    getContextFrontendHost.mockReturnValue(null)
    getContextRequestHost.mockReturnValue(null)
  })

  describe('isPortalHostname', () => {
    describe('valid portal hostnames', () => {
      it('should return true for portal hostnames', () => {
        expect(isPortalHostname('example.chatbotkit.agency')).toBe(true)
      })

      it('should return true for subdomains of portal', () => {
        expect(isPortalHostname('my-portal.chatbotkit.agency')).toBe(true)
      })

      it('should return true for multi-part slugs', () => {
        expect(isPortalHostname('my-company-portal.chatbotkit.agency')).toBe(
          true
        )
      })

      it('should return true for single character slugs', () => {
        expect(isPortalHostname('a.chatbotkit.agency')).toBe(true)
      })
    })

    describe('invalid portal hostnames', () => {
      it('should return false for non-portal domains', () => {
        expect(isPortalHostname('example.com')).toBe(false)
      })

      it('should return false for chatbotkit.com', () => {
        expect(isPortalHostname('chatbotkit.com')).toBe(false)
      })

      it('should return false for similar but incorrect domains', () => {
        expect(isPortalHostname('chatbotkit.agency.com')).toBe(false)
      })

      it('should return false for just the portal domain', () => {
        expect(isPortalHostname('chatbotkit.agency')).toBe(false)
      })

      it('should return false for empty string', () => {
        expect(isPortalHostname('')).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should handle hostnames with uppercase letters', () => {
        expect(isPortalHostname('Example.chatbotkit.agency')).toBe(true)
      })

      it('should handle hostnames with numbers', () => {
        expect(isPortalHostname('portal123.chatbotkit.agency')).toBe(true)
      })

      it('should handle hostnames with hyphens', () => {
        expect(isPortalHostname('my-portal-123.chatbotkit.agency')).toBe(true)
      })
    })
  })

  describe('getPortalSlugFromHostname', () => {
    describe('valid portal hostnames', () => {
      it('should extract slug from portal hostname', () => {
        expect(getPortalSlugFromHostname('example.chatbotkit.agency')).toBe(
          'example'
        )
      })

      it('should extract multi-part slugs', () => {
        expect(
          getPortalSlugFromHostname('my-company-portal.chatbotkit.agency')
        ).toBe('my-company-portal')
      })

      it('should extract single character slugs', () => {
        expect(getPortalSlugFromHostname('a.chatbotkit.agency')).toBe('a')
      })

      it('should extract slugs with numbers', () => {
        expect(getPortalSlugFromHostname('portal123.chatbotkit.agency')).toBe(
          'portal123'
        )
      })

      it('should extract slugs with hyphens', () => {
        expect(
          getPortalSlugFromHostname('my-portal-123.chatbotkit.agency')
        ).toBe('my-portal-123')
      })
    })

    describe('invalid portal hostnames', () => {
      it('should return null for non-portal domains', () => {
        expect(getPortalSlugFromHostname('example.com')).toBe(null)
      })

      it('should return null for chatbotkit.com', () => {
        expect(getPortalSlugFromHostname('chatbotkit.com')).toBe(null)
      })

      it('should return null for just the portal domain', () => {
        expect(getPortalSlugFromHostname('chatbotkit.agency')).toBe(null)
      })

      it('should return null for empty string', () => {
        expect(getPortalSlugFromHostname('')).toBe(null)
      })

      it('should return null for similar but incorrect domains', () => {
        expect(getPortalSlugFromHostname('chatbotkit.agency.com')).toBe(null)
      })
    })

    describe('edge cases', () => {
      it('should handle hostnames with uppercase letters', () => {
        expect(getPortalSlugFromHostname('Example.chatbotkit.agency')).toBe(
          'Example'
        )
      })

      it('should return null for hostname without slug', () => {
        expect(getPortalSlugFromHostname('.chatbotkit.agency')).toBe(null)
      })

      // @todo fix bug - hostnames with paths/query params should extract only slug
      it('should handle hostnames with query parameters', () => {
        const result = getPortalSlugFromHostname(
          'widgets-glimps-group.chatbotkit.agency?message=test'
        )

        // Current buggy behavior: returns full string with query params
        // Expected: should return 'widgets-glimps-group'
        expect(result).not.toContain('?')
        expect(result).toBe('widgets-glimps-group')
      })

      it('should handle hostnames with paths', () => {
        const result = getPortalSlugFromHostname(
          'widgets-glimps-group.chatbotkit.agency/api/auth/session'
        )

        // Current buggy behavior: returns full string with path
        // Expected: should return 'widgets-glimps-group'
        expect(result).not.toContain('/')
        expect(result).toBe('widgets-glimps-group')
      })
    })

    describe('integration between functions', () => {
      it('should return null for all hostnames where isPortalHostname returns false', () => {
        const invalidHostnames = [
          'example.com',
          'chatbotkit.com',
          'chatbotkit.agency',
          '',
          'chatbotkit.agency.com',
        ]

        invalidHostnames.forEach((hostname) => {
          expect(isPortalHostname(hostname)).toBe(false)
          expect(getPortalSlugFromHostname(hostname)).toBe(null)
        })
      })

      it('should return a slug for all hostnames where isPortalHostname returns true', () => {
        const validHostnames = [
          'example.chatbotkit.agency',
          'my-portal.chatbotkit.agency',
          'a.chatbotkit.agency',
        ]

        validHostnames.forEach((hostname) => {
          expect(isPortalHostname(hostname)).toBe(true)
          expect(getPortalSlugFromHostname(hostname)).not.toBe(null)
        })
      })
    })
  })

  describe('getPortalSlug', () => {
    it('should extract slug from request hostname', () => {
      getContextRequestHost.mockReturnValue('myportal.chatbotkit.agency')

      expect(getPortalSlug()).toBe('myportal')
      expect(getContextRequestHost).toHaveBeenCalled()
    })

    it('should return null when no hostname', () => {
      getContextRequestHost.mockReturnValue(null)

      expect(getPortalSlug()).toBeNull()
    })

    it('should return null for non-portal hostname', () => {
      getContextRequestHost.mockReturnValue('example.com')

      expect(getPortalSlug()).toBeNull()
    })

    it('should handle valid portal hostname', () => {
      getContextRequestHost.mockReturnValue('test.chatbotkit.agency')

      expect(getPortalSlug()).toBe('test')
    })
  })

  describe('getPortalURL', () => {
    it('should construct URL from request hostname with path', () => {
      getContextRequestHost.mockReturnValue('myportal.chatbotkit.agency')

      const url = getPortalURL('/some/path')

      expect(url).toBeInstanceOf(URL)
      expect(url.href).toBe('https://myportal.chatbotkit.agency/some/path')
    })

    it('should construct URL from request hostname without path', () => {
      getContextRequestHost.mockReturnValue('test.chatbotkit.agency')

      const url = getPortalURL()

      expect(url).toBeInstanceOf(URL)
      expect(url.href).toBe('https://test.chatbotkit.agency/')
    })

    it('should prefer frontend hostname over request hostname', () => {
      getContextFrontendHost.mockReturnValue('frontend.chatbotkit.agency')
      getContextRequestHost.mockReturnValue('backend.chatbotkit.agency')

      const url = getPortalURL('/path')

      expect(url.href).toBe('https://frontend.chatbotkit.agency/path')
    })

    it('should return null when no hostname', () => {
      getContextRequestHost.mockReturnValue(null)

      expect(getPortalURL()).toBeNull()
    })

    it('should handle paths with query strings', () => {
      getContextRequestHost.mockReturnValue('portal.chatbotkit.agency')

      const url = getPortalURL('/path?query=value')

      expect(url.href).toBe('https://portal.chatbotkit.agency/path?query=value')
    })

    it('should handle empty path parameter', () => {
      getContextRequestHost.mockReturnValue('portal.chatbotkit.agency')

      const url = getPortalURL('')

      expect(url.href).toBe('https://portal.chatbotkit.agency/')
    })
  })
})
