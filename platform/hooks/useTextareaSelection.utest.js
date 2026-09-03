import { act, renderHook } from '@testing-library/react'

import useTextareaSelection from './useTextareaSelection'

describe('useTextareaSelection', () => {
  let mockTextarea

  beforeEach(() => {
    jest.clearAllMocks()

    mockTextarea = document.createElement('textarea')
    mockTextarea.value = 'Hello World, this is a test'

    document.body.appendChild(mockTextarea)
  })

  afterEach(() => {
    if (mockTextarea && mockTextarea.parentNode) {
      document.body.removeChild(mockTextarea)
    }
  })

  describe('initialization', () => {
    it('should return default state when no textarea provided', () => {
      const { result } = renderHook(() => useTextareaSelection(null))

      expect(result.current.textContent).toBeUndefined()
      expect(result.current.clientRect).toBeUndefined()
      expect(result.current.isCollapsed).toBeUndefined()
      expect(result.current.selectionStart).toBeUndefined()
      expect(result.current.selectionEnd).toBeUndefined()
    })

    it('should return collapsed state when no text is selected', () => {
      mockTextarea.selectionStart = 5
      mockTextarea.selectionEnd = 5

      const { result } = renderHook(() => useTextareaSelection(mockTextarea))

      // @note trigger selection change event
      act(() => {
        mockTextarea.dispatchEvent(new Event('select'))
      })

      expect(result.current.isCollapsed).toBe(true)
      expect(result.current.textContent).toBe('')
    })

    it('should detect selected text', () => {
      mockTextarea.selectionStart = 0
      mockTextarea.selectionEnd = 5

      const { result } = renderHook(() => useTextareaSelection(mockTextarea))

      act(() => {
        mockTextarea.dispatchEvent(new Event('select'))
      })

      expect(result.current.textContent).toBe('Hello')
      expect(result.current.selectionStart).toBe(0)
      expect(result.current.selectionEnd).toBe(5)
      expect(result.current.isCollapsed).toBe(false)
    })
  })

  describe('selection changes', () => {
    it('should update when selection changes', () => {
      mockTextarea.selectionStart = 0
      mockTextarea.selectionEnd = 5

      const { result } = renderHook(() => useTextareaSelection(mockTextarea))

      act(() => {
        mockTextarea.dispatchEvent(new Event('select'))
      })

      expect(result.current.textContent).toBe('Hello')

      // @note change selection
      mockTextarea.selectionStart = 6
      mockTextarea.selectionEnd = 11

      act(() => {
        mockTextarea.dispatchEvent(new Event('select'))
      })

      expect(result.current.textContent).toBe('World')
      expect(result.current.selectionStart).toBe(6)
      expect(result.current.selectionEnd).toBe(11)
    })

    it('should update on mouseup event', () => {
      mockTextarea.selectionStart = 0
      mockTextarea.selectionEnd = 5

      const { result } = renderHook(() => useTextareaSelection(mockTextarea))

      act(() => {
        mockTextarea.dispatchEvent(new Event('mouseup'))
      })

      expect(result.current.textContent).toBe('Hello')
    })

    it('should update on keyup event', () => {
      mockTextarea.selectionStart = 0
      mockTextarea.selectionEnd = 5

      const { result } = renderHook(() => useTextareaSelection(mockTextarea))

      act(() => {
        mockTextarea.dispatchEvent(new Event('keyup'))
      })

      expect(result.current.textContent).toBe('Hello')
    })
  })

  describe('edge cases', () => {
    it('should handle empty textarea', () => {
      mockTextarea.value = ''
      mockTextarea.selectionStart = 0
      mockTextarea.selectionEnd = 0

      const { result } = renderHook(() => useTextareaSelection(mockTextarea))

      act(() => {
        mockTextarea.dispatchEvent(new Event('select'))
      })

      expect(result.current.isCollapsed).toBe(true)
      expect(result.current.textContent).toBe('')
    })

    it('should handle full text selection', () => {
      mockTextarea.selectionStart = 0
      mockTextarea.selectionEnd = mockTextarea.value.length

      const { result } = renderHook(() => useTextareaSelection(mockTextarea))

      act(() => {
        mockTextarea.dispatchEvent(new Event('select'))
      })

      expect(result.current.textContent).toBe('Hello World, this is a test')
    })

    it('should calculate clientRect for selection', () => {
      // @note add some basic styling so getBoundingClientRect works
      mockTextarea.style.width = '300px'
      mockTextarea.style.height = '100px'
      mockTextarea.style.fontSize = '16px'
      mockTextarea.style.fontFamily = 'monospace'
      mockTextarea.style.position = 'absolute'
      mockTextarea.style.top = '100px'
      mockTextarea.style.left = '100px'

      mockTextarea.selectionStart = 0
      mockTextarea.selectionEnd = 5

      const { result } = renderHook(() => useTextareaSelection(mockTextarea))

      act(() => {
        mockTextarea.dispatchEvent(new Event('select'))
      })

      // @note just verify clientRect is present with valid properties
      expect(result.current.clientRect).toBeDefined()

      if (result.current.clientRect) {
        expect(typeof result.current.clientRect.top).toBe('number')
        expect(typeof result.current.clientRect.left).toBe('number')
        expect(typeof result.current.clientRect.width).toBe('number')
        expect(typeof result.current.clientRect.height).toBe('number')
      }
    })
  })

  describe('cleanup', () => {
    it('should clean up event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(
        mockTextarea,
        'removeEventListener'
      )

      const { unmount } = renderHook(() => useTextareaSelection(mockTextarea))

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'select',
        expect.any(Function)
      )
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'mouseup',
        expect.any(Function)
      )
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keyup',
        expect.any(Function)
      )

      removeEventListenerSpy.mockRestore()
    })
  })
})
