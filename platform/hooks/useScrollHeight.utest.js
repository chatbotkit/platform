import useScrollHeight from './useScrollHeight'

import { act, renderHook } from '@testing-library/react'

describe('useScrollHeight', () => {
  let mockResizeObserver
  let observeCallback

  beforeEach(() => {
    // Mock ResizeObserver
    observeCallback = null
    mockResizeObserver = {
      observe: jest.fn(),
      disconnect: jest.fn(),
    }

    global.ResizeObserver = jest.fn((callback) => {
      observeCallback = callback

      return mockResizeObserver
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with auto height', () => {
      const ref = { current: { scrollHeight: 100 } }
      const { result } = renderHook(() => useScrollHeight(ref, false))

      // Initially returns auto, then updates
      expect(result.current).toBeDefined()
    })

    it('should set initial scroll height from ref', () => {
      const ref = { current: { scrollHeight: 150 } }
      const { result } = renderHook(() => useScrollHeight(ref, false))

      // Height should be set after effect runs
      expect(typeof result.current).toBe('number')
    })

    it('should handle null ref gracefully', () => {
      const ref = { current: null }
      const { result } = renderHook(() => useScrollHeight(ref, false))

      expect(result.current).toBe('auto')
    })
  })

  describe('disabled state', () => {
    it('should not observe when disabled is true', () => {
      const ref = { current: { scrollHeight: 100 } }

      renderHook(() => useScrollHeight(ref, true))

      expect(global.ResizeObserver).not.toHaveBeenCalled()
      expect(mockResizeObserver.observe).not.toHaveBeenCalled()
    })

    it('should return auto when disabled', () => {
      const ref = { current: { scrollHeight: 100 } }
      const { result } = renderHook(() => useScrollHeight(ref, true))

      expect(result.current).toBe('auto')
    })

    it('should stop observing when disabled changes to true', () => {
      const ref = { current: { scrollHeight: 100 } }
      const { rerender } = renderHook(
        ({ disabled }) => useScrollHeight(ref, disabled),
        { initialProps: { disabled: false } }
      )

      expect(mockResizeObserver.observe).toHaveBeenCalled()

      // Clear mocks to check cleanup
      mockResizeObserver.disconnect.mockClear()

      // Change to disabled
      rerender({ disabled: true })

      expect(mockResizeObserver.disconnect).toHaveBeenCalled()
    })
  })

  describe('resize observation', () => {
    it('should create ResizeObserver and observe the element', () => {
      const ref = { current: { scrollHeight: 200 } }

      renderHook(() => useScrollHeight(ref, false))

      expect(global.ResizeObserver).toHaveBeenCalledWith(expect.any(Function))
      expect(mockResizeObserver.observe).toHaveBeenCalledWith(ref.current)
    })

    it('should update height when element resizes', () => {
      const ref = { current: { scrollHeight: 100 } }
      const { result } = renderHook(() => useScrollHeight(ref, false))

      // Initial height
      expect(result.current).toBe(100)

      // Simulate resize
      act(() => {
        ref.current.scrollHeight = 250

        if (observeCallback) {
          observeCallback()
        }
      })

      expect(result.current).toBe(250)
    })

    it('should handle multiple resize events', () => {
      const ref = { current: { scrollHeight: 100 } }
      const { result } = renderHook(() => useScrollHeight(ref, false))

      // First resize
      act(() => {
        ref.current.scrollHeight = 200

        if (observeCallback) {
          observeCallback()
        }
      })
      expect(result.current).toBe(200)

      // Second resize
      act(() => {
        ref.current.scrollHeight = 300

        if (observeCallback) {
          observeCallback()
        }
      })
      expect(result.current).toBe(300)

      // Third resize
      act(() => {
        ref.current.scrollHeight = 150

        if (observeCallback) {
          observeCallback()
        }
      })
      expect(result.current).toBe(150)
    })
  })

  describe('race condition handling', () => {
    it('should handle ref becoming null during resize callback', () => {
      const ref = { current: { scrollHeight: 100 } }
      const { result } = renderHook(() => useScrollHeight(ref, false))

      expect(result.current).toBe(100)

      // Simulate ref becoming null (race condition)
      act(() => {
        ref.current = null

        if (observeCallback) {
          observeCallback()
        }
      })

      // Should not throw and should maintain previous height
      expect(result.current).toBe(100)
    })

    it('should handle element unmounting during observation', () => {
      const ref = { current: { scrollHeight: 100 } }

      renderHook(() => useScrollHeight(ref, false))

      // Simulate element being removed
      ref.current = null

      // Trigger resize callback
      expect(() => {
        if (observeCallback) {
          observeCallback()
        }
      }).not.toThrow()
    })
  })

  describe('cleanup', () => {
    it('should disconnect ResizeObserver on unmount', () => {
      const ref = { current: { scrollHeight: 100 } }
      const { unmount } = renderHook(() => useScrollHeight(ref, false))

      expect(mockResizeObserver.disconnect).not.toHaveBeenCalled()

      unmount()

      expect(mockResizeObserver.disconnect).toHaveBeenCalledTimes(1)
    })

    it('should cleanup when ref changes', () => {
      const ref1 = { current: { scrollHeight: 100 } }
      const { rerender } = renderHook(
        ({ ref }) => useScrollHeight(ref, false),
        {
          initialProps: { ref: ref1 },
        }
      )

      expect(mockResizeObserver.observe).toHaveBeenCalledWith(ref1.current)

      // Clear for next assertion
      mockResizeObserver.disconnect.mockClear()
      mockResizeObserver.observe.mockClear()

      // Change ref
      const ref2 = { current: { scrollHeight: 200 } }

      rerender({ ref: ref2 })

      // Should disconnect old observer and create new one
      expect(mockResizeObserver.disconnect).toHaveBeenCalled()
      expect(mockResizeObserver.observe).toHaveBeenCalledWith(ref2.current)
    })
  })

  describe('edge cases', () => {
    it('should handle zero scroll height', () => {
      const ref = { current: { scrollHeight: 0 } }
      const { result } = renderHook(() => useScrollHeight(ref, false))

      expect(result.current).toBe(0)
    })

    it('should handle very large scroll heights', () => {
      const ref = { current: { scrollHeight: 999999 } }
      const { result } = renderHook(() => useScrollHeight(ref, false))

      expect(result.current).toBe(999999)
    })

    it('should handle rapid disabled state changes', () => {
      const ref = { current: { scrollHeight: 100 } }
      const { rerender } = renderHook(
        ({ disabled }) => useScrollHeight(ref, disabled),
        { initialProps: { disabled: false } }
      )

      // Rapid toggling
      rerender({ disabled: true })
      rerender({ disabled: false })
      rerender({ disabled: true })
      rerender({ disabled: false })

      // Should not throw
      expect(() => rerender({ disabled: true })).not.toThrow()
    })
  })
})
