/* eslint-disable @typescript-eslint/no-require-imports */
import { notAuthorized, notFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { withChildUserSession } from '@/lib/user.handler'
import { fastGetUserById } from '@/lib/user.get'

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  notFound: jest.fn(),
  notAuthorized: jest.fn(),
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

describe('user.handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('withChildUserSession', () => {
    describe('basic functionality', () => {
      it('should create child session when user exists and is child of session user', async () => {
        const { requiredUrlParam } = require('@/lib/query.get')

        const mockFn = jest.fn().mockResolvedValue(new Response('success'))
        const mockReq = new Request('https://example.com')
        const mockParentUser = { id: 'parent-123' }
        const mockChildUser = { id: 'child-456', parentId: 'parent-123' }
        const mockSession = { user: mockParentUser }

        requiredUrlParam.mockReturnValue('child-456')
        fastGetUserById.mockResolvedValue(mockChildUser)

        // Mock withSession to call the function it wraps
        withSession.mockImplementation((fn) => {
          return async (req, ...args) => {
            return fn(req, mockSession, ...args)
          }
        })

        const wrappedFn = withChildUserSession(mockFn)

        await wrappedFn(mockReq)

        expect(requiredUrlParam).toHaveBeenCalledWith(mockReq, 'userId')
        expect(fastGetUserById).toHaveBeenCalledWith('child-456')

        // Check that mockFn was called with the child session
        expect(mockFn).toHaveBeenCalled()

        const callArgs = mockFn.mock.calls[0]

        expect(callArgs[1]).toEqual({
          ...mockSession,
          user: mockChildUser,
        })
      })

      it('should pass additional arguments through to wrapped function', async () => {
        const { requiredUrlParam } = require('@/lib/query.get')

        const mockFn = jest.fn().mockResolvedValue(new Response('success'))
        const mockReq = new Request('https://example.com')
        const mockParentUser = { id: 'parent-123' }
        const mockChildUser = { id: 'child-456', parentId: 'parent-123' }
        const mockSession = { user: mockParentUser }
        const extraArg1 = 'arg1'
        const extraArg2 = { data: 'arg2' }

        requiredUrlParam.mockReturnValue('child-456')
        fastGetUserById.mockResolvedValue(mockChildUser)

        withSession.mockImplementation((fn) => {
          return async (req, ...args) => {
            return fn(req, mockSession, ...args)
          }
        })

        const wrappedFn = withChildUserSession(mockFn)

        await wrappedFn(mockReq, extraArg1, extraArg2)

        expect(mockFn).toHaveBeenCalledWith(
          mockReq,
          expect.objectContaining({ user: mockChildUser }),
          extraArg1,
          extraArg2
        )
      })
    })

    describe('error handling - user not found', () => {
      it('should return notFound when user does not exist', async () => {
        const { requiredUrlParam } = require('@/lib/query.get')

        const mockFn = jest.fn()
        const mockReq = new Request('https://example.com')
        const mockSession = { user: { id: 'parent-123' } }
        const notFoundResponse = new Response('not found', { status: 404 })

        requiredUrlParam.mockReturnValue('non-existent-user')
        fastGetUserById.mockResolvedValue(null)
        notFound.mockReturnValue(notFoundResponse)

        withSession.mockImplementation((fn) => {
          return async (req, ...args) => {
            return fn(req, mockSession, ...args)
          }
        })

        const wrappedFn = withChildUserSession(mockFn)
        const result = await wrappedFn(mockReq)

        expect(fastGetUserById).toHaveBeenCalledWith('non-existent-user')
        expect(notFound).toHaveBeenCalled()
        expect(result).toBe(notFoundResponse)
        expect(mockFn).not.toHaveBeenCalled()
      })

      it('should not call wrapped function when user is null', async () => {
        const { requiredUrlParam } = require('@/lib/query.get')

        const mockFn = jest.fn()
        const mockReq = new Request('https://example.com')
        const mockSession = { user: { id: 'parent-123' } }

        requiredUrlParam.mockReturnValue('child-456')
        fastGetUserById.mockResolvedValue(null)
        notFound.mockReturnValue(new Response('not found', { status: 404 }))

        withSession.mockImplementation((fn) => {
          return async (req, ...args) => {
            return fn(req, mockSession, ...args)
          }
        })

        const wrappedFn = withChildUserSession(mockFn)

        await wrappedFn(mockReq)

        expect(mockFn).not.toHaveBeenCalled()
      })
    })

    describe('error handling - unauthorized access', () => {
      it('should return notAuthorized when user parentId does not match session user id', async () => {
        const { requiredUrlParam } = require('@/lib/query.get')

        const mockFn = jest.fn()
        const mockReq = new Request('https://example.com')
        const mockSession = { user: { id: 'parent-123' } }
        const mockChildUser = { id: 'child-456', parentId: 'different-parent' }
        const notAuthorizedResponse = new Response('unauthorized', {
          status: 403,
        })

        requiredUrlParam.mockReturnValue('child-456')
        fastGetUserById.mockResolvedValue(mockChildUser)
        notAuthorized.mockReturnValue(notAuthorizedResponse)

        withSession.mockImplementation((fn) => {
          return async (req, ...args) => {
            return fn(req, mockSession, ...args)
          }
        })

        const wrappedFn = withChildUserSession(mockFn)
        const result = await wrappedFn(mockReq)

        expect(notAuthorized).toHaveBeenCalled()
        expect(result).toBe(notAuthorizedResponse)
        expect(mockFn).not.toHaveBeenCalled()
      })

      it('should return notAuthorized when user has null parentId', async () => {
        const { requiredUrlParam } = require('@/lib/query.get')

        const mockFn = jest.fn()
        const mockReq = new Request('https://example.com')
        const mockSession = { user: { id: 'parent-123' } }
        const mockChildUser = { id: 'child-456', parentId: null }

        requiredUrlParam.mockReturnValue('child-456')
        fastGetUserById.mockResolvedValue(mockChildUser)
        notAuthorized.mockReturnValue(
          new Response('unauthorized', { status: 403 })
        )

        withSession.mockImplementation((fn) => {
          return async (req, ...args) => {
            return fn(req, mockSession, ...args)
          }
        })

        const wrappedFn = withChildUserSession(mockFn)

        await wrappedFn(mockReq)

        expect(notAuthorized).toHaveBeenCalled()
        expect(mockFn).not.toHaveBeenCalled()
      })

      it('should return notAuthorized when user has undefined parentId', async () => {
        const { requiredUrlParam } = require('@/lib/query.get')

        const mockFn = jest.fn()
        const mockReq = new Request('https://example.com')
        const mockSession = { user: { id: 'parent-123' } }
        const mockChildUser = { id: 'child-456' } // no parentId property

        requiredUrlParam.mockReturnValue('child-456')
        fastGetUserById.mockResolvedValue(mockChildUser)
        notAuthorized.mockReturnValue(
          new Response('unauthorized', { status: 403 })
        )

        withSession.mockImplementation((fn) => {
          return async (req, ...args) => {
            return fn(req, mockSession, ...args)
          }
        })

        const wrappedFn = withChildUserSession(mockFn)

        await wrappedFn(mockReq)

        expect(notAuthorized).toHaveBeenCalled()
        expect(mockFn).not.toHaveBeenCalled()
      })
    })

    describe('session inheritance', () => {
      it('should inherit all properties from parent session', async () => {
        const { requiredUrlParam } = require('@/lib/query.get')

        const mockFn = jest.fn().mockResolvedValue(new Response('success'))
        const mockReq = new Request('https://example.com')
        const mockParentUser = { id: 'parent-123', name: 'Parent' }
        const mockChildUser = {
          id: 'child-456',
          parentId: 'parent-123',
          name: 'Child',
        }
        const mockSession = {
          user: mockParentUser,
          token: 'session-token',
          expiresAt: Date.now() + 3600000,
          otherProperty: 'value',
        }

        requiredUrlParam.mockReturnValue('child-456')
        fastGetUserById.mockResolvedValue(mockChildUser)

        withSession.mockImplementation((fn) => {
          return async (req, ...args) => {
            return fn(req, mockSession, ...args)
          }
        })

        const wrappedFn = withChildUserSession(mockFn)

        await wrappedFn(mockReq)

        // Check that mockFn was called with inherited session properties
        expect(mockFn).toHaveBeenCalled()

        const callArgs = mockFn.mock.calls[0]
        const childUserSession = callArgs[1]

        expect(childUserSession.user).toEqual(mockChildUser)
        expect(childUserSession.token).toBe('session-token')
        expect(childUserSession.otherProperty).toBe('value')
      })

      it('should only replace user property in session', async () => {
        const { requiredUrlParam } = require('@/lib/query.get')

        const mockFn = jest.fn().mockResolvedValue(new Response('success'))
        const mockReq = new Request('https://example.com')
        const mockParentUser = { id: 'parent-123' }
        const mockChildUser = { id: 'child-456', parentId: 'parent-123' }
        const mockSession = {
          user: mockParentUser,
          prop1: 'value1',
          prop2: 'value2',
        }

        requiredUrlParam.mockReturnValue('child-456')
        fastGetUserById.mockResolvedValue(mockChildUser)

        withSession.mockImplementation((fn) => {
          return async (req, ...args) => {
            return fn(req, mockSession, ...args)
          }
        })

        const wrappedFn = withChildUserSession(mockFn)

        await wrappedFn(mockReq)

        const childUserSession = mockFn.mock.calls[0][1]

        expect(childUserSession.user).toBe(mockChildUser)
        expect(childUserSession.prop1).toBe('value1')
        expect(childUserSession.prop2).toBe('value2')
      })
    })

    describe('integration with withSession', () => {
      it('should call withSession wrapper', () => {
        const mockFn = jest.fn()

        withChildUserSession(mockFn)

        expect(withSession).toHaveBeenCalled()
      })

      it('should work with withSession middleware chain', async () => {
        const { requiredUrlParam } = require('@/lib/query.get')

        const mockFn = jest.fn().mockResolvedValue(new Response('success'))
        const mockReq = new Request('https://example.com')
        const mockParentUser = { id: 'parent-123' }
        const mockChildUser = { id: 'child-456', parentId: 'parent-123' }
        const mockSession = { user: mockParentUser }

        requiredUrlParam.mockReturnValue('child-456')
        fastGetUserById.mockResolvedValue(mockChildUser)

        // Simulate withSession behavior
        withSession.mockImplementation((fn) => {
          return async (req, ...args) => {
            return fn(req, mockSession, ...args)
          }
        })

        const wrappedFn = withChildUserSession(mockFn)
        const result = await wrappedFn(mockReq)

        // Check that we got a Response back
        expect(result).toBeInstanceOf(Response)
      })
    })

    describe('edge cases', () => {
      it('should handle user with empty string parentId', async () => {
        const { requiredUrlParam } = require('@/lib/query.get')

        const mockFn = jest.fn()
        const mockReq = new Request('https://example.com')
        const mockSession = { user: { id: 'parent-123' } }
        const mockChildUser = { id: 'child-456', parentId: '' }

        requiredUrlParam.mockReturnValue('child-456')
        fastGetUserById.mockResolvedValue(mockChildUser)
        notAuthorized.mockReturnValue(
          new Response('unauthorized', { status: 403 })
        )

        withSession.mockImplementation((fn) => {
          return async (req, ...args) => {
            return fn(req, mockSession, ...args)
          }
        })

        const wrappedFn = withChildUserSession(mockFn)

        await wrappedFn(mockReq)

        expect(notAuthorized).toHaveBeenCalled()
      })

      it('should handle special characters in userId parameter', async () => {
        const { requiredUrlParam } = require('@/lib/query.get')

        const mockFn = jest.fn().mockResolvedValue(new Response('success'))
        const mockReq = new Request('https://example.com')
        const specialUserId = 'user-123_abc-XYZ'
        const mockParentUser = { id: 'parent-123' }
        const mockChildUser = { id: specialUserId, parentId: 'parent-123' }
        const mockSession = { user: mockParentUser }

        requiredUrlParam.mockReturnValue(specialUserId)
        fastGetUserById.mockResolvedValue(mockChildUser)

        withSession.mockImplementation((fn) => {
          return async (req, ...args) => {
            return fn(req, mockSession, ...args)
          }
        })

        const wrappedFn = withChildUserSession(mockFn)

        await wrappedFn(mockReq)

        expect(fastGetUserById).toHaveBeenCalledWith(specialUserId)
        expect(mockFn).toHaveBeenCalled()
      })
    })
  })
})
