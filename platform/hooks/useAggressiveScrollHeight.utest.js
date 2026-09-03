import useAggressiveScrollHeight from './useAggressiveScrollHeight'

import { act, renderHook } from '@testing-library/react'

describe('useAggressiveScrollHeight', () => {
  let mockRef
  let mockResizeObserver
  let mockMutationObserver
  let resizeCallback
  let mutationCallback
  let windowResizeListener

  beforeEach(() => {
    // Create mock ref with scrollHeight
    mockRef = {
      current: {
        scrollHeight: 100,
      },
    }

    // Mock ResizeObserver
    resizeCallback = null
    mockResizeObserver = {
      observe: jest.fn(),
      disconnect: jest.fn(),
    }

    global.ResizeObserver = jest.fn((callback) => {
      resizeCallback = callback

      return mockResizeObserver
    })

    // Mock MutationObserver
    mutationCallback = null
    mockMutationObserver = {
      observe: jest.fn(),
      disconnect: jest.fn(),
    }

    global.MutationObserver = jest.fn((callback) => {
      mutationCallback = callback

      return mockMutationObserver
    })

    // Mock window.addEventListener
    windowResizeListener = null
    window.addEventListener = jest.fn((event, listener) => {
      if (event === 'resize') {
        windowResizeListener = listener
      }
    })

    window.removeEventListener = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should set height to scrollHeight on mount', () => {
      const { result } = renderHook(() =>
        useAggressiveScrollHeight(mockRef, false)
      )

      // Wait for effect to run
      expect(result.current).toBe(100)
    })

    it('should not set height when disabled', () => {
      const { result } = renderHook(() =>
        useAggressiveScrollHeight(mockRef, true)
      )

      expect(result.current).toBe('auto')
      expect(mockResizeObserver.observe).not.toHaveBeenCalled()
      expect(mockMutationObserver.observe).not.toHaveBeenCalled()
    })

    it('should not set height when ref.current is null', () => {
      const nullRef = { current: null }

      const { result } = renderHook(() =>
        useAggressiveScrollHeight(nullRef, false)
      )

      expect(result.current).toBe('auto')
      expect(mockResizeObserver.observe).not.toHaveBeenCalled()
      expect(mockMutationObserver.observe).not.toHaveBeenCalled()
    })
  })

  describe('observers', () => {
    it('should setup ResizeObserver', () => {
      renderHook(() => useAggressiveScrollHeight(mockRef, false))

      expect(global.ResizeObserver).toHaveBeenCalled()
      expect(mockResizeObserver.observe).toHaveBeenCalledWith(mockRef.current)
    })

    it('should setup MutationObserver with correct options', () => {
      renderHook(() => useAggressiveScrollHeight(mockRef, false))

      expect(global.MutationObserver).toHaveBeenCalled()
      expect(mockMutationObserver.observe).toHaveBeenCalledWith(
        mockRef.current,
        {
          childList: true,
          subtree: true,
          attributes: true,
        }
      )
    })

    it('should setup window resize listener', () => {
      renderHook(() => useAggressiveScrollHeight(mockRef, false))

      expect(window.addEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      )
    })
  })

  describe('height updates', () => {
    it('should update height on ResizeObserver callback', () => {
      const { result } = renderHook(() =>
        useAggressiveScrollHeight(mockRef, false)
      )

      expect(result.current).toBe(100)

      // Change scrollHeight
      mockRef.current.scrollHeight = 200

      // Trigger resize callback
      act(() => {
        resizeCallback()
      })

      expect(result.current).toBe(200)
    })

    it('should update height on MutationObserver callback', () => {
      const { result } = renderHook(() =>
        useAggressiveScrollHeight(mockRef, false)
      )

      expect(result.current).toBe(100)

      // Change scrollHeight
      mockRef.current.scrollHeight = 150

      // Trigger mutation callback
      act(() => {
        mutationCallback()
      })

      expect(result.current).toBe(150)
    })

    it('should update height on window resize', () => {
      const { result } = renderHook(() =>
        useAggressiveScrollHeight(mockRef, false)
      )

      expect(result.current).toBe(100)

      // Change scrollHeight
      mockRef.current.scrollHeight = 250

      // Trigger window resize
      act(() => {
        windowResizeListener()
      })

      expect(result.current).toBe(250)
    })

    it('should handle race condition when ref becomes null', () => {
      const { result } = renderHook(() =>
        useAggressiveScrollHeight(mockRef, false)
      )

      expect(result.current).toBe(100)

      // Simulate component unmount - ref becomes null
      mockRef.current = null

      // Trigger callbacks - should not throw
      act(() => {
        expect(() => resizeCallback()).not.toThrow()
        expect(() => mutationCallback()).not.toThrow()
        expect(() => windowResizeListener()).not.toThrow()
      })

      // Height should remain unchanged
      expect(result.current).toBe(100)
    })
  })

  describe('cleanup', () => {
    it('should disconnect observers on unmount', () => {
      const { unmount } = renderHook(() =>
        useAggressiveScrollHeight(mockRef, false)
      )

      unmount()

      expect(mockResizeObserver.disconnect).toHaveBeenCalled()
      expect(mockMutationObserver.disconnect).toHaveBeenCalled()
    })

    it('should remove window resize listener on unmount', () => {
      const { unmount } = renderHook(() =>
        useAggressiveScrollHeight(mockRef, false)
      )

      unmount()

      expect(window.removeEventListener).toHaveBeenCalledWith(
        'resize',
        windowResizeListener
      )
    })

    it('should cleanup when disabled changes to true', () => {
      const { rerender } = renderHook(
        ({ disabled }) => useAggressiveScrollHeight(mockRef, disabled),
        { initialProps: { disabled: false } }
      )

      expect(mockResizeObserver.observe).toHaveBeenCalled()

      // Change to disabled
      rerender({ disabled: true })

      expect(mockResizeObserver.disconnect).toHaveBeenCalled()
      expect(mockMutationObserver.disconnect).toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('should not setup observers when disabled from start', () => {
      renderHook(() => useAggressiveScrollHeight(mockRef, true))

      expect(mockResizeObserver.observe).not.toHaveBeenCalled()
      expect(mockMutationObserver.observe).not.toHaveBeenCalled()
      expect(window.addEventListener).not.toHaveBeenCalled()
    })

    it('should handle disabled prop changes', () => {
      const { result, rerender } = renderHook(
        ({ disabled }) => useAggressiveScrollHeight(mockRef, disabled),
        { initialProps: { disabled: true } }
      )

      expect(result.current).toBe('auto')

      // Enable
      rerender({ disabled: false })

      expect(result.current).toBe(100)
      expect(mockResizeObserver.observe).toHaveBeenCalled()
    })
  })

  describe('ref changes', () => {
    it('should handle ref changes', () => {
      const { result, rerender } = renderHook(
        ({ ref }) => useAggressiveScrollHeight(ref, false),
        { initialProps: { ref: mockRef } }
      )

      expect(result.current).toBe(100)

      // Create new ref with different scrollHeight
      const newRef = {
        current: {
          scrollHeight: 300,
        },
      }

      // Clear previous mock calls
      jest.clearAllMocks()

      rerender({ ref: newRef })

      expect(result.current).toBe(300)
      expect(mockResizeObserver.observe).toHaveBeenCalledWith(newRef.current)
    })
  })
})
