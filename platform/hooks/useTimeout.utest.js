import useTimeout from './useTimeout'

import { renderHook } from '@testing-library/react'

describe('useTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('basic timeout functionality', () => {
    it('should call callback after specified delay', () => {
      const callback = jest.fn()

      renderHook(() => useTimeout(callback, 1000))

      expect(callback).not.toHaveBeenCalled()

      jest.advanceTimersByTime(1000)

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should call callback after different delays', () => {
      const callback = jest.fn()

      renderHook(() => useTimeout(callback, 500))

      jest.advanceTimersByTime(499)
      expect(callback).not.toHaveBeenCalled()

      jest.advanceTimersByTime(1)
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should handle immediate timeout (delay 0)', () => {
      const callback = jest.fn()

      renderHook(() => useTimeout(callback, 0))

      jest.advanceTimersByTime(0)

      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('callback updates', () => {
    it('should use updated callback reference', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      const { rerender } = renderHook(({ cb }) => useTimeout(cb, 1000), {
        initialProps: { cb: callback1 },
      })

      // Update callback before timeout fires
      rerender({ cb: callback2 })

      jest.advanceTimersByTime(1000)

      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).toHaveBeenCalledTimes(1)
    })

    it('should always use latest callback via ref', () => {
      let callbackValue = 'first'
      const callback = jest.fn(() => callbackValue)

      renderHook(() => useTimeout(callback, 1000))

      callbackValue = 'second'

      jest.advanceTimersByTime(1000)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveReturnedWith('second')
    })
  })

  describe('null delay behavior', () => {
    it('should not set timeout when delay is null', () => {
      const callback = jest.fn()

      renderHook(() => useTimeout(callback, null))

      jest.advanceTimersByTime(10000)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should clear existing timeout when delay changes to null', () => {
      const callback = jest.fn()

      const { rerender } = renderHook(
        ({ delay }) => useTimeout(callback, delay),
        { initialProps: { delay: 1000 } }
      )

      // Change delay to null before timeout fires
      rerender({ delay: null })

      jest.advanceTimersByTime(1000)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should start timeout when delay changes from null to number', () => {
      const callback = jest.fn()

      const { rerender } = renderHook(
        ({ delay }) => useTimeout(callback, delay),
        { initialProps: { delay: null } }
      )

      jest.advanceTimersByTime(1000)
      expect(callback).not.toHaveBeenCalled()

      // Change delay from null to 500
      rerender({ delay: 500 })

      jest.advanceTimersByTime(500)
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('delay changes', () => {
    it('should reset timeout when delay changes', () => {
      const callback = jest.fn()

      const { rerender } = renderHook(
        ({ delay }) => useTimeout(callback, delay),
        { initialProps: { delay: 1000 } }
      )

      jest.advanceTimersByTime(500)

      // Change delay to 2000
      rerender({ delay: 2000 })

      // Advance by original remaining time
      jest.advanceTimersByTime(500)
      expect(callback).not.toHaveBeenCalled()

      // Advance by new delay
      jest.advanceTimersByTime(1500)
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('dependency array', () => {
    it('should reset timeout when dependencies change', () => {
      const callback = jest.fn()
      let dep = 'first'

      const { rerender } = renderHook(() => useTimeout(callback, 1000, [dep]))

      jest.advanceTimersByTime(500)

      // Change dependency
      dep = 'second'
      rerender()

      // Advance by original remaining time
      jest.advanceTimersByTime(500)
      expect(callback).not.toHaveBeenCalled()

      // Advance by full delay again
      jest.advanceTimersByTime(1000)
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should handle empty dependency array', () => {
      const callback = jest.fn()

      renderHook(() => useTimeout(callback, 1000, []))

      jest.advanceTimersByTime(1000)

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple dependencies', () => {
      const callback = jest.fn()
      const deps = { a: 1, b: 2 }

      const { rerender } = renderHook(() =>
        useTimeout(callback, 1000, [deps.a, deps.b])
      )

      jest.advanceTimersByTime(500)

      deps.a = 3
      rerender()

      jest.advanceTimersByTime(1500)

      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('cleanup', () => {
    it('should cleanup timeout on unmount', () => {
      const callback = jest.fn()
      const { unmount } = renderHook(() => useTimeout(callback, 1000))

      unmount()

      jest.advanceTimersByTime(1000)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should cleanup timeout when delay changes', () => {
      const callback = jest.fn()

      const { rerender } = renderHook(
        ({ delay }) => useTimeout(callback, delay),
        { initialProps: { delay: 1000 } }
      )

      // Change delay multiple times quickly
      rerender({ delay: 500 })
      rerender({ delay: 2000 })

      // Only the last timeout should fire
      jest.advanceTimersByTime(2000)

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should not throw errors during cleanup', () => {
      const callback = jest.fn()
      const { unmount } = renderHook(() => useTimeout(callback, 1000))

      expect(() => unmount()).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined callback gracefully', () => {
      expect(() => {
        renderHook(() => useTimeout(undefined, 1000))
        jest.advanceTimersByTime(1000)
      }).not.toThrow()
    })

    it('should handle null callback gracefully', () => {
      expect(() => {
        renderHook(() => useTimeout(null, 1000))
        jest.advanceTimersByTime(1000)
      }).not.toThrow()
    })

    it('should handle very large delays', () => {
      const callback = jest.fn()

      renderHook(() => useTimeout(callback, 1000000))

      jest.advanceTimersByTime(999999)
      expect(callback).not.toHaveBeenCalled()

      jest.advanceTimersByTime(1)
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should handle negative delays (treated as 0)', () => {
      const callback = jest.fn()

      renderHook(() => useTimeout(callback, -100))

      jest.advanceTimersByTime(0)

      expect(callback).toHaveBeenCalledTimes(1)
    })
  })
})
