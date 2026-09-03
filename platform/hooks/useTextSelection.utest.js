import useTextSelection from './useTextSelection'

import { act, renderHook } from '@testing-library/react'

describe('useTextSelection', () => {
  let originalGetSelection
  let mockSelection
  let mockRange

  beforeEach(() => {
    jest.clearAllMocks()

    originalGetSelection = window.getSelection

    mockRange = {
      collapsed: false,
      startContainer: document.body,
      endContainer: document.body,
      commonAncestorContainer: document.body,
      cloneContents: jest.fn(() => ({
        textContent: 'selected text',
      })),
      getClientRects: jest.fn(() => [
        {
          toJSON: () => ({
            x: 10,
            y: 20,
            width: 100,
            height: 20,
            top: 20,
            right: 110,
            bottom: 40,
            left: 10,
          }),
        },
      ]),
      getRangeAt: jest.fn(() => mockRange),
    }

    mockSelection = {
      rangeCount: 1,
      getRangeAt: jest.fn(() => mockRange),
    }

    window.getSelection = jest.fn(() => mockSelection)
  })

  afterEach(() => {
    window.getSelection = originalGetSelection
  })

  describe('basic functionality', () => {
    it('should return default state initially', () => {
      const { result } = renderHook(() => useTextSelection())

      expect(result.current.clientRect).toBeUndefined()
      expect(result.current.isCollapsed).toBeUndefined()
      expect(result.current.textContent).toBeUndefined()
    })

    it('should track selection changes', () => {
      const { result } = renderHook(() => useTextSelection())

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })

      expect(result.current.clientRect).toBeDefined()
      expect(result.current.clientRect.x).toBe(10)
      expect(result.current.clientRect.y).toBe(20)
      expect(result.current.textContent).toBe('selected text')
      expect(result.current.isCollapsed).toBe(false)
    })

    it('should update on keyboard events', () => {
      const { result } = renderHook(() => useTextSelection())

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown'))
      })

      expect(result.current.clientRect).toBeDefined()
    })

    it('should update on window resize', () => {
      const { result } = renderHook(() => useTextSelection())

      act(() => {
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current.clientRect).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle no selection', () => {
      mockSelection.rangeCount = 0

      const { result } = renderHook(() => useTextSelection())

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })

      expect(result.current.clientRect).toBeUndefined()
      expect(result.current.isCollapsed).toBeUndefined()
      expect(result.current.textContent).toBeUndefined()
    })

    it('should handle collapsed selection', () => {
      mockRange.collapsed = true

      const { result } = renderHook(() => useTextSelection())

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })

      expect(result.current.isCollapsed).toBe(true)
    })

    it('should handle empty text content', () => {
      mockRange.cloneContents = jest.fn(() => ({
        textContent: '',
      }))

      const { result } = renderHook(() => useTextSelection())

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })

      expect(result.current.textContent).toBeUndefined()
    })

    it('should handle no client rects and fallback to ancestor', () => {
      mockRange.getClientRects = jest.fn(() => [])

      const mockElement = document.createElement('div')

      mockElement.getBoundingClientRect = jest.fn(() => ({
        toJSON: () => ({
          x: 5,
          y: 10,
          width: 50,
          height: 15,
          top: 10,
          right: 55,
          bottom: 25,
          left: 5,
        }),
      }))
      mockRange.commonAncestorContainer = mockElement

      const { result } = renderHook(() => useTextSelection())

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })

      expect(result.current.clientRect).toBeDefined()
      expect(result.current.clientRect.x).toBe(5)
    })

    it('should round client rect values', () => {
      mockRange.getClientRects = jest.fn(() => [
        {
          toJSON: () => ({
            x: 10.4,
            y: 20.6,
            width: 100.2,
            height: 20.8,
            top: 20.6,
            right: 110.6,
            bottom: 40.4,
            left: 10.4,
          }),
        },
      ])

      const { result } = renderHook(() => useTextSelection())

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })

      expect(result.current.clientRect.x).toBe(10)
      expect(result.current.clientRect.y).toBe(21)
      expect(result.current.clientRect.width).toBe(100)
    })
  })

  describe('target filtering', () => {
    it('should filter selection by target element', () => {
      const targetElement = document.createElement('div')

      document.body.appendChild(targetElement)

      mockRange.commonAncestorContainer = document.body

      const { result } = renderHook(() => useTextSelection(targetElement))

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })

      expect(result.current.clientRect).toBeUndefined()

      document.body.removeChild(targetElement)
    })

    it('should accept selection within target element', () => {
      const targetElement = document.createElement('div')

      document.body.appendChild(targetElement)

      mockRange.commonAncestorContainer = targetElement
      mockRange.startContainer = targetElement
      mockRange.endContainer = targetElement

      const { result } = renderHook(() => useTextSelection(targetElement))

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })

      expect(result.current.clientRect).toBeDefined()

      document.body.removeChild(targetElement)
    })

    it('should filter selection by CSS selector', () => {
      const targetElement = document.createElement('div')

      targetElement.className = 'test-selector'
      document.body.appendChild(targetElement)

      mockRange.commonAncestorContainer = targetElement
      mockRange.startContainer = targetElement
      mockRange.endContainer = targetElement

      const { result } = renderHook(() => useTextSelection('.test-selector'))

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })

      expect(result.current.clientRect).toBeDefined()

      document.body.removeChild(targetElement)
    })

    it('should reject selection when start or end outside target', () => {
      const targetElement = document.createElement('div')

      document.body.appendChild(targetElement)

      mockRange.commonAncestorContainer = targetElement
      mockRange.startContainer = targetElement
      mockRange.endContainer = document.body

      const { result } = renderHook(() => useTextSelection(targetElement))

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })

      expect(result.current.clientRect).toBeUndefined()

      document.body.removeChild(targetElement)
    })
  })

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener')
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener')
      const windowAddSpy = jest.spyOn(window, 'addEventListener')
      const windowRemoveSpy = jest.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() => useTextSelection())

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'selectionchange',
        expect.any(Function)
      )
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      )
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keyup',
        expect.any(Function)
      )
      expect(windowAddSpy).toHaveBeenCalledWith('resize', expect.any(Function))

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'selectionchange',
        expect.any(Function)
      )
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      )
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keyup',
        expect.any(Function)
      )
      expect(windowRemoveSpy).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      )

      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
      windowAddSpy.mockRestore()
      windowRemoveSpy.mockRestore()
    })
  })
})
