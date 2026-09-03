/* eslint-disable @typescript-eslint/no-require-imports */
import useIsAppRouter from './useIsAppRouter'

import { renderHook } from '@testing-library/react'

jest.mock('next/compat/router', () => ({
  useRouter: jest.fn(),
}))

describe('useIsAppRouter', () => {
  const { useRouter } = require('next/compat/router')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return true when router is not available (App Router)', () => {
      useRouter.mockReturnValue(null)

      const { result } = renderHook(() => useIsAppRouter())

      expect(result.current).toBe(true)
    })

    it('should return true when router is undefined (App Router)', () => {
      useRouter.mockReturnValue(undefined)

      const { result } = renderHook(() => useIsAppRouter())

      expect(result.current).toBe(true)
    })

    it('should return false when router is available (Pages Router)', () => {
      useRouter.mockReturnValue({
        pathname: '/',
        query: {},
        push: jest.fn(),
      })

      const { result } = renderHook(() => useIsAppRouter())

      expect(result.current).toBe(false)
    })
  })

  describe('different router states', () => {
    it('should return false with minimal router object', () => {
      useRouter.mockReturnValue({})

      const { result } = renderHook(() => useIsAppRouter())

      expect(result.current).toBe(false)
    })

    it('should return false with full router object', () => {
      useRouter.mockReturnValue({
        pathname: '/test',
        query: { id: '123' },
        asPath: '/test?id=123',
        push: jest.fn(),
        replace: jest.fn(),
        reload: jest.fn(),
        back: jest.fn(),
        prefetch: jest.fn(),
        beforePopState: jest.fn(),
        events: {
          on: jest.fn(),
          off: jest.fn(),
          emit: jest.fn(),
        },
        isFallback: false,
        isLocaleDomain: false,
        isReady: true,
        isPreview: false,
      })

      const { result } = renderHook(() => useIsAppRouter())

      expect(result.current).toBe(false)
    })
  })

  describe('re-render behavior', () => {
    it('should maintain consistent value on re-renders in App Router', () => {
      useRouter.mockReturnValue(null)

      const { result, rerender } = renderHook(() => useIsAppRouter())

      expect(result.current).toBe(true)

      rerender()
      rerender()

      expect(result.current).toBe(true)
    })

    it('should maintain consistent value on re-renders in Pages Router', () => {
      useRouter.mockReturnValue({ pathname: '/' })

      const { result, rerender } = renderHook(() => useIsAppRouter())

      expect(result.current).toBe(false)

      rerender()
      rerender()

      expect(result.current).toBe(false)
    })

    it('should update if router availability changes', () => {
      useRouter.mockReturnValue(null)

      const { result, rerender } = renderHook(() => useIsAppRouter())

      expect(result.current).toBe(true)

      // Simulate router becoming available
      useRouter.mockReturnValue({ pathname: '/' })

      rerender()

      expect(result.current).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle false as router value', () => {
      useRouter.mockReturnValue(false)

      const { result } = renderHook(() => useIsAppRouter())

      expect(result.current).toBe(true)
    })

    it('should handle 0 as router value', () => {
      useRouter.mockReturnValue(0)

      const { result } = renderHook(() => useIsAppRouter())

      expect(result.current).toBe(true)
    })

    it('should handle empty string as router value', () => {
      useRouter.mockReturnValue('')

      const { result } = renderHook(() => useIsAppRouter())

      expect(result.current).toBe(true)
    })
  })

  describe('multiple instances', () => {
    it('should return same value for multiple hook instances', () => {
      useRouter.mockReturnValue(null)

      const { result: result1 } = renderHook(() => useIsAppRouter())
      const { result: result2 } = renderHook(() => useIsAppRouter())

      expect(result1.current).toBe(result2.current)
      expect(result1.current).toBe(true)
    })

    it('should update all instances when router changes', () => {
      useRouter.mockReturnValue(null)

      const { result: result1, rerender: rerender1 } = renderHook(() =>
        useIsAppRouter()
      )
      const { result: result2, rerender: rerender2 } = renderHook(() =>
        useIsAppRouter()
      )

      expect(result1.current).toBe(true)
      expect(result2.current).toBe(true)

      useRouter.mockReturnValue({ pathname: '/' })

      rerender1()
      rerender2()

      expect(result1.current).toBe(false)
      expect(result2.current).toBe(false)
    })
  })
})
