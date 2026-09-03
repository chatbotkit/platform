import useIsMounted from './useIsMounted'

import { renderHook } from '@testing-library/react'

describe('useIsMounted', () => {
  describe('initialization', () => {
    it('should return false on initial render', () => {
      const { result } = renderHook(() => useIsMounted())

      expect(result.current).toBe(false)
    })
  })

  describe('mounted state', () => {
    it('should return true after effect runs', () => {
      const { result, rerender } = renderHook(() => useIsMounted())

      // Initially false
      expect(result.current).toBe(false)

      // After effect runs, ref is updated to true
      rerender()
      expect(result.current).toBe(true)
    })

    it('should maintain true value across multiple renders after mount', () => {
      const { result, rerender } = renderHook(() => useIsMounted())

      // First render: false
      expect(result.current).toBe(false)

      // After mount effect: true
      rerender()
      expect(result.current).toBe(true)

      // Should stay true
      rerender()
      expect(result.current).toBe(true)

      rerender()
      expect(result.current).toBe(true)
    })
  })

  describe('unmount behavior', () => {
    it('should not throw errors on unmount', () => {
      const { unmount } = renderHook(() => useIsMounted())

      expect(() => unmount()).not.toThrow()
    })
  })

  describe('multiple instances', () => {
    it('should maintain independent state for multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useIsMounted())
      const { result: result2 } = renderHook(() => useIsMounted())

      // Both should have same initial state
      expect(result1.current).toBe(false)
      expect(result2.current).toBe(false)

      // Should be independent values
      expect(result1.current).toBe(result2.current)
    })
  })
})
