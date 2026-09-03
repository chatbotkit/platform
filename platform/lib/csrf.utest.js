import {
  getBodyCsrfToken,
  getCookieCsrfToken,
  getUrlCsrfToken,
  hasCsrfToken,
  hasProtection,
  hasXRequestedWithHeader,
} from '@/lib/csrf'
import { getHeader } from '@/lib/header'

jest.mock('@/lib/header', () => ({
  getHeader: jest.fn(),
}))

describe('CSRF Protection Utils', () => {
  const CSRF_TOKEN_COOKIE_NAME = '__Host-next-auth.csrf-token'

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getCookieCsrfToken', () => {
    it('returns the CSRF token from cookies', () => {
      const req = {}

      const csrfToken = 'token_from_cookie'

      getHeader.mockReturnValueOnce(
        `${CSRF_TOKEN_COOKIE_NAME}=${csrfToken}; other-cookie=value`
      )

      expect(getCookieCsrfToken(req)).toBe(csrfToken)
    })

    it('returns null if CSRF token is not found in cookies', () => {
      const req = {}

      getHeader.mockReturnValueOnce('other-cookie=value')

      expect(getCookieCsrfToken(req)).toBeNull()
    })
  })

  describe('getUrlCsrfToken', () => {
    it('returns the CSRF token from request query', () => {
      const req = { query: { csrfToken: 'token_from_query' } }

      expect(getUrlCsrfToken(req)).toBe('token_from_query')
    })

    it('returns null if CSRF token is not in query', () => {
      const req = { query: {} }

      expect(getUrlCsrfToken(req)).toBeNull()
    })

    it('returns null if req has no query and URL does not contain csrfToken', () => {
      const req = { url: '/example-endpoint' }

      expect(getUrlCsrfToken(req)).toBeNull()
    })
  })

  describe('getBodyCsrfToken', () => {
    it('returns the CSRF token from request body', () => {
      const req = { body: { csrfToken: 'token' } }

      expect(getBodyCsrfToken(req)).toBe('token')
    })

    it('returns null if CSRF token is not in body', () => {
      const req = { body: {} }

      expect(getBodyCsrfToken(req)).toBeNull()
    })

    it('returns null if req has no body', () => {
      const req = {}

      expect(getBodyCsrfToken(req)).toBeNull()
    })

    it('returns the first CSRF token in the array if multiple tokens are present', () => {
      const req = { body: { csrfToken: ['token1', 'token2'] } }

      expect(getBodyCsrfToken(req)).toBe('token1')
    })

    it('returns null if CSRF token is not in body', () => {
      const req = { body: {} }

      expect(getBodyCsrfToken(req)).toBeNull()
    })
  })

  describe('hasCsrfToken', () => {
    it('returns true if cookie and URL CSRF tokens match', () => {
      const req = {
        query: { csrfToken: 'token' },
        url: '/example?csrfToken=token',
      }

      getHeader.mockReturnValueOnce(`${CSRF_TOKEN_COOKIE_NAME}=token`)

      expect(hasCsrfToken(req)).toBe(true)
    })

    it('returns false if cookie and URL CSRF tokens do not match', () => {
      const req = {
        query: { csrfToken: 'token2' },
        url: '/example?csrfToken=token2',
      }

      getHeader.mockReturnValueOnce(`${CSRF_TOKEN_COOKIE_NAME}=token1`)

      expect(hasCsrfToken(req)).toBe(false)
    })

    it('returns false if cookie CSRF token is not present', () => {
      const req = {
        query: { csrfToken: 'token' },
        url: '/example?csrfToken=token',
      }

      getHeader.mockReturnValueOnce('')

      expect(hasCsrfToken(req)).toBe(false)
    })

    it('returns false if URL CSRF token is not present', () => {
      const req = {
        query: {},
        url: '/example?otherParam=value',
      }

      getHeader.mockReturnValueOnce(`${CSRF_TOKEN_COOKIE_NAME}=token`)

      expect(hasCsrfToken(req)).toBe(false)
    })

    it('returns false if both cookie and URL CSRF tokens are not present', () => {
      const req = {
        query: {},
        url: '/example?otherParam=value',
      }

      getHeader.mockReturnValueOnce('')

      expect(hasCsrfToken(req)).toBe(false)
    })

    it('returns true if body and URL CSRF tokens match', () => {
      const req = {
        body: { csrfToken: 'token' },
      }

      getHeader.mockReturnValueOnce(`${CSRF_TOKEN_COOKIE_NAME}=token`)

      expect(hasCsrfToken(req)).toBe(true)
    })

    it('returns false if body and URL CSRF tokens do not match', () => {
      const req = {
        body: { csrfToken: 'token2' },
      }

      getHeader.mockReturnValueOnce(`${CSRF_TOKEN_COOKIE_NAME}=token1`)

      expect(hasCsrfToken(req)).toBe(false)
    })
  })

  describe('hasXRequestedWithHeader', () => {
    it('returns true if "x-requested-with" header is "XMLHttpRequest"', () => {
      const req = {}

      getHeader.mockReturnValueOnce('XMLHttpRequest')

      expect(hasXRequestedWithHeader(req)).toBe(true)
    })

    it('returns false if "x-requested-with" header is not "XMLHttpRequest"', () => {
      const req = {}

      getHeader.mockReturnValueOnce('NotXMLHttpRequest')

      expect(hasXRequestedWithHeader(req)).toBe(false)
    })
  })

  describe('hasProtection', () => {
    it('returns true if has valid CSRF token or "x-requested-with" is "XMLHttpRequest"', () => {
      const req = {
        query: { csrfToken: 'token' },
        url: '/example?csrfToken=token',
      }

      getHeader.mockReturnValueOnce(`${CSRF_TOKEN_COOKIE_NAME}=token`)
      getHeader.mockReturnValueOnce('XMLHttpRequest')

      expect(hasProtection(req)).toBe(true)
    })

    it('returns false if neither CSRF token present nor "x-requested-with" header is "XMLHttpRequest"', () => {
      const req = { query: {}, url: '/example?otherParam=value' }

      getHeader.mockReturnValueOnce('')
      getHeader.mockReturnValueOnce('UnexpectedHeader')

      expect(hasProtection(req)).toBe(false)
    })
  })
})
