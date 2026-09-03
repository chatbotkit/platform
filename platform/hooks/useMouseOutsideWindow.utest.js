import useMouseOutsideWindow from './useMouseOutsideWindow'

import { act, renderHook } from '@testing-library/react'

describe('useMouseOutsideWindow', () => {
  describe('initialization', () => {
    it('should initialize with mouse inside window', () => {
      const { result } = renderHook(() => useMouseOutsideWindow())

      expect(result.current).toBe(false)
    })
  })

  describe('mouse tracking', () => {
    it('should detect when mouse leaves window', () => {
      const { result } = renderHook(() => useMouseOutsideWindow())

      expect(result.current).toBe(false)

      act(() => {
        const mouseOutEvent = new MouseEvent('mouseout', {
          relatedTarget: null,
          bubbles: true,
        })

        Object.defineProperty(mouseOutEvent, 'toElement', {
          value: null,
          writable: false,
        })

        window.dispatchEvent(mouseOutEvent)
      })

      expect(result.current).toBe(true)
    })

    it('should detect when mouse returns to window', () => {
      const { result } = renderHook(() => useMouseOutsideWindow())

      // First, mouse leaves window
      act(() => {
        const mouseOutEvent = new MouseEvent('mouseout', {
          relatedTarget: null,
          bubbles: true,
        })

        Object.defineProperty(mouseOutEvent, 'toElement', {
          value: null,
          writable: false,
        })

        window.dispatchEvent(mouseOutEvent)
      })

      expect(result.current).toBe(true)

      // Then, mouse returns to window
      act(() => {
        const mouseOverEvent = new MouseEvent('mouseover', {
          bubbles: true,
        })

        window.dispatchEvent(mouseOverEvent)
      })

      expect(result.current).toBe(false)
    })

    it('should not change state when mouse moves within window', () => {
      const { result } = renderHook(() => useMouseOutsideWindow())

      expect(result.current).toBe(false)

      act(() => {
        const mouseOutEvent = new MouseEvent('mouseout', {
          relatedTarget: document.body,
          bubbles: true,
        })

        window.dispatchEvent(mouseOutEvent)
      })

      // Should still be false because relatedTarget exists
      expect(result.current).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() => useMouseOutsideWindow())

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'mouseout',
        expect.any(Function)
      )
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'mouseover',
        expect.any(Function)
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'mouseout',
        expect.any(Function)
      )
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'mouseover',
        expect.any(Function)
      )

      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('edge cases', () => {
    it('should handle multiple mouseout events', () => {
      const { result } = renderHook(() => useMouseOutsideWindow())

      act(() => {
        const mouseOutEvent1 = new MouseEvent('mouseout', {
          relatedTarget: null,
          bubbles: true,
        })

        Object.defineProperty(mouseOutEvent1, 'toElement', {
          value: null,
          writable: false,
        })

        window.dispatchEvent(mouseOutEvent1)
      })

      expect(result.current).toBe(true)

      act(() => {
        const mouseOutEvent2 = new MouseEvent('mouseout', {
          relatedTarget: null,
          bubbles: true,
        })

        Object.defineProperty(mouseOutEvent2, 'toElement', {
          value: null,
          writable: false,
        })

        window.dispatchEvent(mouseOutEvent2)
      })

      expect(result.current).toBe(true)
    })

    it('should handle rapid mouse movement', () => {
      const { result } = renderHook(() => useMouseOutsideWindow())

      act(() => {
        const mouseOutEvent = new MouseEvent('mouseout', {
          relatedTarget: null,
          bubbles: true,
        })

        Object.defineProperty(mouseOutEvent, 'toElement', {
          value: null,
          writable: false,
        })

        window.dispatchEvent(mouseOutEvent)
      })

      expect(result.current).toBe(true)

      act(() => {
        window.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      })

      expect(result.current).toBe(false)

      act(() => {
        const mouseOutEvent2 = new MouseEvent('mouseout', {
          relatedTarget: null,
          bubbles: true,
        })

        Object.defineProperty(mouseOutEvent2, 'toElement', {
          value: null,
          writable: false,
        })

        window.dispatchEvent(mouseOutEvent2)
      })

      expect(result.current).toBe(true)
    })
  })
})
