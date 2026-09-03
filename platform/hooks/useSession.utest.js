import { useSession as useSessionOriginal } from 'next-auth/react'

import useSession, { signIn, signOut } from './useSession'

import { renderHook } from '@testing-library/react'

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}))

describe('useSession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should call and return the original useSession', () => {
      const mockSession = {
        data: { user: { name: 'Test User', email: 'test@example.com' } },
        status: 'authenticated',
      }

      useSessionOriginal.mockReturnValue(mockSession)

      const { result } = renderHook(() => useSession())

      expect(useSessionOriginal).toHaveBeenCalledTimes(1)
      expect(result.current).toEqual(mockSession)
    })

    it('should return unauthenticated session', () => {
      const mockSession = {
        data: null,
        status: 'unauthenticated',
      }

      useSessionOriginal.mockReturnValue(mockSession)

      const { result } = renderHook(() => useSession())

      expect(result.current).toEqual(mockSession)
      expect(result.current.status).toBe('unauthenticated')
    })

    it('should return loading session', () => {
      const mockSession = {
        data: null,
        status: 'loading',
      }

      useSessionOriginal.mockReturnValue(mockSession)

      const { result } = renderHook(() => useSession())

      expect(result.current).toEqual(mockSession)
      expect(result.current.status).toBe('loading')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined session data', () => {
      useSessionOriginal.mockReturnValue(undefined)

      const { result } = renderHook(() => useSession())

      expect(result.current).toBeUndefined()
    })

    it('should handle null session', () => {
      useSessionOriginal.mockReturnValue(null)

      const { result } = renderHook(() => useSession())

      expect(result.current).toBeNull()
    })
  })

  describe('exported functions', () => {
    it('should export signIn function', () => {
      expect(signIn).toBeDefined()
      expect(typeof signIn).toBe('function')
    })

    it('should export signOut function', () => {
      expect(signOut).toBeDefined()
      expect(typeof signOut).toBe('function')
    })
  })
})
