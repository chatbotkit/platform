/* eslint-disable @typescript-eslint/no-require-imports */
import useUserSwitch from './useUserSwitch'

import { renderHook } from '@testing-library/react'

const mockRouter = {
  push: jest.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
  events: { on: jest.fn(), off: jest.fn() },
}

jest.mock('@/hooks/useRouter', () => jest.fn(() => mockRouter))

describe('useUserSwitch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // @note clear all cookies by expiring them
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0].trim()

      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    })
  })

  describe('basic functionality', () => {
    it('should return default values when no cookie is set', () => {
      const { result } = renderHook(() => useUserSwitch())

      expect(result.current.isSwitched).toBe(false)
      expect(result.current.id).toBe('')
      expect(result.current.name).toBe('')
    })

    it('should detect switched state when user id cookie is present', () => {
      document.cookie = 'chatbotkit.runas-userid=user123'

      const { result } = renderHook(() => useUserSwitch())

      expect(result.current.isSwitched).toBe(true)
      expect(result.current.id).toBe('user123')
    })

    it('should read user name from cookie when present', () => {
      document.cookie = 'chatbotkit.runas-userid=user123'
      document.cookie = 'chatbotkit.runas-username=JohnDoe'

      const { result } = renderHook(() => useUserSwitch())

      expect(result.current.isSwitched).toBe(true)
      expect(result.current.id).toBe('user123')
      expect(result.current.name).toBe('JohnDoe')
    })
  })

  describe('state management', () => {
    it('should provide setters for state values', () => {
      const { result } = renderHook(() => useUserSwitch())

      expect(typeof result.current.setIsSwitched).toBe('function')
      expect(typeof result.current.setId).toBe('function')
      expect(typeof result.current.setName).toBe('function')
    })
  })

  describe('edge cases', () => {
    it('should handle user id without user name', () => {
      document.cookie = 'chatbotkit.runas-userid=user456'

      const { result } = renderHook(() => useUserSwitch())

      expect(result.current.isSwitched).toBe(true)
      expect(result.current.id).toBe('user456')
      expect(result.current.name).toBe('')
    })

    it('should handle empty user id cookie value', () => {
      document.cookie = 'chatbotkit.runas-userid='

      const { result } = renderHook(() => useUserSwitch())

      expect(result.current.isSwitched).toBe(false)
      expect(result.current.id).toBe('')
    })

    it('should handle malformed cookies gracefully', () => {
      document.cookie = 'someOtherCookie=value'

      const { result } = renderHook(() => useUserSwitch())

      expect(result.current.isSwitched).toBe(false)
      expect(result.current.id).toBe('')
      expect(result.current.name).toBe('')
    })

    it('should handle special characters in user name', () => {
      document.cookie = 'chatbotkit.runas-userid=user999'
      document.cookie = 'chatbotkit.runas-username=JaneOBrien'

      const { result } = renderHook(() => useUserSwitch())

      expect(result.current.isSwitched).toBe(true)
      expect(result.current.id).toBe('user999')
      expect(result.current.name).toBe('JaneOBrien')
    })
  })

  describe('router integration', () => {
    it('should re-evaluate cookies on route change', () => {
      const useRouter = require('@/hooks/useRouter')

      mockRouter.asPath = '/profile'
      useRouter.mockReturnValue(mockRouter)

      const { rerender } = renderHook(() => useUserSwitch())

      document.cookie = 'chatbotkit.runas-userid=user789'
      mockRouter.asPath = '/profile/settings'

      rerender()

      const { result } = renderHook(() => useUserSwitch())

      expect(result.current.id).toBe('user789')
    })
  })
})
