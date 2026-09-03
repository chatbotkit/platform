import useAutoRevert from './useAutoRevert'

import { act, renderHook } from '@testing-library/react'

describe('useAutoRevert', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('basic functionality', () => {
    it('should return initial state as false', () => {
      const { result } = renderHook(() => useAutoRevert())

      expect(result.current[0]).toBe(false)
    })

    it('should return state and setter', () => {
      const { result } = renderHook(() => useAutoRevert())

      expect(Array.isArray(result.current)).toBe(true)
      expect(result.current).toHaveLength(2)
      expect(typeof result.current[0]).toBe('boolean')
      expect(typeof result.current[1]).toBe('function')
    })

    it('should allow setting state to true', () => {
      const { result } = renderHook(() => useAutoRevert())

      act(() => {
        result.current[1](true)
      })

      expect(result.current[0]).toBe(true)
    })
  })

  describe('auto-revert functionality', () => {
    it('should auto-revert to false after default delay', () => {
      const { result } = renderHook(() => useAutoRevert())

      act(() => {
        result.current[1](true)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe(false)
    })

    it('should not revert before delay completes', () => {
      const { result } = renderHook(() => useAutoRevert())

      act(() => {
        result.current[1](true)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current[0]).toBe(true)
    })

    it('should use custom delay', () => {
      const { result } = renderHook(() => useAutoRevert({ delay: 2000 }))

      act(() => {
        result.current[1](true)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe(false)
    })

    it('should not auto-revert when state is false', () => {
      const { result } = renderHook(() => useAutoRevert())

      expect(result.current[0]).toBe(false)

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe(false)
    })
  })

  describe('timer cleanup', () => {
    it('should clear timeout on unmount', () => {
      const { result, unmount } = renderHook(() => useAutoRevert())

      act(() => {
        result.current[1](true)
      })

      unmount()

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      // Should not cause any errors
    })

    it('should reset timer when state changes multiple times', () => {
      const { result } = renderHook(() => useAutoRevert())

      act(() => {
        result.current[1](true)
      })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      act(() => {
        result.current[1](false)
      })

      act(() => {
        result.current[1](true)
      })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current[0]).toBe(false)
    })

    it('should handle delay change', () => {
      const { result, rerender } = renderHook(
        ({ delay }) => useAutoRevert({ delay }),
        { initialProps: { delay: 1000 } }
      )

      act(() => {
        result.current[1](true)
      })

      rerender({ delay: 2000 })

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle zero delay', () => {
      const { result } = renderHook(() => useAutoRevert({ delay: 0 }))

      act(() => {
        result.current[1](true)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(0)
      })

      expect(result.current[0]).toBe(false)
    })

    it('should handle very large delay', () => {
      const { result } = renderHook(() => useAutoRevert({ delay: 100000 }))

      act(() => {
        result.current[1](true)
      })

      act(() => {
        jest.advanceTimersByTime(50000)
      })

      expect(result.current[0]).toBe(true)

      act(() => {
        jest.advanceTimersByTime(50000)
      })

      expect(result.current[0]).toBe(false)
    })

    it('should handle rapid state changes', () => {
      const { result } = renderHook(() => useAutoRevert({ delay: 1000 }))

      act(() => {
        result.current[1](true)
        result.current[1](false)
        result.current[1](true)
      })

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe(false)
    })
  })

  describe('options', () => {
    it('should work with empty options object', () => {
      const { result } = renderHook(() => useAutoRevert({}))

      act(() => {
        result.current[1](true)
      })

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe(false)
    })

    it('should work with undefined options', () => {
      const { result } = renderHook(() => useAutoRevert(undefined))

      act(() => {
        result.current[1](true)
      })

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current[0]).toBe(false)
    })
  })
})
