import { getSigninRedirect, getSigninURL } from '@/lib/auth.signin'

describe('auth.signin', () => {
  describe('getSigninURL', () => {
    it('should return default signin URL when no callbackUrl', () => {
      const context = {
        query: {},
      }

      const result = getSigninURL(context)

      expect(result).toBe('/signin?callbackUrl=/')
    })

    it('should return signin URL with provided callbackUrl path', () => {
      const context = {
        query: {
          callbackUrl: '/dashboard',
        },
      }

      const result = getSigninURL(context)

      expect(result).toBe('/signin?callbackUrl=/dashboard')
    })

    it('should preserve query parameters in callbackUrl', () => {
      const context = {
        query: {
          callbackUrl: '/dashboard?tab=settings',
        },
      }

      const result = getSigninURL(context)

      expect(result).toBe('/signin?callbackUrl=/dashboard?tab=settings')
    })

    it('should handle callbackUrl with multiple query parameters', () => {
      const context = {
        query: {
          callbackUrl: '/page?param1=value1&param2=value2',
        },
      }

      const result = getSigninURL(context)

      expect(result).toBe(
        '/signin?callbackUrl=/page?param1=value1&param2=value2'
      )
    })

    it('should extract pathname from absolute URL callbackUrl', () => {
      const context = {
        query: {
          callbackUrl: 'https://example.com/dashboard',
        },
      }

      const result = getSigninURL(context)

      expect(result).toBe('/signin?callbackUrl=/dashboard')
    })

    it('should handle absolute URL with query parameters', () => {
      const context = {
        query: {
          callbackUrl: 'https://example.com/page?key=value',
        },
      }

      const result = getSigninURL(context)

      expect(result).toBe('/signin?callbackUrl=/page?key=value')
    })

    it('should handle empty string callbackUrl', () => {
      const context = {
        query: {
          callbackUrl: '',
        },
      }

      const result = getSigninURL(context)

      expect(result).toBe('/signin?callbackUrl=/')
    })

    it('should handle root path callbackUrl', () => {
      const context = {
        query: {
          callbackUrl: '/',
        },
      }

      const result = getSigninURL(context)

      expect(result).toBe('/signin?callbackUrl=/')
    })

    it('should handle callbackUrl with hash fragment', () => {
      const context = {
        query: {
          callbackUrl: '/page#section',
        },
      }

      const result = getSigninURL(context)

      // Note: URL object strips hash fragments from pathname
      expect(result).toContain('/signin?callbackUrl=/page')
    })

    it('should handle encoded characters in callbackUrl', () => {
      const context = {
        query: {
          callbackUrl: '/page?redirect=%2Fother',
        },
      }

      const result = getSigninURL(context)

      expect(result).toContain('/signin?callbackUrl=/page')
      expect(result).toContain('redirect=')
    })

    it('should handle undefined query object', () => {
      const context = {
        query: undefined,
      }

      // This will throw because query.callbackUrl access will fail
      expect(() => getSigninURL(context)).toThrow()
    })

    it('should handle null query object', () => {
      const context = {
        query: null,
      }

      // This will throw because query.callbackUrl access will fail
      expect(() => getSigninURL(context)).toThrow()
    })
  })

  describe('getSigninRedirect', () => {
    it('should return redirect object with default URL', () => {
      const context = {
        query: {},
      }

      const result = getSigninRedirect(context)

      expect(result).toEqual({
        destination: '/signin?callbackUrl=/',
        permanent: false,
      })
    })

    it('should return redirect object with custom callbackUrl', () => {
      const context = {
        query: {
          callbackUrl: '/dashboard',
        },
      }

      const result = getSigninRedirect(context)

      expect(result).toEqual({
        destination: '/signin?callbackUrl=/dashboard',
        permanent: false,
      })
    })

    it('should always have permanent set to false', () => {
      const context1 = { query: {} }
      const context2 = { query: { callbackUrl: '/page' } }

      expect(getSigninRedirect(context1).permanent).toBe(false)
      expect(getSigninRedirect(context2).permanent).toBe(false)
    })

    it('should have correct destination property', () => {
      const context = {
        query: {
          callbackUrl: '/settings?tab=profile',
        },
      }

      const result = getSigninRedirect(context)

      expect(result).toHaveProperty('destination')
      expect(result).toHaveProperty('permanent')
      expect(result.destination).toBe(
        '/signin?callbackUrl=/settings?tab=profile'
      )
    })

    it('should return redirect for absolute URL callbackUrl', () => {
      const context = {
        query: {
          callbackUrl: 'https://app.example.com/dashboard',
        },
      }

      const result = getSigninRedirect(context)

      expect(result.destination).toBe('/signin?callbackUrl=/dashboard')
      expect(result.permanent).toBe(false)
    })
  })
})
