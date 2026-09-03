import useThrottle from './useThrottle'

import { act, renderHook } from '@testing-library/react'

describe('useThrottle', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('basic functionality', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useThrottle('initial', 1000))

      expect(result.current).toBe('initial')
    })

    it('should throttle value updates', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useThrottle(value, delay),
        {
          initialProps: { value: 'first', delay: 1000 },
        }
      )

      expect(result.current).toBe('first')

      // Update value
      rerender({ value: 'second', delay: 1000 })

      // Should still be first (throttled)
      expect(result.current).toBe('first')

      // Advance time past delay
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      // Should now be second
      expect(result.current).toBe('second')
    })

    it('should update value after delay elapses', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useThrottle(value, 500),
        {
          initialProps: { value: 'initial' },
        }
      )

      rerender({ value: 'updated' })

      // Advance time to trigger update
      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe('updated')
    })

    it('should handle multiple rapid updates', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useThrottle(value, 1000),
        {
          initialProps: { value: 'first' },
        }
      )

      // Rapid updates
      rerender({ value: 'second' })
      rerender({ value: 'third' })
      rerender({ value: 'fourth' })

      // Should still be first
      expect(result.current).toBe('first')

      // Advance time
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      // Should jump to fourth (most recent)
      expect(result.current).toBe('fourth')
    })
  })

  describe('delay changes', () => {
    it('should handle changing delay', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useThrottle(value, delay),
        {
          initialProps: { value: 'first', delay: 1000 },
        }
      )

      rerender({ value: 'second', delay: 500 })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe('second')
    })

    it('should respect new delay value', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useThrottle(value, delay),
        {
          initialProps: { value: 'first', delay: 1000 },
        }
      )

      // Change delay to shorter duration
      rerender({ value: 'second', delay: 200 })

      // Should update after new delay
      act(() => {
        jest.advanceTimersByTime(200)
      })

      expect(result.current).toBe('second')
    })
  })

  describe('edge cases', () => {
    it('should handle zero delay', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useThrottle(value, 0),
        {
          initialProps: { value: 'first' },
        }
      )

      rerender({ value: 'second' })

      act(() => {
        jest.advanceTimersByTime(0)
      })

      expect(result.current).toBe('second')
    })

    it('should handle undefined value', () => {
      const { result } = renderHook(() => useThrottle(undefined, 1000))

      expect(result.current).toBeUndefined()
    })

    it('should handle null value', () => {
      const { result } = renderHook(() => useThrottle(null, 1000))

      expect(result.current).toBeNull()
    })

    it('should handle empty string', () => {
      const { result } = renderHook(() => useThrottle('', 1000))

      expect(result.current).toBe('')
    })

    it('should handle number values', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useThrottle(value, 500),
        {
          initialProps: { value: 0 },
        }
      )

      expect(result.current).toBe(0)

      rerender({ value: 42 })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe(42)
    })

    it('should handle boolean values', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useThrottle(value, 500),
        {
          initialProps: { value: false },
        }
      )

      expect(result.current).toBe(false)

      rerender({ value: true })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe(true)
    })

    it('should handle object values', () => {
      const obj1 = { id: 1 }
      const obj2 = { id: 2 }

      const { result, rerender } = renderHook(
        ({ value }) => useThrottle(value, 500),
        {
          initialProps: { value: obj1 },
        }
      )

      expect(result.current).toBe(obj1)

      rerender({ value: obj2 })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe(obj2)
    })

    it('should handle array values', () => {
      const arr1 = [1, 2, 3]
      const arr2 = [4, 5, 6]

      const { result, rerender } = renderHook(
        ({ value }) => useThrottle(value, 500),
        {
          initialProps: { value: arr1 },
        }
      )

      expect(result.current).toBe(arr1)

      rerender({ value: arr2 })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe(arr2)
    })
  })

  describe('timing behavior', () => {
    it('should not update before delay elapses', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useThrottle(value, 1000),
        {
          initialProps: { value: 'first' },
        }
      )

      rerender({ value: 'second' })

      // Advance time but not enough
      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe('first')

      // Advance remaining time
      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe('second')
    })

    it('should allow multiple throttled updates in sequence', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useThrottle(value, 1000),
        {
          initialProps: { value: 'first' },
        }
      )

      // First update
      rerender({ value: 'second' })

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current).toBe('second')

      // Second update
      rerender({ value: 'third' })

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current).toBe('third')
    })

    it('should cleanup timeout on unmount', () => {
      const { unmount, rerender } = renderHook(
        ({ value }) => useThrottle(value, 1000),
        {
          initialProps: { value: 'first' },
        }
      )

      rerender({ value: 'second' })

      // Unmount before timeout completes
      unmount()

      // Should not throw
      act(() => {
        jest.advanceTimersByTime(1000)
      })
    })

    it('should respect throttle timing across value changes', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useThrottle(value, 1000),
        {
          initialProps: { value: 'first' },
        }
      )

      // Change value immediately
      rerender({ value: 'second' })

      // Wait 600ms
      act(() => {
        jest.advanceTimersByTime(600)
      })

      // Change value again
      rerender({ value: 'third' })

      // Wait 400ms (total 1000ms from first change)
      act(() => {
        jest.advanceTimersByTime(400)
      })

      // Should update to third because enough time has passed
      expect(result.current).toBe('third')
    })
  })

  describe('same value updates', () => {
    it('should handle updating to same value', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useThrottle(value, 1000),
        {
          initialProps: { value: 'same' },
        }
      )

      rerender({ value: 'same' })

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current).toBe('same')
    })
  })
})
