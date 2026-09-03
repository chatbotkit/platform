import useComboKeybinding from './useComboKeyBinding'

import { renderHook } from '@testing-library/react'

describe('useComboKeyBinding', () => {
  let originalPlatform
  let addEventListenerSpy
  let removeEventListenerSpy
  let mockAction

  beforeEach(() => {
    originalPlatform = navigator.platform
    addEventListenerSpy = jest.spyOn(window, 'addEventListener')
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')
    mockAction = jest.fn()

    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true,
    })
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
    jest.clearAllMocks()
  })

  describe('event listener setup', () => {
    it('should add keydown event listener on mount', () => {
      renderHook(() => useComboKeybinding('s', mockAction))

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      )
    })

    it('should remove keydown event listener on unmount', () => {
      const { unmount } = renderHook(() => useComboKeybinding('s', mockAction))

      const handler = addEventListenerSpy.mock.calls[0][1]

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', handler)
    })

    it('should update listener when key changes', () => {
      const { rerender } = renderHook(
        ({ key, action }) => useComboKeybinding(key, action),
        {
          initialProps: { key: 's', action: mockAction },
        }
      )

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1)

      rerender({ key: 'k', action: mockAction })

      expect(removeEventListenerSpy).toHaveBeenCalledTimes(1)
      expect(addEventListenerSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('Windows/Linux platform (Ctrl key)', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      })
    })

    it('should trigger action on Ctrl+key press', () => {
      renderHook(() => useComboKeybinding('s', mockAction))

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        metaKey: false,
      })

      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn(),
      })
      Object.defineProperty(event, 'stopPropagation', {
        value: jest.fn(),
      })

      handler(event)

      expect(mockAction).toHaveBeenCalledTimes(1)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopPropagation).toHaveBeenCalled()
    })

    it('should not trigger action without Ctrl key', () => {
      renderHook(() => useComboKeybinding('s', mockAction))

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: false,
        metaKey: false,
      })

      handler(event)

      expect(mockAction).not.toHaveBeenCalled()
    })

    it('should not trigger action with metaKey on Windows', () => {
      renderHook(() => useComboKeybinding('s', mockAction))

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: false,
        metaKey: true,
      })

      handler(event)

      expect(mockAction).not.toHaveBeenCalled()
    })
  })

  describe('Mac platform (Cmd key)', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
        configurable: true,
      })
    })

    it('should trigger action on Cmd+key press', () => {
      renderHook(() => useComboKeybinding('s', mockAction))

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: false,
        metaKey: true,
      })

      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn(),
      })
      Object.defineProperty(event, 'stopPropagation', {
        value: jest.fn(),
      })

      handler(event)

      expect(mockAction).toHaveBeenCalledTimes(1)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopPropagation).toHaveBeenCalled()
    })

    it('should not trigger action without metaKey', () => {
      renderHook(() => useComboKeybinding('s', mockAction))

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: false,
        metaKey: false,
      })

      handler(event)

      expect(mockAction).not.toHaveBeenCalled()
    })

    it('should not trigger action with ctrlKey on Mac', () => {
      renderHook(() => useComboKeybinding('s', mockAction))

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        metaKey: false,
      })

      handler(event)

      expect(mockAction).not.toHaveBeenCalled()
    })
  })

  describe('element skipping', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      })
    })

    it('should skip action when textarea is focused', () => {
      renderHook(() => useComboKeybinding('s', mockAction))

      const textarea = document.createElement('textarea')

      document.body.appendChild(textarea)
      textarea.focus()

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      })

      handler(event)

      expect(mockAction).not.toHaveBeenCalled()

      document.body.removeChild(textarea)
    })

    it('should skip action when input is focused', () => {
      renderHook(() => useComboKeybinding('s', mockAction))

      const input = document.createElement('input')

      document.body.appendChild(input)
      input.focus()

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      })

      handler(event)

      expect(mockAction).not.toHaveBeenCalled()

      document.body.removeChild(input)
    })

    it('should trigger action when button is focused', () => {
      renderHook(() => useComboKeybinding('s', mockAction))

      const button = document.createElement('button')

      document.body.appendChild(button)
      button.focus()

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      })

      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn(),
      })
      Object.defineProperty(event, 'stopPropagation', {
        value: jest.fn(),
      })

      handler(event)

      expect(mockAction).toHaveBeenCalledTimes(1)

      document.body.removeChild(button)
    })

    it('should allow custom skip list', () => {
      renderHook(() => useComboKeybinding('s', mockAction, ['button', 'div']))

      const button = document.createElement('button')

      document.body.appendChild(button)
      button.focus()

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      })

      handler(event)

      expect(mockAction).not.toHaveBeenCalled()

      document.body.removeChild(button)
    })

    it('should use default skip list when skip parameter is undefined', () => {
      renderHook(() => useComboKeybinding('s', mockAction, undefined))

      const input = document.createElement('input')

      document.body.appendChild(input)
      input.focus()

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      })

      handler(event)

      expect(mockAction).not.toHaveBeenCalled()

      document.body.removeChild(input)
    })

    it('should allow empty skip list', () => {
      renderHook(() => useComboKeybinding('s', mockAction, []))

      const input = document.createElement('input')

      document.body.appendChild(input)
      input.focus()

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      })

      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn(),
      })
      Object.defineProperty(event, 'stopPropagation', {
        value: jest.fn(),
      })

      handler(event)

      expect(mockAction).toHaveBeenCalledTimes(1)

      document.body.removeChild(input)
    })
  })

  describe('different keys', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      })
    })

    it('should handle lowercase letters', () => {
      renderHook(() => useComboKeybinding('k', mockAction))

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
      })

      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn(),
      })
      Object.defineProperty(event, 'stopPropagation', {
        value: jest.fn(),
      })

      handler(event)

      expect(mockAction).toHaveBeenCalledTimes(1)
    })

    it('should handle uppercase letters', () => {
      renderHook(() => useComboKeybinding('K', mockAction))

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 'K',
        ctrlKey: true,
      })

      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn(),
      })
      Object.defineProperty(event, 'stopPropagation', {
        value: jest.fn(),
      })

      handler(event)

      expect(mockAction).toHaveBeenCalledTimes(1)
    })

    it('should handle special keys', () => {
      renderHook(() => useComboKeybinding('Enter', mockAction))

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
      })

      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn(),
      })
      Object.defineProperty(event, 'stopPropagation', {
        value: jest.fn(),
      })

      handler(event)

      expect(mockAction).toHaveBeenCalledTimes(1)
    })

    it('should not trigger on wrong key', () => {
      renderHook(() => useComboKeybinding('s', mockAction))

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
      })

      handler(event)

      expect(mockAction).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle null activeElement', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      })

      renderHook(() => useComboKeybinding('s', mockAction))

      const originalActiveElement = document.activeElement

      Object.defineProperty(document, 'activeElement', {
        value: null,
        writable: true,
        configurable: true,
      })

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      })

      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn(),
      })
      Object.defineProperty(event, 'stopPropagation', {
        value: jest.fn(),
      })

      handler(event)

      expect(mockAction).toHaveBeenCalledTimes(1)

      Object.defineProperty(document, 'activeElement', {
        value: originalActiveElement,
        writable: true,
        configurable: true,
      })
    })

    it('should handle action that throws error', () => {
      const errorAction = jest.fn(() => {
        throw new Error('Action error')
      })

      renderHook(() => useComboKeybinding('s', errorAction))

      const handler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      })

      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn(),
      })
      Object.defineProperty(event, 'stopPropagation', {
        value: jest.fn(),
      })

      expect(() => handler(event)).toThrow('Action error')
      expect(errorAction).toHaveBeenCalledTimes(1)
    })
  })
})
