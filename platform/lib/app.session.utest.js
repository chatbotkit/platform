import { getAppSession, getSoftAppSession } from '@/lib/app.session'
import { APP_AUDIENCE, USER_AUDIENCE } from '@/lib/audience.consts'
import { throwNotAuthenticated } from '@/lib/response'
import { ServerActionRequest, getSession } from '@/lib/session.get'

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(() => {
    throw new Error('Not authenticated')
  }),
}))

jest.mock('@/lib/session.get', () => ({
  ServerActionRequest: {
    make: jest.fn(),
  },
  getSession: jest.fn(),
}))

describe('app.session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getAppSession', () => {
    it('should return session for valid user audience', async () => {
      const mockSession = {
        payload: { aud: USER_AUDIENCE },
        user: { id: 'user-123' },
      }

      getSession.mockResolvedValue(mockSession)

      const result = await getAppSession('test-app')

      expect(result).toEqual(mockSession)
      expect(getSession).toHaveBeenCalledTimes(1)
    })

    it('should return session for valid app audience', async () => {
      const mockSession = {
        payload: { aud: APP_AUDIENCE },
        app: { id: 'app-123' },
      }

      getSession.mockResolvedValue(mockSession)

      const result = await getAppSession('test-app')

      expect(result).toEqual(mockSession)
      expect(getSession).toHaveBeenCalledTimes(1)
    })

    it('should throw error for invalid audience', async () => {
      const mockSession = {
        payload: { aud: 'invalid-audience' },
      }

      getSession.mockResolvedValue(mockSession)

      await expect(getAppSession('test-app')).rejects.toThrow(
        'Not authenticated'
      )
      expect(throwNotAuthenticated).toHaveBeenCalledTimes(1)
    })

    it('should create ServerActionRequest when req not provided', async () => {
      const mockReq = { headers: {} }
      const mockSession = {
        payload: { aud: USER_AUDIENCE },
      }

      ServerActionRequest.make.mockResolvedValue(mockReq)
      getSession.mockResolvedValue(mockSession)

      await getAppSession('test-app')

      expect(ServerActionRequest.make).toHaveBeenCalledTimes(1)
      expect(getSession).toHaveBeenCalledWith(mockReq, undefined)
    })

    it('should use provided req when given', async () => {
      const mockReq = { headers: { authorization: 'Bearer token' } }
      const mockSession = {
        payload: { aud: USER_AUDIENCE },
      }

      getSession.mockResolvedValue(mockSession)

      await getAppSession('test-app', mockReq)

      expect(ServerActionRequest.make).not.toHaveBeenCalled()
      expect(getSession).toHaveBeenCalledWith(mockReq, undefined)
    })

    it('should pass res parameter to getSession when provided', async () => {
      const mockReq = { headers: {} }
      const mockRes = { setHeader: jest.fn() }
      const mockSession = {
        payload: { aud: APP_AUDIENCE },
      }

      getSession.mockResolvedValue(mockSession)

      await getAppSession('test-app', mockReq, mockRes)

      expect(getSession).toHaveBeenCalledWith(mockReq, mockRes)
    })

    it('should accept app parameter but not validate against it yet', async () => {
      const mockSession = {
        payload: { aud: USER_AUDIENCE },
      }

      getSession.mockResolvedValue(mockSession)

      await getAppSession('different-app')

      expect(getSession).toHaveBeenCalledTimes(1)
      // @note app parameter is not currently used in validation
    })

    it('should throw error when session is null', async () => {
      getSession.mockResolvedValue(null)

      await expect(getAppSession('test-app')).rejects.toThrow()
    })

    it('should throw error when session payload is missing', async () => {
      const mockSession = {}

      getSession.mockResolvedValue(mockSession)

      await expect(getAppSession('test-app')).rejects.toThrow()
    })

    it('should throw error when session payload aud is missing', async () => {
      const mockSession = {
        payload: {},
      }

      getSession.mockResolvedValue(mockSession)

      await expect(getAppSession('test-app')).rejects.toThrow()
    })
  })

  describe('getSoftAppSession', () => {
    it('should return session when validation succeeds', async () => {
      const mockSession = {
        payload: { aud: USER_AUDIENCE },
        user: { id: 'user-456' },
      }

      getSession.mockResolvedValue(mockSession)

      const result = await getSoftAppSession('test-app')

      expect(result).toEqual(mockSession)
    })

    it('should return null when authentication fails', async () => {
      const mockSession = {
        payload: { aud: 'invalid' },
      }

      getSession.mockResolvedValue(mockSession)

      const result = await getSoftAppSession('test-app')

      expect(result).toBeNull()
    })

    it('should return null when getSession throws error', async () => {
      getSession.mockRejectedValue(new Error('Session error'))

      const result = await getSoftAppSession('test-app')

      expect(result).toBeNull()
    })

    it('should return null when throwNotAuthenticated is called', async () => {
      const mockSession = {
        payload: { aud: 'unauthorized' },
      }

      getSession.mockResolvedValue(mockSession)

      const result = await getSoftAppSession('test-app')

      expect(result).toBeNull()
    })

    it('should pass req parameter through to getAppSession', async () => {
      const mockReq = { headers: { authorization: 'Bearer token' } }
      const mockSession = {
        payload: { aud: APP_AUDIENCE },
      }

      getSession.mockResolvedValue(mockSession)

      await getSoftAppSession('test-app', mockReq)

      expect(getSession).toHaveBeenCalledWith(mockReq, undefined)
    })

    it('should pass res parameter through to getAppSession', async () => {
      const mockReq = { headers: {} }
      const mockRes = { setHeader: jest.fn() }
      const mockSession = {
        payload: { aud: USER_AUDIENCE },
      }

      getSession.mockResolvedValue(mockSession)

      await getSoftAppSession('test-app', mockReq, mockRes)

      expect(getSession).toHaveBeenCalledWith(mockReq, mockRes)
    })

    it('should handle multiple audiences correctly', async () => {
      const mockUserSession = {
        payload: { aud: USER_AUDIENCE },
      }

      const mockAppSession = {
        payload: { aud: APP_AUDIENCE },
      }

      // test user session
      getSession.mockResolvedValue(mockUserSession)

      const userResult = await getSoftAppSession('test-app')

      expect(userResult).toEqual(mockUserSession)

      // test app session
      getSession.mockResolvedValue(mockAppSession)

      const appResult = await getSoftAppSession('test-app')

      expect(appResult).toEqual(mockAppSession)
    })

    it('should not throw errors but return null for any exception', async () => {
      getSession.mockImplementation(() => {
        throw new TypeError('Unexpected type')
      })

      const result = await getSoftAppSession('test-app')

      expect(result).toBeNull()
    })
  })
})
