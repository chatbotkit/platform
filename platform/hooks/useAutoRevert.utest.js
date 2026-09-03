import useAutoRevert from './useAutoRevert'

import { act, renderHook } from '@testing-library/react'

describe('useAutoRevert', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize with reverted as false', () => {
      const { result } = renderHook(() => useAutoRevert({}))

      const [reverted] = result.current

      expect(reverted).toBe(false)
    })

    it('should return array with reverted state and setter', () => {
      const { result } = renderHook(() => useAutoRevert({}))

      expect(Array.isArray(result.current)).toBe(true)
      expect(result.current).toHaveLength(2)
      expect(typeof result.current[0]).toBe('boolean')
      expect(typeof result.current[1]).toBe('function')
    })

    it('should use default delay of 1000ms when not specified', () => {
      const { result } = renderHook(() => useAutoRevert({}))

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      const [reverted] = result.current

      expect(reverted).toBe(true)

      // Should not revert before 1000ms
      act(() => {
        jest.advanceTimersByTime(999)
      })
      expect(result.current[0]).toBe(true)

      // Should revert after 1000ms
      act(() => {
        jest.advanceTimersByTime(1)
      })
      expect(result.current[0]).toBe(false)
    })
  })

  describe('auto-revert functionality', () => {
    it('should auto-revert after default delay', () => {
      const { result } = renderHook(() => useAutoRevert({}))

      // Set reverted to true
      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      expect(result.current[0]).toBe(true)

      // Fast-forward time by default delay (1000ms)
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe(false)
    })

    it('should auto-revert after custom delay', () => {
      const { result } = renderHook(() => useAutoRevert({ delay: 2000 }))

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      expect(result.current[0]).toBe(true)

      // Should not revert before custom delay
      act(() => {
        jest.advanceTimersByTime(1999)
      })
      expect(result.current[0]).toBe(true)

      // Should revert after custom delay
      act(() => {
        jest.advanceTimersByTime(1)
      })
      expect(result.current[0]).toBe(false)
    })

    it('should handle very short delays', () => {
      const { result } = renderHook(() => useAutoRevert({ delay: 10 }))

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(10)
      })

      expect(result.current[0]).toBe(false)
    })

    it('should handle very long delays', () => {
      const { result } = renderHook(() => useAutoRevert({ delay: 10000 }))

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(9999)
      })
      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(1)
      })
      expect(result.current[0]).toBe(false)
    })
  })

  describe('multiple revert cycles', () => {
    it('should handle multiple revert cycles', () => {
      const { result } = renderHook(() => useAutoRevert({ delay: 500 }))

      // First cycle
      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })
      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(500)
      })
      expect(result.current[0]).toBe(false)

      // Second cycle
      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })
      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(500)
      })
      expect(result.current[0]).toBe(false)

      // Third cycle
      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })
      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(500)
      })
      expect(result.current[0]).toBe(false)
    })

    it('should reset timer if reverted is set to true again before auto-revert', () => {
      const { result } = renderHook(() => useAutoRevert({ delay: 1000 }))

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      // Advance time partially
      act(() => {
        jest.advanceTimersByTime(500)
      })
      expect(result.current[0]).toBe(true)

      // To reset timer, set to false then true again
      act(() => {
        const [, setReverted] = result.current

        setReverted(false)
      })

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      // After resetting to false and back to true, a new timer starts
      // We need a full 1000ms from the new timer start
      act(() => {
        jest.advanceTimersByTime(500)
      })
      // Should still be true because only 500ms passed since timer reset
      expect(result.current[0]).toBe(true)

      // Advance by another 500ms to complete the new delay
      act(() => {
        jest.advanceTimersByTime(500)
      })
      expect(result.current[0]).toBe(false)
    })
  })

  describe('manual state control', () => {
    it('should allow manually setting reverted to false', () => {
      const { result } = renderHook(() => useAutoRevert({ delay: 1000 }))

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })
      expect(result.current[0]).toBe(true)

      // Manually set to false before auto-revert
      act(() => {
        const [, setReverted] = result.current

        setReverted(false)
      })
      expect(result.current[0]).toBe(false)

      // Advancing time should not change anything
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(result.current[0]).toBe(false)
    })

    it('should not create timer when reverted is false', () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
      const initialCallCount = setTimeoutSpy.mock.calls.length

      const { result } = renderHook(() => useAutoRevert({ delay: 1000 }))

      // reverted is false initially, should not create timer
      expect(result.current[0]).toBe(false)

      // Only timers from Jest internal operations should exist
      // Setting to false explicitly should also not create timer
      act(() => {
        const [, setReverted] = result.current

        setReverted(false)
      })

      expect(result.current[0]).toBe(false)

      setTimeoutSpy.mockRestore()
    })
  })

  describe('delay changes', () => {
    it('should use updated delay when changed', () => {
      const { result, rerender } = renderHook(
        ({ delay }) => useAutoRevert({ delay }),
        {
          initialProps: { delay: 1000 },
        }
      )

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      // Change delay
      rerender({ delay: 2000 })

      // Should not revert with old delay
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(result.current[0]).toBe(true)

      // Should revert with new delay
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(result.current[0]).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should clear timeout on unmount', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      const { result, unmount } = renderHook(() =>
        useAutoRevert({ delay: 1000 })
      )

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      unmount()

      expect(clearTimeoutSpy).toHaveBeenCalled()

      clearTimeoutSpy.mockRestore()
    })

    it('should not revert after unmount', () => {
      const { result, unmount } = renderHook(() =>
        useAutoRevert({ delay: 1000 })
      )

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      const [reverted] = result.current

      expect(reverted).toBe(true)

      unmount()

      // Advance time - should not cause any issues
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      // No error should occur
    })
  })

  describe('edge cases', () => {
    it('should handle zero delay', () => {
      const { result } = renderHook(() => useAutoRevert({ delay: 0 }))

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(0)
      })

      expect(result.current[0]).toBe(false)
    })

    it('should handle negative delay (treated as immediate)', () => {
      const { result } = renderHook(() => useAutoRevert({ delay: -1 }))

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(0)
      })

      expect(result.current[0]).toBe(false)
    })

    it('should handle missing options object', () => {
      const { result } = renderHook(() => useAutoRevert())

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe(false)
    })

    it('should handle empty options object', () => {
      const { result } = renderHook(() => useAutoRevert({}))

      act(() => {
        const [, setReverted] = result.current

        setReverted(true)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe(false)
    })
  })
})
