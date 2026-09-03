import useEntryAnimation from './useEntryAnimation'

import { act, renderHook } from '@testing-library/react'

describe('useEntryAnimation', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('initialization', () => {
    it('should return beforeEnter class initially', () => {
      const { result } = renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'opacity-0',
          afterEnter: 'opacity-100',
        })
      )

      expect(result.current).toBe('opacity-0')
    })

    it('should handle empty beforeEnter and afterEnter', () => {
      const { result } = renderHook(() => useEntryAnimation({}))

      expect(result.current).toBe('')
    })

    it('should return empty string when disabled is true', () => {
      const { result } = renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'opacity-0',
          afterEnter: 'opacity-100',
          disabled: true,
        })
      )

      expect(result.current).toBe('')
    })
  })

  describe('animation transitions', () => {
    it('should transition from beforeEnter to afterEnter after delay', () => {
      const { result } = renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'opacity-0',
          afterEnter: 'opacity-100',
          delay: 100,
        })
      )

      // Initial state
      expect(result.current).toBe('opacity-0')

      // Fast forward time
      act(() => {
        jest.advanceTimersByTime(100)
      })

      // After delay
      expect(result.current).toBe('opacity-100')
    })

    it('should use default delay of 100ms when not specified', () => {
      const { result } = renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'hidden',
          afterEnter: 'visible',
        })
      )

      expect(result.current).toBe('hidden')

      act(() => {
        jest.advanceTimersByTime(99)
      })

      // Still before enter
      expect(result.current).toBe('hidden')

      act(() => {
        jest.advanceTimersByTime(1)
      })

      // Now after enter
      expect(result.current).toBe('visible')
    })

    it('should handle custom delay values', () => {
      const { result } = renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'fade-out',
          afterEnter: 'fade-in',
          delay: 500,
        })
      )

      expect(result.current).toBe('fade-out')

      act(() => {
        jest.advanceTimersByTime(499)
      })

      expect(result.current).toBe('fade-out')

      act(() => {
        jest.advanceTimersByTime(1)
      })

      expect(result.current).toBe('fade-in')
    })

    it('should handle zero delay', () => {
      const { result } = renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'start',
          afterEnter: 'end',
          delay: 0,
        })
      )

      expect(result.current).toBe('start')

      act(() => {
        jest.advanceTimersByTime(0)
      })

      expect(result.current).toBe('end')
    })
  })

  describe('onEnter callback', () => {
    it('should call onEnter after delay', () => {
      const onEnter = jest.fn()

      renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'opacity-0',
          afterEnter: 'opacity-100',
          delay: 100,
          onEnter,
        })
      )

      expect(onEnter).not.toHaveBeenCalled()

      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(onEnter).toHaveBeenCalledTimes(1)
    })

    it('should not call onEnter if unmounted before delay', () => {
      const onEnter = jest.fn()

      const { unmount } = renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'opacity-0',
          afterEnter: 'opacity-100',
          delay: 100,
          onEnter,
        })
      )

      act(() => {
        jest.advanceTimersByTime(50)
      })

      unmount()

      act(() => {
        jest.advanceTimersByTime(50)
      })

      expect(onEnter).not.toHaveBeenCalled()
    })

    it('should handle onEnter being undefined', () => {
      const { result } = renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'opacity-0',
          afterEnter: 'opacity-100',
          delay: 100,
        })
      )

      expect(() => {
        act(() => {
          jest.advanceTimersByTime(100)
        })
      }).not.toThrow()

      expect(result.current).toBe('opacity-100')
    })
  })

  describe('dependency changes', () => {
    it('should reset to beforeEnter when dependsOn changes', () => {
      const { result, rerender } = renderHook(
        ({ dependsOn }) =>
          useEntryAnimation({
            beforeEnter: 'opacity-0',
            afterEnter: 'opacity-100',
            delay: 100,
            dependsOn,
          }),
        { initialProps: { dependsOn: 'initial' } }
      )

      // Initial animation completes
      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBe('opacity-100')

      // Change dependency
      rerender({ dependsOn: 'changed' })

      // Should reset to beforeEnter
      expect(result.current).toBe('opacity-0')

      // And animate again
      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBe('opacity-100')
    })

    it('should call onEnter again when dependsOn changes', () => {
      const onEnter = jest.fn()

      const { rerender } = renderHook(
        ({ dependsOn }) =>
          useEntryAnimation({
            beforeEnter: 'opacity-0',
            afterEnter: 'opacity-100',
            delay: 100,
            dependsOn,
            onEnter,
          }),
        { initialProps: { dependsOn: 'initial' } }
      )

      // First animation
      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(onEnter).toHaveBeenCalledTimes(1)

      // Change dependency
      rerender({ dependsOn: 'changed' })

      // Second animation
      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(onEnter).toHaveBeenCalledTimes(2)
    })

    it('should handle multiple rapid dependency changes', () => {
      const onEnter = jest.fn()

      const { result, rerender } = renderHook(
        ({ dependsOn }) =>
          useEntryAnimation({
            beforeEnter: 'opacity-0',
            afterEnter: 'opacity-100',
            delay: 100,
            dependsOn,
            onEnter,
          }),
        { initialProps: { dependsOn: 1 } }
      )

      // Rapid changes before animation completes
      rerender({ dependsOn: 2 })
      rerender({ dependsOn: 3 })
      rerender({ dependsOn: 4 })

      expect(result.current).toBe('opacity-0')

      // Complete final animation
      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBe('opacity-100')

      // onEnter should only be called once for the final animation
      expect(onEnter).toHaveBeenCalledTimes(1)
    })
  })

  describe('disabled state', () => {
    it('should return empty string when disabled', () => {
      const { result } = renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'opacity-0',
          afterEnter: 'opacity-100',
          disabled: true,
        })
      )

      expect(result.current).toBe('')

      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBe('')
    })

    it('should not call onEnter when disabled', () => {
      const onEnter = jest.fn()

      renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'opacity-0',
          afterEnter: 'opacity-100',
          disabled: true,
          onEnter,
        })
      )

      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(onEnter).not.toHaveBeenCalled()
    })

    it('should handle disabled state changes', () => {
      const { result, rerender } = renderHook(
        ({ disabled }) =>
          useEntryAnimation({
            beforeEnter: 'opacity-0',
            afterEnter: 'opacity-100',
            delay: 100,
            disabled,
          }),
        { initialProps: { disabled: false } }
      )

      expect(result.current).toBe('opacity-0')

      // Enable animation
      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBe('opacity-100')

      // Disable
      rerender({ disabled: true })

      expect(result.current).toBe('')

      // Re-enable
      rerender({ disabled: false })

      expect(result.current).toBe('opacity-0')
    })
  })

  describe('cleanup', () => {
    it('should clear timeout on unmount', () => {
      const { unmount } = renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'opacity-0',
          afterEnter: 'opacity-100',
          delay: 100,
        })
      )

      // Check that timer is scheduled
      expect(jest.getTimerCount()).toBe(1)

      unmount()

      // Timer should be cleared
      expect(jest.getTimerCount()).toBe(0)
    })

    it('should clear previous timeout when delay changes', () => {
      const { rerender } = renderHook(
        ({ delay }) =>
          useEntryAnimation({
            beforeEnter: 'opacity-0',
            afterEnter: 'opacity-100',
            delay,
          }),
        { initialProps: { delay: 100 } }
      )

      expect(jest.getTimerCount()).toBe(1)

      // Change delay
      rerender({ delay: 200 })

      // Should still have one timer (old cleared, new created)
      expect(jest.getTimerCount()).toBe(1)
    })

    it('should clear timeout when dependsOn changes', () => {
      const { rerender } = renderHook(
        ({ dependsOn }) =>
          useEntryAnimation({
            beforeEnter: 'opacity-0',
            afterEnter: 'opacity-100',
            delay: 100,
            dependsOn,
          }),
        { initialProps: { dependsOn: 'initial' } }
      )

      expect(jest.getTimerCount()).toBe(1)

      // Change dependency
      rerender({ dependsOn: 'changed' })

      // Should still have one timer (old cleared, new created)
      expect(jest.getTimerCount()).toBe(1)
    })
  })

  describe('edge cases', () => {
    it('should handle very long delays', () => {
      const { result } = renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'start',
          afterEnter: 'end',
          delay: 10000,
        })
      )

      expect(result.current).toBe('start')

      act(() => {
        jest.advanceTimersByTime(9999)
      })

      expect(result.current).toBe('start')

      act(() => {
        jest.advanceTimersByTime(1)
      })

      expect(result.current).toBe('end')
    })

    it('should handle undefined dependsOn', () => {
      const { result } = renderHook(() =>
        useEntryAnimation({
          beforeEnter: 'opacity-0',
          afterEnter: 'opacity-100',
          delay: 100,
          dependsOn: undefined,
        })
      )

      expect(result.current).toBe('opacity-0')

      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBe('opacity-100')
    })

    it('should handle onEnter changing between renders', () => {
      const onEnter1 = jest.fn()
      const onEnter2 = jest.fn()

      const { rerender } = renderHook(
        ({ onEnter }) =>
          useEntryAnimation({
            beforeEnter: 'opacity-0',
            afterEnter: 'opacity-100',
            delay: 100,
            onEnter,
          }),
        { initialProps: { onEnter: onEnter1 } }
      )

      // Change onEnter before animation completes
      rerender({ onEnter: onEnter2 })

      act(() => {
        jest.advanceTimersByTime(100)
      })

      // Should call the new onEnter
      expect(onEnter1).not.toHaveBeenCalled()
      expect(onEnter2).toHaveBeenCalledTimes(1)
    })
  })
})
