/* eslint-disable @typescript-eslint/no-require-imports */
import { API_AUDIENCE, USER_AUDIENCE } from '@/lib/audience.consts'

import { withAPISession, withSession, withUserSession } from './session.handler'

jest.mock('@/lib/context.store', () => ({
  setContextUser: jest.fn(),
}))

jest.mock('@/lib/debug', () => ({
  createSpan: jest.fn(() => ({ finish: jest.fn() })),
}))

jest.mock('@/lib/response', () => ({
  captureUnknownException: jest.fn(),
  respondFromError: jest.fn((e) => new Response(e.message, { status: 500 })),
  throwNotAuthorized: jest.fn((msg) => new Response(msg, { status: 401 })),
}))

jest.mock('@/lib/session.context', () => ({
  getSessionStore: jest.fn(() => ({})),
  runInSessionContext: jest.fn((fn) => fn()),
}))

jest.mock('@/lib/session.get', () => ({
  getSession: jest.fn(),
}))

describe('withSession', () => {
  let setContextUser
  let createSpan
  let captureUnknownException
  let respondFromError
  let getSessionStore
  let runInSessionContext
  let getSession

  beforeEach(() => {
    jest.clearAllMocks()

    setContextUser = require('@/lib/context.store').setContextUser
    createSpan = require('@/lib/debug').createSpan
    captureUnknownException = require('@/lib/response').captureUnknownException
    respondFromError = require('@/lib/response').respondFromError
    getSessionStore = require('@/lib/session.context').getSessionStore
    runInSessionContext = require('@/lib/session.context').runInSessionContext
    getSession = require('@/lib/session.get').getSession
  })

  describe('basic functionality', () => {
    it('should call handler with session', async () => {
      const mockSession = {
        user: { id: 'user123', email: 'test@example.com' },
        payload: { aud: USER_AUDIENCE },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const mockResponse = new Response('success')
      const handler = jest.fn().mockResolvedValue(mockResponse)

      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withSession(handler)
      const result = await wrappedHandler(mockRequest)

      expect(getSession).toHaveBeenCalledWith(mockRequest)
      expect(setContextUser).toHaveBeenCalledWith(mockSession.user)
      expect(handler).toHaveBeenCalledWith(mockRequest, mockSession)
      expect(result).toBe(mockResponse)
    })

    it('should pass additional arguments to handler', async () => {
      const mockSession = {
        user: { id: 'user123' },
        payload: { aud: USER_AUDIENCE },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn().mockResolvedValue(new Response('ok'))

      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withSession(handler)

      await wrappedHandler(mockRequest, 'arg1', 'arg2', 'arg3')

      expect(handler).toHaveBeenCalledWith(
        mockRequest,
        mockSession,
        'arg1',
        'arg2',
        'arg3'
      )
    })

    it('should store session in context store', async () => {
      const mockSessionStore = {}
      const mockSession = {
        user: { id: 'user123' },
        payload: { aud: USER_AUDIENCE },
        valueOf: jest.fn().mockReturnValue({
          user: { id: 'user123' },
          payload: { aud: USER_AUDIENCE },
        }),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn().mockResolvedValue(new Response('ok'))

      getSession.mockResolvedValue(mockSession)
      getSessionStore.mockReturnValue(mockSessionStore)

      const wrappedHandler = withSession(handler)

      await wrappedHandler(mockRequest)

      expect(getSessionStore).toHaveBeenCalled()
      expect(mockSessionStore).toMatchObject({
        user: { id: 'user123' },
        payload: { aud: USER_AUDIENCE },
      })
    })

    it('should run handler in session context', async () => {
      const mockSession = {
        user: { id: 'user123' },
        payload: { aud: USER_AUDIENCE },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn().mockResolvedValue(new Response('ok'))

      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withSession(handler)

      await wrappedHandler(mockRequest)

      expect(runInSessionContext).toHaveBeenCalled()
    })
  })

  describe('span management', () => {
    it('should create and finish span', async () => {
      const mockSpan = { finish: jest.fn() }
      const mockSession = {
        user: { id: 'user123' },
        payload: { aud: USER_AUDIENCE },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn().mockResolvedValue(new Response('ok'))

      createSpan.mockReturnValue(mockSpan)
      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withSession(handler)

      await wrappedHandler(mockRequest)

      expect(createSpan).toHaveBeenCalledWith({ name: 'withSession' })
      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should finish span even when handler throws', async () => {
      const mockSpan = { finish: jest.fn() }
      const mockSession = {
        user: { id: 'user123' },
        payload: { aud: USER_AUDIENCE },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'))

      createSpan.mockReturnValue(mockSpan)
      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withSession(handler)

      await expect(wrappedHandler(mockRequest)).rejects.toThrow('Handler error')
      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should finish span when getSession fails', async () => {
      const mockSpan = { finish: jest.fn() }
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn()

      createSpan.mockReturnValue(mockSpan)
      getSession.mockRejectedValue(new Error('Session error'))

      const wrappedHandler = withSession(handler)

      await wrappedHandler(mockRequest)

      expect(mockSpan.finish).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should capture and respond from getSession errors', async () => {
      const error = new Error('Invalid session')
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn()

      getSession.mockRejectedValue(error)

      const wrappedHandler = withSession(handler)
      const result = await wrappedHandler(mockRequest)

      expect(captureUnknownException).toHaveBeenCalledWith(error)
      expect(respondFromError).toHaveBeenCalledWith(error)
      expect(handler).not.toHaveBeenCalled()
    })

    it('should propagate handler errors', async () => {
      const mockSession = {
        user: { id: 'user123' },
        payload: { aud: USER_AUDIENCE },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const error = new Error('Handler failed')
      const handler = jest.fn().mockRejectedValue(error)

      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withSession(handler)

      await expect(wrappedHandler(mockRequest)).rejects.toThrow(
        'Handler failed'
      )
    })
  })
})

describe('withUserSession', () => {
  let getSession
  let throwNotAuthorized

  beforeEach(() => {
    jest.clearAllMocks()
    getSession = require('@/lib/session.get').getSession
    throwNotAuthorized = require('@/lib/response').throwNotAuthorized
  })

  describe('authorization checks', () => {
    it('should call handler for user session', async () => {
      const mockSession = {
        user: { id: 'user123' },
        payload: { aud: USER_AUDIENCE },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const mockResponse = new Response('success')
      const handler = jest.fn().mockResolvedValue(mockResponse)

      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withUserSession(handler)
      const result = await wrappedHandler(mockRequest)

      expect(handler).toHaveBeenCalledWith(mockRequest, mockSession)
      expect(result).toBe(mockResponse)
    })

    it('should reject non-user session', async () => {
      const mockSession = {
        user: { id: 'api123' },
        payload: { aud: API_AUDIENCE },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn()

      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withUserSession(handler)

      await wrappedHandler(mockRequest)

      expect(throwNotAuthorized).toHaveBeenCalledWith('User session required')
      expect(handler).not.toHaveBeenCalled()
    })

    it('should reject session with undefined audience', async () => {
      const mockSession = {
        user: { id: 'user123' },
        payload: { aud: undefined },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn()

      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withUserSession(handler)

      await wrappedHandler(mockRequest)

      expect(throwNotAuthorized).toHaveBeenCalledWith('User session required')
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('different audience types', () => {
    it('should reject API audience', async () => {
      const mockSession = {
        user: { id: 'api123' },
        payload: { aud: API_AUDIENCE },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn()

      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withUserSession(handler)

      await wrappedHandler(mockRequest)

      expect(throwNotAuthorized).toHaveBeenCalledWith('User session required')
    })

    it('should reject custom audience', async () => {
      const mockSession = {
        user: { id: 'custom123' },
        payload: { aud: 'custom-audience' },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn()

      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withUserSession(handler)

      await wrappedHandler(mockRequest)

      expect(throwNotAuthorized).toHaveBeenCalledWith('User session required')
    })
  })
})

describe('withAPISession', () => {
  let getSession
  let throwNotAuthorized

  beforeEach(() => {
    jest.clearAllMocks()
    getSession = require('@/lib/session.get').getSession
    throwNotAuthorized = require('@/lib/response').throwNotAuthorized
  })

  describe('authorization checks', () => {
    it('should call handler for API session', async () => {
      const mockSession = {
        user: { id: 'api123' },
        payload: { aud: API_AUDIENCE },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const mockResponse = new Response('success')
      const handler = jest.fn().mockResolvedValue(mockResponse)

      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withAPISession(handler)
      const result = await wrappedHandler(mockRequest)

      expect(handler).toHaveBeenCalledWith(mockRequest, mockSession)
      expect(result).toBe(mockResponse)
    })

    it('should reject non-API session', async () => {
      const mockSession = {
        user: { id: 'user123' },
        payload: { aud: USER_AUDIENCE },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn()

      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withAPISession(handler)

      await wrappedHandler(mockRequest)

      expect(throwNotAuthorized).toHaveBeenCalledWith('API session required')
      expect(handler).not.toHaveBeenCalled()
    })

    it('should reject user audience', async () => {
      const mockSession = {
        user: { id: 'user123' },
        payload: { aud: USER_AUDIENCE },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn()

      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withAPISession(handler)

      await wrappedHandler(mockRequest)

      expect(throwNotAuthorized).toHaveBeenCalledWith('API session required')
    })

    it('should reject custom audience', async () => {
      const mockSession = {
        user: { id: 'custom123' },
        payload: { aud: 'custom-audience' },
        valueOf: jest.fn().mockReturnThis(),
      }
      const mockRequest = new Request('http://localhost/api/test')
      const handler = jest.fn()

      getSession.mockResolvedValue(mockSession)

      const wrappedHandler = withAPISession(handler)

      await wrappedHandler(mockRequest)

      expect(throwNotAuthorized).toHaveBeenCalledWith('API session required')
    })
  })
})
