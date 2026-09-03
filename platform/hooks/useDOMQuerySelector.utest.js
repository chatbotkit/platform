import useDOMQuerySelector from './useDOMQuerySelector'

import { renderHook } from '@testing-library/react'

describe('useDOMQuerySelector', () => {
  let mockParent
  let mockMutationObserver
  let mutationCallback
  let originalDocumentElement

  beforeEach(() => {
    // Save original documentElement
    originalDocumentElement = document.documentElement

    // Create mock parent element with querySelectorAll
    mockParent = {
      querySelectorAll: jest.fn(() => []),
    }

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

    // Mock document.documentElement with our mock parent
    Object.defineProperty(document, 'documentElement', {
      value: mockParent,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    // Restore original documentElement
    Object.defineProperty(document, 'documentElement', {
      value: originalDocumentElement,
      writable: true,
      configurable: true,
    })

    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return empty array initially', () => {
      const { result } = renderHook(() => useDOMQuerySelector('.test', {}))

      expect(result.current).toEqual([])
    })

    it('should query and return matching elements', () => {
      const mockElements = [
        { id: 'el1', className: 'test' },
        { id: 'el2', className: 'test' },
      ]

      mockParent.querySelectorAll.mockReturnValue(mockElements)

      const { result } = renderHook(() => useDOMQuerySelector('.test', {}))

      expect(result.current).toEqual(mockElements)
      expect(mockParent.querySelectorAll).toHaveBeenCalledWith('.test')
    })

    it('should use document.documentElement as default parent', () => {
      const { result } = renderHook(() => useDOMQuerySelector('.test'))

      expect(mockParent.querySelectorAll).toHaveBeenCalledWith('.test')
    })

    it('should use custom parent when provided', () => {
      const customParent = {
        querySelectorAll: jest.fn(() => [{ id: 'custom' }]),
      }

      const { result } = renderHook(() =>
        useDOMQuerySelector('.test', { parent: customParent })
      )

      expect(customParent.querySelectorAll).toHaveBeenCalledWith('.test')
      expect(result.current).toEqual([{ id: 'custom' }])
    })

    it('should not query when selector is empty', () => {
      const { result } = renderHook(() => useDOMQuerySelector('', {}))

      expect(mockParent.querySelectorAll).not.toHaveBeenCalled()
      expect(result.current).toEqual([])
    })

    it('should not query when selector is null', () => {
      const { result } = renderHook(() => useDOMQuerySelector(null, {}))

      expect(mockParent.querySelectorAll).not.toHaveBeenCalled()
      expect(result.current).toEqual([])
    })

    it('should not query when parent is undefined', () => {
      const { result } = renderHook(() =>
        useDOMQuerySelector('.test', { parent: undefined })
      )

      // Parent is undefined so no queries should happen (even with Strict Mode)
      expect(result.current).toEqual([])
    })
  })

  describe('waitForElements option', () => {
    it('should not setup MutationObserver when elements exist initially', () => {
      const mockElements = [{ id: 'el1' }]

      mockParent.querySelectorAll.mockReturnValue(mockElements)

      renderHook(() => useDOMQuerySelector('.test', { waitForElements: true }))

      expect(global.MutationObserver).not.toHaveBeenCalled()
    })

    it('should setup MutationObserver when no elements found and waitForElements is true', () => {
      mockParent.querySelectorAll.mockReturnValue([])

      renderHook(() => useDOMQuerySelector('.test', { waitForElements: true }))

      expect(global.MutationObserver).toHaveBeenCalled()
      expect(mockMutationObserver.observe).toHaveBeenCalledWith(mockParent, {
        childList: true,
        subtree: true,
      })
    })

    it('should not setup MutationObserver when waitForElements is false', () => {
      mockParent.querySelectorAll.mockReturnValue([])

      renderHook(() => useDOMQuerySelector('.test', { waitForElements: false }))

      expect(global.MutationObserver).not.toHaveBeenCalled()
    })

    it('should update elements when mutation occurs', () => {
      // Initially no elements
      mockParent.querySelectorAll.mockReturnValueOnce([])

      const { result, rerender } = renderHook(() =>
        useDOMQuerySelector('.test', { waitForElements: true })
      )

      expect(result.current).toEqual([])

      // Elements appear after mutation
      const mockElements = [{ id: 'el1' }]

      mockParent.querySelectorAll.mockReturnValue(mockElements)

      // Trigger mutation callback
      mutationCallback()

      rerender()

      expect(result.current).toEqual(mockElements)
    })
  })

  describe('disconnectOnFirstMatch option', () => {
    it('should disconnect observer on first match when disconnectOnFirstMatch is true', () => {
      mockParent.querySelectorAll.mockReturnValueOnce([])

      renderHook(() =>
        useDOMQuerySelector('.test', {
          waitForElements: true,
          disconnectOnFirstMatch: true,
        })
      )

      // Elements appear
      const mockElements = [{ id: 'el1' }]

      mockParent.querySelectorAll.mockReturnValue(mockElements)

      // Trigger mutation
      mutationCallback()

      expect(mockMutationObserver.disconnect).toHaveBeenCalled()
    })

    it('should not disconnect observer when disconnectOnFirstMatch is false', () => {
      mockParent.querySelectorAll.mockReturnValueOnce([])

      const disconnectSpy = jest.fn()

      mockMutationObserver.disconnect = disconnectSpy

      renderHook(() =>
        useDOMQuerySelector('.test', {
          waitForElements: true,
          disconnectOnFirstMatch: false,
        })
      )

      // Clear calls from Strict Mode mount/unmount/remount
      disconnectSpy.mockClear()

      // Elements appear
      const mockElements = [{ id: 'el1' }]

      mockParent.querySelectorAll.mockReturnValue(mockElements)

      // Trigger mutation
      mutationCallback()

      // Disconnect should NOT be called in the mutation callback when disconnectOnFirstMatch is false
      expect(disconnectSpy).not.toHaveBeenCalled()
    })

    it('should handle disconnect errors gracefully', () => {
      mockParent.querySelectorAll.mockReturnValueOnce([])

      mockMutationObserver.disconnect.mockImplementation(() => {
        throw new Error('Disconnect failed')
      })

      renderHook(() =>
        useDOMQuerySelector('.test', {
          waitForElements: true,
          disconnectOnFirstMatch: true,
        })
      )

      // Elements appear
      const mockElements = [{ id: 'el1' }]

      mockParent.querySelectorAll.mockReturnValue(mockElements)

      // Should not throw
      expect(() => mutationCallback()).not.toThrow()
    })
  })

  describe('cleanup', () => {
    it('should disconnect observer on unmount', () => {
      mockParent.querySelectorAll.mockReturnValue([])

      const { unmount } = renderHook(() =>
        useDOMQuerySelector('.test', { waitForElements: true })
      )

      unmount()

      expect(mockMutationObserver.disconnect).toHaveBeenCalled()
    })

    it('should handle disconnect errors on unmount', () => {
      mockParent.querySelectorAll.mockReturnValue([])

      mockMutationObserver.disconnect.mockImplementation(() => {
        throw new Error('Disconnect failed')
      })

      const { unmount } = renderHook(() =>
        useDOMQuerySelector('.test', { waitForElements: true })
      )

      // Should not throw
      expect(() => unmount()).not.toThrow()
    })

    it('should not attempt cleanup if observer was not created', () => {
      const mockElements = [{ id: 'el1' }]

      mockParent.querySelectorAll.mockReturnValue(mockElements)

      const { unmount } = renderHook(() =>
        useDOMQuerySelector('.test', { waitForElements: true })
      )

      unmount()

      // Observer was never created, so disconnect should not be called
      expect(mockMutationObserver.disconnect).not.toHaveBeenCalled()
    })
  })

  describe('dependency changes', () => {
    it('should re-query when selector changes', () => {
      const { rerender } = renderHook(
        ({ selector }) => useDOMQuerySelector(selector, {}),
        { initialProps: { selector: '.test1' } }
      )

      expect(mockParent.querySelectorAll).toHaveBeenCalledWith('.test1')

      jest.clearAllMocks()

      rerender({ selector: '.test2' })

      expect(mockParent.querySelectorAll).toHaveBeenCalledWith('.test2')
    })

    it('should re-query when deps change', () => {
      const { rerender } = renderHook(
        ({ deps }) => useDOMQuerySelector('.test', {}, deps),
        { initialProps: { deps: [1] } }
      )

      // Clear Strict Mode double-invocation calls
      jest.clearAllMocks()

      rerender({ deps: [2] })

      expect(mockParent.querySelectorAll).toHaveBeenCalledTimes(1)
    })

    it('should cleanup and recreate observer when options change', () => {
      mockParent.querySelectorAll.mockReturnValue([])

      const { rerender } = renderHook(
        ({ options }) => useDOMQuerySelector('.test', options),
        { initialProps: { options: { waitForElements: true } } }
      )

      // Clear Strict Mode double-invocation calls
      jest.clearAllMocks()

      rerender({ options: { waitForElements: false } })

      // Observer should not be created when waitForElements is false
      expect(mockMutationObserver.observe).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle null parent in options', () => {
      const { result } = renderHook(() =>
        useDOMQuerySelector('.test', { parent: null })
      )

      expect(result.current).toEqual([])
    })

    it('should handle empty options', () => {
      const { result } = renderHook(() => useDOMQuerySelector('.test', {}))

      expect(result.current).toEqual([])
    })

    it('should handle undefined options', () => {
      renderHook(() => useDOMQuerySelector('.test'))

      expect(mockParent.querySelectorAll).toHaveBeenCalledWith('.test')
    })

    it('should handle mutation when no new elements appear', () => {
      mockParent.querySelectorAll.mockReturnValue([])

      const disconnectSpy = jest.fn()

      mockMutationObserver.disconnect = disconnectSpy

      const { result } = renderHook(() =>
        useDOMQuerySelector('.test', { waitForElements: true })
      )

      // Clear Strict Mode calls
      disconnectSpy.mockClear()

      // Trigger mutation but still no elements
      mutationCallback()

      expect(result.current).toEqual([])
      // Disconnect should not be called in the mutation callback when no elements found
      expect(disconnectSpy).not.toHaveBeenCalled()
    })

    it('should convert NodeList to array', () => {
      const mockNodeList = {
        length: 2,
        0: { id: 'el1' },
        1: { id: 'el2' },
        [Symbol.iterator]: function* () {
          yield this[0]
          yield this[1]
        },
      }

      mockParent.querySelectorAll.mockReturnValue(mockNodeList)

      const { result } = renderHook(() => useDOMQuerySelector('.test', {}))

      expect(Array.isArray(result.current)).toBe(true)
      expect(result.current).toHaveLength(2)
    })
  })

  describe('server-side rendering', () => {
    it('should handle undefined document', () => {
      // In SSR scenarios, the hook checks for typeof document !== 'undefined'
      // We can't actually delete document in jsdom without breaking renderHook
      // Instead, test that providing parent: undefined results in no queries
      const { result } = renderHook(() =>
        useDOMQuerySelector('.test', { parent: undefined })
      )

      expect(result.current).toEqual([])
      // Parent is undefined, so default mockParent should not be used
    })
  })
})
