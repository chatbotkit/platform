import useWindowFocus from './useWindowFocus'

import { renderHook, waitFor } from '@testing-library/react'

describe('useWindowFocus', () => {
  describe('initialization', () => {
    it('should return initial focus state', () => {
      const { result } = renderHook(() => useWindowFocus())

      expect(typeof result.current).toBe('boolean')
    })

    it('should return true when window has focus', () => {
      jest.spyOn(document, 'hasFocus').mockReturnValue(true)

      const { result } = renderHook(() => useWindowFocus())

      expect(result.current).toBe(true)
    })

    it('should return false when window does not have focus', () => {
      jest.spyOn(document, 'hasFocus').mockReturnValue(false)

      const { result } = renderHook(() => useWindowFocus())

      expect(result.current).toBe(false)
    })
  })

  describe('focus events', () => {
    it('should update to true when window gains focus', async () => {
      jest.spyOn(document, 'hasFocus').mockReturnValue(false)

      const { result } = renderHook(() => useWindowFocus())

      expect(result.current).toBe(false)

      // Simulate window focus event
      window.dispatchEvent(new Event('focus'))

      await waitFor(() => {
        expect(result.current).toBe(true)
      })
    })

    it('should update to false when window loses focus', async () => {
      jest.spyOn(document, 'hasFocus').mockReturnValue(true)

      const { result } = renderHook(() => useWindowFocus())

      expect(result.current).toBe(true)

      // Simulate window blur event
      window.dispatchEvent(new Event('blur'))

      await waitFor(() => {
        expect(result.current).toBe(false)
      })
    })

    it('should handle multiple focus/blur cycles', async () => {
      jest.spyOn(document, 'hasFocus').mockReturnValue(true)

      const { result } = renderHook(() => useWindowFocus())

      expect(result.current).toBe(true)

      // Blur
      window.dispatchEvent(new Event('blur'))
      await waitFor(() => {
        expect(result.current).toBe(false)
      })

      // Focus
      window.dispatchEvent(new Event('focus'))
      await waitFor(() => {
        expect(result.current).toBe(true)
      })

      // Blur again
      window.dispatchEvent(new Event('blur'))
      await waitFor(() => {
        expect(result.current).toBe(false)
      })
    })
  })

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() => useWindowFocus())

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'focus',
        expect.any(Function)
      )
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'blur',
        expect.any(Function)
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'focus',
        expect.any(Function)
      )
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'blur',
        expect.any(Function)
      )

      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })
  })
})
