import { useTheme as useThemeBase } from 'next-themes'

import useTheme from './useTheme'

import { renderHook } from '@testing-library/react'

jest.mock('next-themes', () => ({
  useTheme: jest.fn(),
}))

describe('useTheme', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return theme when forcedTheme is not set', () => {
      useThemeBase.mockReturnValue({
        theme: 'dark',
        forcedTheme: undefined,
        setTheme: jest.fn(),
        resolvedTheme: 'dark',
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.theme).toBe('dark')
      expect(result.current.forcedTheme).toBeUndefined()
    })

    it('should return forcedTheme when it is set', () => {
      useThemeBase.mockReturnValue({
        theme: 'dark',
        forcedTheme: 'light',
        setTheme: jest.fn(),
        resolvedTheme: 'light',
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.theme).toBe('light')
      expect(result.current.forcedTheme).toBe('light')
    })

    it('should pass through other properties from useThemeBase', () => {
      const mockSetTheme = jest.fn()
      const mockSystemTheme = 'dark'

      useThemeBase.mockReturnValue({
        theme: 'dark',
        forcedTheme: undefined,
        setTheme: mockSetTheme,
        resolvedTheme: 'dark',
        systemTheme: mockSystemTheme,
        themes: ['light', 'dark', 'system'],
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.setTheme).toBe(mockSetTheme)
      expect(result.current.resolvedTheme).toBe('dark')
      expect(result.current.systemTheme).toBe(mockSystemTheme)
      expect(result.current.themes).toEqual(['light', 'dark', 'system'])
    })
  })

  describe('forcedTheme precedence', () => {
    it('should prioritize forcedTheme over regular theme', () => {
      useThemeBase.mockReturnValue({
        theme: 'dark',
        forcedTheme: 'light',
        setTheme: jest.fn(),
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.theme).toBe('light')
      expect(result.current.forcedTheme).toBe('light')
    })

    it('should use regular theme when forcedTheme is null', () => {
      useThemeBase.mockReturnValue({
        theme: 'dark',
        forcedTheme: null,
        setTheme: jest.fn(),
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.theme).toBe('dark')
      expect(result.current.forcedTheme).toBeNull()
    })

    it('should resolve system theme to the system preference', () => {
      useThemeBase.mockReturnValue({
        theme: 'system',
        forcedTheme: undefined,
        setTheme: jest.fn(),
        resolvedTheme: 'dark',
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.theme).toBe('dark')
      expect(result.current.resolvedTheme).toBe('dark')
    })

    it('should prefer forcedTheme over resolvedTheme', () => {
      useThemeBase.mockReturnValue({
        theme: 'system',
        forcedTheme: 'light',
        setTheme: jest.fn(),
        resolvedTheme: 'dark',
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.theme).toBe('light')
    })

    it('should fall back to theme before hydration when resolvedTheme is undefined', () => {
      useThemeBase.mockReturnValue({
        theme: 'dark',
        forcedTheme: undefined,
        setTheme: jest.fn(),
        resolvedTheme: undefined,
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.theme).toBe('dark')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined theme values', () => {
      useThemeBase.mockReturnValue({
        theme: undefined,
        forcedTheme: undefined,
        setTheme: jest.fn(),
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.theme).toBeUndefined()
      expect(result.current.forcedTheme).toBeUndefined()
    })

    it('should handle empty string as theme', () => {
      useThemeBase.mockReturnValue({
        theme: '',
        forcedTheme: undefined,
        setTheme: jest.fn(),
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.theme).toBe('')
    })

    it('should handle forcedTheme as empty string', () => {
      useThemeBase.mockReturnValue({
        theme: 'dark',
        forcedTheme: '',
        setTheme: jest.fn(),
      })

      const { result } = renderHook(() => useTheme())

      expect(result.current.theme).toBe('dark')
      expect(result.current.forcedTheme).toBe('')
    })
  })
})
