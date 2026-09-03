import useIsScrolled from './useIsContainerScrolled'

import { act, renderHook } from '@testing-library/react'

describe('useIsContainerScrolled', () => {
  let mockRef

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Create mock ref with scrollable container properties
    mockRef = {
      current: {
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 500,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    }

    // Mock ResizeObserver
    global.ResizeObserver = jest.fn().mockImplementation((callback) => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
      callback,
    }))
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize with default value false', () => {
      const { result } = renderHook(() => useIsScrolled(mockRef))

      expect(result.current).toBe(false)
    })

    it('should initialize with custom default value', () => {
      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { defaultValue: true })
      )

      expect(result.current).toBe(true)
    })

    it('should handle null ref gracefully', () => {
      const nullRef = { current: null }
      const { result } = renderHook(() => useIsScrolled(nullRef))

      expect(result.current).toBe(false)
    })

    it('should handle undefined ref gracefully', () => {
      const { result } = renderHook(() => useIsScrolled(undefined))

      expect(result.current).toBe(false)
    })
  })

  describe('scroll detection - top anchor', () => {
    it('should detect when scrolled at top with zero threshold', () => {
      mockRef.current.scrollTop = 0

      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { anchor: 'top', threshold: 0 })
      )

      act(() => {
        jest.runAllTimers()
      })

      expect(result.current).toBe(true)
    })

    it('should detect when scrolled away from top', () => {
      mockRef.current.scrollTop = 10

      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { anchor: 'top', threshold: 0 })
      )

      act(() => {
        jest.runAllTimers()
      })

      expect(result.current).toBe(false)
    })

    it('should handle threshold for top anchor', () => {
      mockRef.current.scrollTop = 5

      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { anchor: 'top', threshold: 10 })
      )

      act(() => {
        jest.runAllTimers()
      })

      expect(result.current).toBe(true)
    })

    it('should detect scrolled past threshold for top anchor', () => {
      mockRef.current.scrollTop = 15

      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { anchor: 'top', threshold: 10 })
      )

      act(() => {
        jest.runAllTimers()
      })

      expect(result.current).toBe(false)
    })
  })

  describe('scroll detection - bottom anchor', () => {
    it('should detect when scrolled to bottom', () => {
      mockRef.current.scrollTop = 500 // scrollHeight (1000) - clientHeight (500)

      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { anchor: 'bottom', threshold: 0 })
      )

      act(() => {
        jest.runAllTimers()
      })

      expect(result.current).toBe(true)
    })

    it('should detect when not at bottom', () => {
      mockRef.current.scrollTop = 400

      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { anchor: 'bottom', threshold: 0 })
      )

      act(() => {
        jest.runAllTimers()
      })

      expect(result.current).toBe(false)
    })

    it('should handle threshold for bottom anchor', () => {
      mockRef.current.scrollTop = 490 // 10px away from bottom

      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { anchor: 'bottom', threshold: 15 })
      )

      act(() => {
        jest.runAllTimers()
      })

      expect(result.current).toBe(true)
    })

    it('should apply minimum 2px threshold for bottom anchor', () => {
      // scrollHeight (1000) - scrollTop (498) - clientHeight (500) = 2
      mockRef.current.scrollTop = 498

      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { anchor: 'bottom', threshold: 0 })
      )

      act(() => {
        jest.runAllTimers()
      })

      expect(result.current).toBe(true)
    })
  })

  describe('scroll event handling', () => {
    it('should attach scroll event listener', () => {
      renderHook(() => useIsScrolled(mockRef))

      expect(mockRef.current.addEventListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function)
      )
    })

    it('should remove scroll event listener on unmount', () => {
      const { unmount } = renderHook(() => useIsScrolled(mockRef))

      const scrollHandler = mockRef.current.addEventListener.mock.calls.find(
        (call) => call[0] === 'scroll'
      )?.[1]

      unmount()

      expect(mockRef.current.removeEventListener).toHaveBeenCalledWith(
        'scroll',
        scrollHandler
      )
    })

    it('should update state on scroll event', () => {
      const { result } = renderHook(() => useIsScrolled(mockRef))

      // Initial state
      expect(result.current).toBe(false)

      // Get the scroll handler
      const scrollHandler = mockRef.current.addEventListener.mock.calls.find(
        (call) => call[0] === 'scroll'
      )?.[1]

      // Simulate scroll to top
      mockRef.current.scrollTop = 0

      act(() => {
        scrollHandler()
        jest.runAllTimers()
      })

      expect(result.current).toBe(true)
    })

    it('should apply delay to scroll event handler', () => {
      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { delay: 100 })
      )

      const scrollHandler = mockRef.current.addEventListener.mock.calls.find(
        (call) => call[0] === 'scroll'
      )?.[1]

      mockRef.current.scrollTop = 0

      act(() => {
        scrollHandler()
      })

      // State should not update immediately
      expect(result.current).toBe(false)

      act(() => {
        jest.advanceTimersByTime(100)
      })

      // State should update after delay
      expect(result.current).toBe(true)
    })
  })

  describe('ResizeObserver integration', () => {
    it('should create ResizeObserver', () => {
      renderHook(() => useIsScrolled(mockRef))

      expect(global.ResizeObserver).toHaveBeenCalled()
    })

    it('should observe the ref element', () => {
      const mockObserve = jest.fn()

      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: mockObserve,
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      }))

      renderHook(() => useIsScrolled(mockRef))

      expect(mockObserve).toHaveBeenCalledWith(mockRef.current)
    })

    it('should unobserve on unmount', () => {
      const mockUnobserve = jest.fn()

      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: mockUnobserve,
        disconnect: jest.fn(),
      }))

      const { unmount } = renderHook(() => useIsScrolled(mockRef))

      unmount()

      expect(mockUnobserve).toHaveBeenCalledWith(mockRef.current)
    })

    it('should apply delay to resize handler', () => {
      let resizeCallback

      global.ResizeObserver = jest.fn().mockImplementation((callback) => {
        resizeCallback = callback

        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        }
      })

      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { delay: 100 })
      )

      mockRef.current.scrollTop = 0

      act(() => {
        resizeCallback()
      })

      // State should not update immediately
      expect(result.current).toBe(false)

      act(() => {
        jest.advanceTimersByTime(100)
      })

      // State should update after delay
      expect(result.current).toBe(true)
    })
  })

  describe('interval-based updates', () => {
    it('should not set interval when interval is 0', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval')

      renderHook(() => useIsScrolled(mockRef, { interval: 0 }))

      // setInterval might be called for other purposes, but not for our interval
      const intervalCalls = setIntervalSpy.mock.calls.filter(
        (call) => call[1] === 0
      )

      expect(intervalCalls.length).toBe(0)

      setIntervalSpy.mockRestore()
    })

    it('should set interval when interval is provided', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval')

      renderHook(() => useIsScrolled(mockRef, { interval: 100 }))

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 100)

      setIntervalSpy.mockRestore()
    })

    it('should clear interval on unmount', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      const { unmount } = renderHook(() =>
        useIsScrolled(mockRef, { interval: 100 })
      )

      unmount()

      expect(clearIntervalSpy).toHaveBeenCalled()

      clearIntervalSpy.mockRestore()
    })

    it('should update state on interval', () => {
      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { interval: 100 })
      )

      mockRef.current.scrollTop = 0

      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle ref changing to null', () => {
      const { rerender } = renderHook(
        ({ ref }) => useIsScrolled(ref, { anchor: 'top' }),
        { initialProps: { ref: mockRef } }
      )

      const nullRef = { current: null }

      expect(() => {
        rerender({ ref: nullRef })
      }).not.toThrow()
    })

    it('should handle negative scrollTop', () => {
      mockRef.current.scrollTop = -10

      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { anchor: 'top', threshold: 0 })
      )

      act(() => {
        jest.runAllTimers()
      })

      expect(result.current).toBe(true)
    })

    it('should handle very large scroll values', () => {
      mockRef.current.scrollTop = 999999
      mockRef.current.scrollHeight = 1000000
      mockRef.current.clientHeight = 500

      const { result } = renderHook(() =>
        useIsScrolled(mockRef, { anchor: 'bottom' })
      )

      act(() => {
        jest.runAllTimers()
      })

      // Should be at bottom
      expect(result.current).toBe(true)
    })

    it('should handle simultaneous scroll and resize', () => {
      let resizeCallback

      global.ResizeObserver = jest.fn().mockImplementation((callback) => {
        resizeCallback = callback

        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        }
      })

      const { result } = renderHook(() => useIsScrolled(mockRef))

      const scrollHandler = mockRef.current.addEventListener.mock.calls.find(
        (call) => call[0] === 'scroll'
      )?.[1]

      mockRef.current.scrollTop = 0

      act(() => {
        scrollHandler()
        resizeCallback()
        jest.runAllTimers()
      })

      expect(result.current).toBe(true)
    })
  })

  describe('option combinations', () => {
    it('should handle all options together', () => {
      const { result } = renderHook(() =>
        useIsScrolled(mockRef, {
          anchor: 'bottom',
          threshold: 10,
          interval: 100,
          delay: 50,
          defaultValue: true,
        })
      )

      expect(result.current).toBe(true)
    })

    it('should prioritize anchor setting', () => {
      mockRef.current.scrollTop = 0

      const { result: topResult } = renderHook(() =>
        useIsScrolled(mockRef, { anchor: 'top' })
      )

      const { result: bottomResult } = renderHook(() =>
        useIsScrolled(mockRef, { anchor: 'bottom' })
      )

      act(() => {
        jest.runAllTimers()
      })

      expect(topResult.current).toBe(true)
      expect(bottomResult.current).toBe(false)
    })
  })
})
