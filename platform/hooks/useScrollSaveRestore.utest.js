/* eslint-disable @typescript-eslint/no-require-imports */
import useScrollSaveRestore from './useScrollSaveRestore'

import { act, renderHook } from '@testing-library/react'

jest.mock('@/hooks/useAggressiveScrollHeight', () => ({
  __esModule: true,
  default: jest.fn(() => 100),
}))

describe('useScrollSaveRestore', () => {
  let mockRef
  let sessionStorageMock

  beforeEach(() => {
    // Create mock ref with scroll properties
    mockRef = {
      current: {
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 500,
      },
    }

    // Mock sessionStorage
    sessionStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    }

    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageMock,
      writable: true,
    })

    // Mock document.readyState
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      writable: true,
      configurable: true,
    })

    jest.clearAllMocks()
  })

  afterEach(() => {
    // Clean up event listeners
    jest.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should not throw when initialized', () => {
      expect(() => {
        renderHook(() => useScrollSaveRestore(mockRef, 'test-key', false))
      }).not.toThrow()
    })

    it('should handle null ref gracefully', () => {
      const nullRef = { current: null }

      expect(() => {
        renderHook(() => useScrollSaveRestore(nullRef, 'test-key', false))
      }).not.toThrow()
    })
  })

  describe('scroll position restoration', () => {
    it('should restore scroll position from sessionStorage', () => {
      sessionStorageMock.getItem.mockReturnValue('250')

      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true,
      })

      renderHook(() => useScrollSaveRestore(mockRef, 'test-key', false))

      // Wait for effect to run
      act(() => {
        // Trigger any pending effects
      })

      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('test-key')
    })

    it('should handle "full" scroll position value', () => {
      sessionStorageMock.getItem.mockReturnValue('full')

      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true,
      })

      renderHook(() => useScrollSaveRestore(mockRef, 'test-key', false))

      act(() => {
        // Trigger effect
      })

      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('test-key')
    })

    it('should not restore scroll position when disabled', () => {
      sessionStorageMock.getItem.mockReturnValue('250')

      renderHook(() => useScrollSaveRestore(mockRef, 'test-key', true))

      expect(sessionStorageMock.getItem).not.toHaveBeenCalled()
    })

    it('should restore on window load event', () => {
      sessionStorageMock.getItem.mockReturnValue('300')

      renderHook(() => useScrollSaveRestore(mockRef, 'test-key', false))

      act(() => {
        window.dispatchEvent(new Event('load'))
      })

      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('test-key')
    })
  })

  describe('scroll position saving', () => {
    it('should save scroll position on beforeunload', () => {
      mockRef.current.scrollTop = 350

      renderHook(() => useScrollSaveRestore(mockRef, 'save-test-key', false))

      act(() => {
        window.dispatchEvent(new Event('beforeunload'))
      })

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'save-test-key',
        '350'
      )
    })

    it('should save "full" when scrolled to bottom', () => {
      mockRef.current.scrollTop = 500 // scrollHeight (1000) - clientHeight (500) = 500 (maxScroll)
      mockRef.current.scrollHeight = 1000
      mockRef.current.clientHeight = 500

      renderHook(() => useScrollSaveRestore(mockRef, 'bottom-key', false))

      act(() => {
        window.dispatchEvent(new Event('beforeunload'))
      })

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'bottom-key',
        'full'
      )
    })

    it('should not save when ref is null', () => {
      const nullRef = { current: null }

      renderHook(() => useScrollSaveRestore(nullRef, 'null-key', false))

      act(() => {
        window.dispatchEvent(new Event('beforeunload'))
      })

      // Should not crash, but won't save anything
      expect(sessionStorageMock.setItem).not.toHaveBeenCalled()
    })
  })

  describe('disabled state behavior', () => {
    it('should not set up event listeners when disabled', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')

      renderHook(() => useScrollSaveRestore(mockRef, 'disabled-key', true))

      // Should not add load or beforeunload listeners
      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'load',
        expect.any(Function)
      )
      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      )
    })

    it('should not save or restore when disabled changes to true', () => {
      const { rerender } = renderHook(
        ({ disabled }) => useScrollSaveRestore(mockRef, 'change-key', disabled),
        {
          initialProps: { disabled: false },
        }
      )

      // Change to disabled
      rerender({ disabled: true })

      act(() => {
        window.dispatchEvent(new Event('beforeunload'))
      })

      // Should not save when disabled
      expect(sessionStorageMock.setItem).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() =>
        useScrollSaveRestore(mockRef, 'cleanup-key', false)
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'load',
        expect.any(Function)
      )
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      )
    })

    it('should not throw on unmount with null ref', () => {
      const nullRef = { current: null }

      const { unmount } = renderHook(() =>
        useScrollSaveRestore(nullRef, 'cleanup-null-key', false)
      )

      expect(() => unmount()).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle invalid scroll position in sessionStorage', () => {
      sessionStorageMock.getItem.mockReturnValue('invalid')

      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true,
      })

      expect(() => {
        renderHook(() => useScrollSaveRestore(mockRef, 'invalid-key', false))
      }).not.toThrow()
    })

    it('should handle SecurityError when sessionStorage is inaccessible during restore', () => {
      // Simulate cross-origin iframe security restriction
      sessionStorageMock.getItem.mockImplementation(() => {
        const error = new DOMException(
          'The operation is insecure.',
          'SecurityError'
        )

        throw error
      })

      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true,
      })

      expect(() => {
        renderHook(() => useScrollSaveRestore(mockRef, 'security-key', false))
      }).not.toThrow()
    })

    it('should handle SecurityError when sessionStorage is inaccessible during save', () => {
      // Simulate cross-origin iframe security restriction on save
      sessionStorageMock.setItem.mockImplementation(() => {
        const error = new DOMException(
          'The operation is insecure.',
          'SecurityError'
        )

        throw error
      })

      renderHook(() =>
        useScrollSaveRestore(mockRef, 'security-save-key', false)
      )

      expect(() => {
        act(() => {
          window.dispatchEvent(new Event('beforeunload'))
        })
      }).not.toThrow()
    })

    it('should handle sessionStorage access denied error (Chrome)', () => {
      // Simulate Chrome error message
      sessionStorageMock.getItem.mockImplementation(() => {
        const error = new DOMException(
          "Failed to read the 'sessionStorage' property from 'Window': Access is denied for this document.",
          'SecurityError'
        )

        throw error
      })

      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true,
      })

      expect(() => {
        renderHook(() =>
          useScrollSaveRestore(mockRef, 'access-denied-key', false)
        )
      }).not.toThrow()
    })

    it('should handle zero scroll position', () => {
      sessionStorageMock.getItem.mockReturnValue('0')

      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true,
      })

      renderHook(() => useScrollSaveRestore(mockRef, 'zero-key', false))

      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('zero-key')
      // Should not set scrollTop if value is 0 (handled by the function's logic)
    })

    it('should not update scrollTop if it already matches target value', () => {
      mockRef.current.scrollTop = 250
      sessionStorageMock.getItem.mockReturnValue('250')

      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true,
      })

      renderHook(() => useScrollSaveRestore(mockRef, 'same-key', false))

      // scrollTop should remain unchanged since it already matches
      expect(mockRef.current.scrollTop).toBe(250)
    })
  })

  describe('height dependency', () => {
    it('should not restore position when height is not available', () => {
      const useAggressiveScrollHeight =
        require('@/hooks/useAggressiveScrollHeight').default

      useAggressiveScrollHeight.mockReturnValue(0)

      sessionStorageMock.getItem.mockReturnValue('250')

      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true,
      })

      renderHook(() => useScrollSaveRestore(mockRef, 'no-height-key', false))

      // Should not attempt restoration without height
      expect(sessionStorageMock.getItem).not.toHaveBeenCalled()
    })
  })
})
