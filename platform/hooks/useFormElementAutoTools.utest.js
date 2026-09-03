import useFormElementAutoTools from './useFormElementAutoTools'

import { act, renderHook } from '@testing-library/react'

describe('useFormElementAutoTools', () => {
  let mockForm
  let mockTarget
  let mockNextElement

  beforeEach(() => {
    // Create mock DOM elements
    mockNextElement = {
      type: 'text',
      focus: jest.fn(),
    }

    mockForm = {
      elements: [],
      checkValidity: jest.fn(() => true),
      reportValidity: jest.fn(),
      ownerDocument: {
        createElement: jest.fn(() => ({
          style: {},
          type: '',
          click: jest.fn(),
          remove: jest.fn(),
        })),
      },
      appendChild: jest.fn((button) => button),
      removeChild: jest.fn(),
    }

    mockTarget = {
      type: 'text',
      form: mockForm,
      checkValidity: jest.fn(() => true),
      reportValidity: jest.fn(),
    }
  })

  describe('initialization', () => {
    it('should return handleOnKeyDown function', () => {
      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: false,
          autoSubmit: false,
        })
      )

      expect(result.current.handleOnKeyDown).toBeInstanceOf(Function)
    })

    it('should return props object', () => {
      const extraProps = { className: 'test', disabled: false }

      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: false,
          autoSubmit: false,
          ...extraProps,
        })
      )

      expect(result.current.props).toEqual(extraProps)
    })
  })

  describe('auto-tab functionality', () => {
    it('should focus next element on Enter key press', () => {
      mockForm.elements = [mockTarget, mockNextElement]

      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: true,
          autoSubmit: false,
        })
      )

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: mockTarget,
      }

      act(() => {
        result.current.handleOnKeyDown(event)
      })

      expect(event.preventDefault).toHaveBeenCalled()
      expect(mockTarget.checkValidity).toHaveBeenCalled()
      expect(mockNextElement.focus).toHaveBeenCalled()
    })

    it('should skip submit, reset, and hidden elements when tabbing', () => {
      const submitButton = { type: 'submit', focus: jest.fn() }
      const resetButton = { type: 'reset', focus: jest.fn() }
      const hiddenInput = { type: 'hidden', focus: jest.fn() }
      const validInput = { type: 'text', focus: jest.fn() }

      mockForm.elements = [
        mockTarget,
        submitButton,
        resetButton,
        hiddenInput,
        validInput,
      ]

      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: true,
          autoSubmit: false,
        })
      )

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: mockTarget,
      }

      act(() => {
        result.current.handleOnKeyDown(event)
      })

      expect(submitButton.focus).not.toHaveBeenCalled()
      expect(resetButton.focus).not.toHaveBeenCalled()
      expect(hiddenInput.focus).not.toHaveBeenCalled()
      expect(validInput.focus).toHaveBeenCalled()
    })

    it('should not tab if target element is invalid', () => {
      mockTarget.checkValidity = jest.fn(() => false)
      mockForm.elements = [mockTarget, mockNextElement]

      const onAutoError = jest.fn()

      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: true,
          autoSubmit: false,
          onAutoError,
        })
      )

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: mockTarget,
      }

      act(() => {
        result.current.handleOnKeyDown(event)
      })

      expect(mockNextElement.focus).not.toHaveBeenCalled()
      expect(onAutoError).toHaveBeenCalledWith(expect.any(Error))
    })

    it('should report validity if reportValidity is true', () => {
      mockTarget.checkValidity = jest.fn(() => false)
      mockForm.elements = [mockTarget, mockNextElement]

      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: true,
          autoSubmit: false,
          reportValidity: true,
        })
      )

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: mockTarget,
      }

      act(() => {
        result.current.handleOnKeyDown(event)
      })

      expect(mockTarget.reportValidity).toHaveBeenCalled()
    })

    it('should do nothing when no next element is available', () => {
      mockForm.elements = [mockTarget]

      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: true,
          autoSubmit: false,
        })
      )

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: mockTarget,
      }

      expect(() => {
        act(() => {
          result.current.handleOnKeyDown(event)
        })
      }).not.toThrow()
    })
  })

  describe('auto-submit functionality', () => {
    it('should submit form on Enter key press', () => {
      const mockButton = {
        style: {},
        type: '',
        click: jest.fn(),
        remove: jest.fn(),
      }

      mockForm.ownerDocument.createElement = jest.fn(() => mockButton)
      mockForm.elements = [mockTarget]

      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: false,
          autoSubmit: true,
        })
      )

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: mockTarget,
      }

      act(() => {
        result.current.handleOnKeyDown(event)
      })

      expect(event.preventDefault).toHaveBeenCalled()
      expect(mockForm.checkValidity).toHaveBeenCalled()
      expect(mockForm.ownerDocument.createElement).toHaveBeenCalledWith('input')
      expect(mockButton.click).toHaveBeenCalled()
      expect(mockForm.appendChild).toHaveBeenCalledWith(mockButton)
      expect(mockButton.remove).toHaveBeenCalled()
    })

    it('should not submit if form is invalid', () => {
      mockForm.checkValidity = jest.fn(() => false)

      const onAutoError = jest.fn()

      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: false,
          autoSubmit: true,
          onAutoError,
        })
      )

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: mockTarget,
      }

      act(() => {
        result.current.handleOnKeyDown(event)
      })

      expect(mockForm.ownerDocument.createElement).not.toHaveBeenCalled()
      expect(onAutoError).toHaveBeenCalledWith(expect.any(Error))
    })

    it('should report form validity if reportValidity is true', () => {
      mockForm.checkValidity = jest.fn(() => false)

      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: false,
          autoSubmit: true,
          reportValidity: true,
        })
      )

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: mockTarget,
      }

      act(() => {
        result.current.handleOnKeyDown(event)
      })

      expect(mockForm.reportValidity).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should call onAutoError when target is missing', () => {
      const onAutoError = jest.fn()

      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: true,
          autoSubmit: false,
          onAutoError,
        })
      )

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: null,
      }

      act(() => {
        result.current.handleOnKeyDown(event)
      })

      expect(onAutoError).toHaveBeenCalledWith(
        new Error('No target element found')
      )
    })

    it('should call onAutoError when form is missing', () => {
      const onAutoError = jest.fn()
      const targetWithoutForm = { ...mockTarget, form: null }

      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: true,
          autoSubmit: false,
          onAutoError,
        })
      )

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: targetWithoutForm,
      }

      act(() => {
        result.current.handleOnKeyDown(event)
      })

      expect(onAutoError).toHaveBeenCalledWith(new Error('No form found'))
    })

    it('should not throw when onAutoError is not provided', () => {
      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: true,
          autoSubmit: false,
        })
      )

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: null,
      }

      expect(() => {
        act(() => {
          result.current.handleOnKeyDown(event)
        })
      }).not.toThrow()
    })
  })

  describe('key press handling', () => {
    it('should only respond to Enter key', () => {
      mockForm.elements = [mockTarget, mockNextElement]

      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: true,
          autoSubmit: false,
        })
      )

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTarget,
      }

      act(() => {
        result.current.handleOnKeyDown(event)
      })

      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(mockNextElement.focus).not.toHaveBeenCalled()
    })

    it('should ignore other key events', () => {
      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: true,
          autoSubmit: false,
        })
      )

      const keys = ['Escape', 'Space', 'a', 'Control', 'Shift']

      keys.forEach((key) => {
        const event = {
          key,
          preventDefault: jest.fn(),
          target: mockTarget,
        }

        act(() => {
          result.current.handleOnKeyDown(event)
        })

        expect(event.preventDefault).not.toHaveBeenCalled()
      })
    })
  })

  describe('edge cases', () => {
    it('should handle autoTab and autoSubmit both false', () => {
      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: false,
          autoSubmit: false,
        })
      )

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: mockTarget,
      }

      act(() => {
        result.current.handleOnKeyDown(event)
      })

      expect(event.preventDefault).toHaveBeenCalled()
      // Should not perform any action
      expect(mockNextElement.focus).not.toHaveBeenCalled()
      expect(mockForm.ownerDocument.createElement).not.toHaveBeenCalled()
    })

    it('should prioritize autoTab over autoSubmit', () => {
      mockForm.elements = [mockTarget, mockNextElement]

      const { result } = renderHook(() =>
        useFormElementAutoTools({
          autoTab: true,
          autoSubmit: true,
        })
      )

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: mockTarget,
      }

      act(() => {
        result.current.handleOnKeyDown(event)
      })

      // Should tab, not submit
      expect(mockNextElement.focus).toHaveBeenCalled()
      expect(mockForm.ownerDocument.createElement).not.toHaveBeenCalled()
    })
  })
})
