/**
 * @jest-environment node
 */
import { captureException } from '@/lib/error'
import oauthServer, {
  errorToResponse,
  getValidatedRedirectUri,
  responseToResponse,
} from '@/lib/oauth.server'
import { getSoftSession } from '@/lib/session.get'

import handler from './authorize'

jest.mock('@/lib/session.get', () => ({
  getSoftSession: jest.fn(),
}))

jest.mock('@/lib/oauth.server', () => ({
  __esModule: true,
  default: {
    authorize: jest.fn(),
  },
  Request: jest.fn(function () {}),
  Response: jest.fn(function () {}),
  responseToResponse: jest.fn(),
  errorToResponse: jest.fn(),
  getValidatedRedirectUri: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
  captureInputError: jest.fn(),
}))

describe('OAuth authorize handler', () => {
  let req, res

  const mockSession = { user: { id: 'user_123' } }

  beforeEach(() => {
    jest.clearAllMocks()

    req = {
      method: 'POST',
      url: '/api/oauth/authorize?client_id=app1&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback',
      query: {
        client_id: 'app1',
        redirect_uri: 'https://example.com/callback',
      },
      body: { approval: 'granted' },
    }

    res = {
      status: jest.fn(),
      setHeader: jest.fn(),
      end: jest.fn(),
    }
  })

  // @note helper to get the location header from setHeader calls
  function getLocationHeader() {
    const call = res.setHeader.mock.calls.find(([key]) => key === 'location')

    return call ? call[1] : undefined
  }

  describe('unauthenticated access', () => {
    it('redirects to signin when there is no session', async () => {
      getSoftSession.mockResolvedValue(null)

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(302)
      expect(getLocationHeader()).toContain('/signin')
      expect(res.end).toHaveBeenCalled()
    })

    it('encodes the original URL as the callbackUrl in the signin redirect', async () => {
      getSoftSession.mockResolvedValue(null)
      req.url = '/api/oauth/authorize?client_id=app1'

      await handler(req, res)

      const location = getLocationHeader()

      expect(location).toContain(
        encodeURIComponent('/api/oauth/authorize?client_id=app1')
      )
    })

    it('does not call oauth.authorize when session is missing', async () => {
      getSoftSession.mockResolvedValue(null)

      await handler(req, res)

      expect(oauthServer.authorize).not.toHaveBeenCalled()
    })
  })

  describe('GET request - consent page redirect', () => {
    it('redirects GET requests to the consent page', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      req.method = 'GET'
      req.query = { client_id: 'app1', response_type: 'code' }

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(302)
      expect(getLocationHeader()).toContain('/oauth/consent')
    })

    it('forwards query params to the consent page', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      req.method = 'GET'
      req.query = { client_id: 'app1', response_type: 'code' }

      await handler(req, res)

      const location = getLocationHeader()

      expect(location).toContain('client_id=app1')
      expect(location).toContain('response_type=code')
    })

    it('does not call oauth.authorize for GET requests', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      req.method = 'GET'

      await handler(req, res)

      expect(oauthServer.authorize).not.toHaveBeenCalled()
    })
  })

  describe('POST with no approval field', () => {
    it('redirects to consent page when approval field is absent', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      req.body = {}

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(302)
      expect(getLocationHeader()).toContain('/oauth/consent')
    })

    it('does not call oauth.authorize when approval is absent', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      req.body = {}

      await handler(req, res)

      expect(oauthServer.authorize).not.toHaveBeenCalled()
    })
  })

  describe('POST with access denied', () => {
    it('redirects to a validated redirect_uri with access_denied error when user denies', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      getValidatedRedirectUri.mockResolvedValue('https://example.com/callback')
      req.body = { approval: 'denied' }
      req.query = {
        client_id: 'app1',
        redirect_uri: 'https://example.com/callback',
      }

      await handler(req, res)

      expect(getValidatedRedirectUri).toHaveBeenCalledWith(
        'app1',
        'https://example.com/callback'
      )

      expect(res.status).toHaveBeenCalledWith(302)

      const location = getLocationHeader()

      expect(location).toContain('error=access_denied')
      expect(location).toContain('example.com/callback')
    })

    it('redirects with access_denied for any non-granted approval value', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      getValidatedRedirectUri.mockResolvedValue('https://myapp.com/cb')
      req.body = { approval: 'rejected' }
      req.query = { client_id: 'app1', redirect_uri: 'https://myapp.com/cb' }

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(302)
      expect(getLocationHeader()).toContain('error=access_denied')
    })

    it('includes an error_description in the denied redirect', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      getValidatedRedirectUri.mockResolvedValue('https://example.com/callback')
      req.body = { approval: 'denied' }
      req.query = {
        client_id: 'app1',
        redirect_uri: 'https://example.com/callback',
      }

      await handler(req, res)

      expect(getLocationHeader()).toContain('error_description=')
    })

    it('validates the first value when redirect_uri is an array', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      getValidatedRedirectUri.mockResolvedValue('https://example.com/callback')
      req.body = { approval: 'denied' }
      req.query = {
        client_id: 'app1',
        redirect_uri: ['https://example.com/callback', 'https://other.com'],
      }

      await handler(req, res)

      expect(getValidatedRedirectUri).toHaveBeenCalledWith(
        'app1',
        'https://example.com/callback'
      )

      expect(res.status).toHaveBeenCalledWith(302)

      const location = getLocationHeader()

      expect(location).toContain('example.com/callback')
    })

    it('returns 400 without redirecting when the redirect_uri is not registered', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      getValidatedRedirectUri.mockResolvedValue(null)
      req.body = { approval: 'denied' }
      req.query = {
        client_id: 'app1',
        redirect_uri: 'https://attacker.example.net/cb',
      }

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(getLocationHeader()).toBeUndefined()
      expect(oauthServer.authorize).not.toHaveBeenCalled()
    })

    it('does not call oauth.authorize when access is denied', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      getValidatedRedirectUri.mockResolvedValue('https://example.com/callback')
      req.body = { approval: 'denied' }
      req.query = {
        client_id: 'app1',
        redirect_uri: 'https://example.com/callback',
      }

      await handler(req, res)

      expect(oauthServer.authorize).not.toHaveBeenCalled()
    })
  })

  describe('POST with authorization granted', () => {
    it('calls oauth.authorize when approval is granted', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      oauthServer.authorize.mockResolvedValue({})

      await handler(req, res)

      expect(oauthServer.authorize).toHaveBeenCalled()
    })

    it('passes an authenticateHandler that returns the session user', async () => {
      getSoftSession.mockResolvedValue(mockSession)

      let capturedHandle

      oauthServer.authorize.mockImplementation(
        async (request, response, options) => {
          capturedHandle = options.authenticateHandler.handle

          return {}
        }
      )

      await handler(req, res)

      const user = await capturedHandle()

      expect(user).toBe(mockSession.user)
    })

    it('calls responseToResponse after successful authorization', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      oauthServer.authorize.mockResolvedValue({})

      await handler(req, res)

      expect(responseToResponse).toHaveBeenCalledWith(expect.anything(), res)
    })
  })

  describe('error handling', () => {
    it('captures and handles errors thrown by oauth.authorize', async () => {
      getSoftSession.mockResolvedValue(mockSession)

      const oauthError = new Error('OAuth internal error')

      oauthServer.authorize.mockRejectedValue(oauthError)

      await handler(req, res)

      expect(captureException).toHaveBeenCalledWith(oauthError)
      expect(errorToResponse).toHaveBeenCalledWith(
        oauthError,
        res,
        expect.any(Object)
      )
    })

    it('does not throw when oauth.authorize fails', async () => {
      getSoftSession.mockResolvedValue(mockSession)
      oauthServer.authorize.mockRejectedValue(new Error('boom'))

      await expect(handler(req, res)).resolves.not.toThrow()
    })
  })
})
