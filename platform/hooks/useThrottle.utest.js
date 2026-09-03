import useThrottle from './useThrottle'

import { act, renderHook } from '@testing-library/react'

describe('useThrottle', () => {
  beforeEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('basic functionality', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useThrottle('initial', 500))

      expect(result.current).toBe('initial')
    })

    it('should update value after delay passes', () => {
      jest.useFakeTimers()

      const { result, rerender } = renderHook(
        ({ value, delay }) => useThrottle(value, delay),
        {
          initialProps: { value: 'initial', delay: 500 },
        }
      )

      expect(result.current).toBe('initial')

      // Update value
      rerender({ value: 'updated', delay: 500 })

      // Before delay passes
      expect(result.current).toBe('initial')

      // After delay passes
      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe('updated')

      jest.useRealTimers()
    })

    it('should throttle multiple rapid updates', () => {
      jest.useFakeTimers()

      const { result, rerender } = renderHook(
        ({ value, delay }) => useThrottle(value, delay),
        {
          initialProps: { value: 'initial', delay: 500 },
        }
      )

      // Multiple rapid updates
      rerender({ value: 'update1', delay: 500 })
      rerender({ value: 'update2', delay: 500 })
      rerender({ value: 'update3', delay: 500 })

      // Before delay
      expect(result.current).toBe('initial')

      act(() => {
        jest.advanceTimersByTime(500)
      })

      // Only the last value should be set
      expect(result.current).toBe('update3')

      jest.useRealTimers()
    })
  })

  describe('delay changes', () => {
    it('should handle delay changes', () => {
      jest.useFakeTimers()

      const { result, rerender } = renderHook(
        ({ value, delay }) => useThrottle(value, delay),
        {
          initialProps: { value: 'initial', delay: 500 },
        }
      )

      rerender({ value: 'updated', delay: 1000 })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      // Should not update yet with longer delay
      expect(result.current).toBe('initial')

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe('updated')

      jest.useRealTimers()
    })

    it('should handle zero delay', () => {
      jest.useFakeTimers()

      const { result, rerender } = renderHook(
        ({ value, delay }) => useThrottle(value, delay),
        {
          initialProps: { value: 'initial', delay: 0 },
        }
      )

      rerender({ value: 'updated', delay: 0 })

      act(() => {
        jest.advanceTimersByTime(0)
      })

      expect(result.current).toBe('updated')

      jest.useRealTimers()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined value', () => {
      const { result } = renderHook(() => useThrottle(undefined, 500))

      expect(result.current).toBeUndefined()
    })

    it('should handle null value', () => {
      const { result } = renderHook(() => useThrottle(null, 500))

      expect(result.current).toBeNull()
    })

    it('should handle number values', () => {
      jest.useFakeTimers()

      const { result, rerender } = renderHook(
        ({ value, delay }) => useThrottle(value, delay),
        {
          initialProps: { value: 0, delay: 500 },
        }
      )

      expect(result.current).toBe(0)

      rerender({ value: 42, delay: 500 })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe(42)

      jest.useRealTimers()
    })

    it('should handle object values', () => {
      jest.useFakeTimers()

      const obj1 = { id: 1 }
      const obj2 = { id: 2 }

      const { result, rerender } = renderHook(
        ({ value, delay }) => useThrottle(value, delay),
        {
          initialProps: { value: obj1, delay: 500 },
        }
      )

      expect(result.current).toBe(obj1)

      rerender({ value: obj2, delay: 500 })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe(obj2)

      jest.useRealTimers()
    })

    it('should handle boolean values', () => {
      jest.useFakeTimers()

      const { result, rerender } = renderHook(
        ({ value, delay }) => useThrottle(value, delay),
        {
          initialProps: { value: false, delay: 500 },
        }
      )

      expect(result.current).toBe(false)

      rerender({ value: true, delay: 500 })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe(true)

      jest.useRealTimers()
    })
  })

  describe('cleanup', () => {
    it('should cleanup timeouts on unmount', () => {
      jest.useFakeTimers()

      const { unmount, rerender } = renderHook(
        ({ value, delay }) => useThrottle(value, delay),
        {
          initialProps: { value: 'initial', delay: 500 },
        }
      )

      rerender({ value: 'updated', delay: 500 })

      unmount()

      // Should not throw or cause issues
      expect(() => {
        jest.advanceTimersByTime(500)
      }).not.toThrow()

      jest.useRealTimers()
    })
  })
})
