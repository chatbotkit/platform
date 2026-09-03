/* eslint-disable @typescript-eslint/no-require-imports */
import useTeamSwitch from './useTeamSwitch'

import { renderHook } from '@testing-library/react'

const mockRouter = {
  push: jest.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
  events: { on: jest.fn(), off: jest.fn() },
}

jest.mock('@/hooks/useRouter', () => jest.fn(() => mockRouter))

describe('useTeamSwitch', () => {
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
      const { result } = renderHook(() => useTeamSwitch())

      expect(result.current.isSwitched).toBe(false)
      expect(result.current.id).toBe('')
      expect(result.current.name).toBe('')
    })

    it('should detect switched state when team id cookie is present', () => {
      document.cookie = 'chatbotkit.runas-teamid=team123'

      const { result } = renderHook(() => useTeamSwitch())

      expect(result.current.isSwitched).toBe(true)
      expect(result.current.id).toBe('team123')
    })

    it('should read team name from cookie when present', () => {
      document.cookie = 'chatbotkit.runas-teamid=team123'
      document.cookie = 'chatbotkit.runas-teamname=TestTeam'

      const { result } = renderHook(() => useTeamSwitch())

      expect(result.current.isSwitched).toBe(true)
      expect(result.current.id).toBe('team123')
      expect(result.current.name).toBe('TestTeam')
    })
  })

  describe('state management', () => {
    it('should provide setters for state values', () => {
      const { result } = renderHook(() => useTeamSwitch())

      expect(typeof result.current.setIsSwitched).toBe('function')
      expect(typeof result.current.setId).toBe('function')
      expect(typeof result.current.setName).toBe('function')
    })
  })

  describe('edge cases', () => {
    it('should handle team id without team name', () => {
      document.cookie = 'chatbotkit.runas-teamid=team456'

      const { result } = renderHook(() => useTeamSwitch())

      expect(result.current.isSwitched).toBe(true)
      expect(result.current.id).toBe('team456')
      expect(result.current.name).toBe('')
    })

    it('should handle empty team id cookie value', () => {
      document.cookie = 'chatbotkit.runas-teamid='

      const { result } = renderHook(() => useTeamSwitch())

      expect(result.current.isSwitched).toBe(false)
      expect(result.current.id).toBe('')
    })

    it('should handle malformed cookies gracefully', () => {
      document.cookie = 'someOtherCookie=value'

      const { result } = renderHook(() => useTeamSwitch())

      expect(result.current.isSwitched).toBe(false)
      expect(result.current.id).toBe('')
      expect(result.current.name).toBe('')
    })
  })

  describe('router integration', () => {
    it('should re-evaluate cookies on route change', () => {
      const useRouter = require('@/hooks/useRouter')

      mockRouter.asPath = '/dashboard'
      useRouter.mockReturnValue(mockRouter)

      const { rerender } = renderHook(() => useTeamSwitch())

      document.cookie = 'chatbotkit.runas-teamid=team789'
      mockRouter.asPath = '/dashboard/settings'

      rerender()

      const { result } = renderHook(() => useTeamSwitch())

      expect(result.current.id).toBe('team789')
    })
  })
})
