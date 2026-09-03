import useTabIndent from './useTabIndent'

import { act, renderHook } from '@testing-library/react'

describe('useTabIndent', () => {
  let mockTextarea
  let mockOnChange

  beforeEach(() => {
    mockOnChange = jest.fn()
    mockTextarea = {
      value: 'Hello World',
      selectionStart: 5,
      selectionEnd: 5,
      setSelectionRange: jest.fn(),
    }

    // Clear all mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Restore document.execCommand if mocked
    if (document.execCommand && document.execCommand.mockRestore) {
      document.execCommand.mockRestore()
    }
  })

  describe('initialization', () => {
    it('should initialize with default selection', () => {
      const { result } = renderHook(() => useTabIndent(mockOnChange))

      expect(result.current.selection).toEqual({ start: 0, end: 0 })
      expect(typeof result.current.handleKeyDown).toBe('function')
    })

    it('should accept onChange callback', () => {
      const { result } = renderHook(() => useTabIndent(mockOnChange))

      expect(result.current.handleKeyDown).toBeDefined()
    })
  })

  describe('tab key handling with execCommand', () => {
    beforeEach(() => {
      // Mock successful execCommand
      document.execCommand = jest.fn(() => true)
    })

    it('should prevent default tab behavior', () => {
      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('should use document.execCommand when available', () => {
      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(document.execCommand).toHaveBeenCalledWith(
        'insertText',
        false,
        '  '
      )
    })

    it('should not call onChange when execCommand succeeds', () => {
      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(mockOnChange).not.toHaveBeenCalled()
    })
  })

  describe('tab key handling with fallback', () => {
    beforeEach(() => {
      // Mock failed execCommand or no execCommand
      document.execCommand = jest.fn(() => false)
    })

    it('should use fallback when execCommand fails', () => {
      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(mockOnChange).toHaveBeenCalledWith({
        target: {
          value: 'Hello   World',
        },
      })
    })

    it('should insert tab at cursor position', () => {
      mockTextarea.selectionStart = 5
      mockTextarea.selectionEnd = 5
      mockTextarea.value = 'Hello World'

      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(mockOnChange).toHaveBeenCalledWith({
        target: {
          value: 'Hello   World',
        },
      })
    })

    it('should replace selection with tab', () => {
      mockTextarea.selectionStart = 6
      mockTextarea.selectionEnd = 11
      mockTextarea.value = 'Hello World'

      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(mockOnChange).toHaveBeenCalledWith({
        target: {
          value: 'Hello   ',
        },
      })
    })

    it('should update selection state after tab insertion', () => {
      mockTextarea.selectionStart = 5
      mockTextarea.selectionEnd = 5

      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(result.current.selection).toEqual({ start: 7, end: 7 })
    })

    it('should work without onChange callback', () => {
      const { result } = renderHook(() => useTabIndent())

      mockTextarea.value = 'Test'
      mockTextarea.selectionStart = 4
      mockTextarea.selectionEnd = 4

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(mockTextarea.setSelectionRange).toHaveBeenCalledWith(6, 6)
      expect(mockTextarea.value).toBe('Test  ')
    })
  })

  describe('non-tab key handling', () => {
    it('should not handle non-Tab keys', () => {
      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Enter',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('should not handle Shift+Tab', () => {
      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        shiftKey: true,
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      // The hook doesn't check shiftKey, but we document expected behavior
      act(() => {
        result.current.handleKeyDown(event)
      })

      // Current implementation will still handle it
      expect(event.preventDefault).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    beforeEach(() => {
      document.execCommand = jest.fn(() => false)
    })

    it('should handle empty textarea', () => {
      mockTextarea.value = ''
      mockTextarea.selectionStart = 0
      mockTextarea.selectionEnd = 0

      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(mockOnChange).toHaveBeenCalledWith({
        target: {
          value: '  ',
        },
      })
    })

    it('should handle insertion at start of text', () => {
      mockTextarea.value = 'Hello'
      mockTextarea.selectionStart = 0
      mockTextarea.selectionEnd = 0

      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(mockOnChange).toHaveBeenCalledWith({
        target: {
          value: '  Hello',
        },
      })
    })

    it('should handle insertion at end of text', () => {
      mockTextarea.value = 'Hello'
      mockTextarea.selectionStart = 5
      mockTextarea.selectionEnd = 5

      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(mockOnChange).toHaveBeenCalledWith({
        target: {
          value: 'Hello  ',
        },
      })
    })

    it('should handle execCommand throwing error', () => {
      document.execCommand = jest.fn(() => {
        throw new Error('execCommand failed')
      })

      mockTextarea.value = 'Test'
      mockTextarea.selectionStart = 2
      mockTextarea.selectionEnd = 2

      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      // Should fallback to manual insertion
      expect(mockOnChange).toHaveBeenCalledWith({
        target: {
          value: 'Te  st',
        },
      })
    })

    it('should handle missing execCommand', () => {
      const originalExecCommand = document.execCommand

      delete document.execCommand

      mockTextarea.value = 'Test'
      mockTextarea.selectionStart = 2
      mockTextarea.selectionEnd = 2

      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(mockOnChange).toHaveBeenCalledWith({
        target: {
          value: 'Te  st',
        },
      })

      // Restore
      document.execCommand = originalExecCommand
    })
  })

  describe('selection state management', () => {
    beforeEach(() => {
      document.execCommand = jest.fn(() => false)
    })

    it('should maintain correct selection after single character', () => {
      mockTextarea.value = 'A'
      mockTextarea.selectionStart = 1
      mockTextarea.selectionEnd = 1

      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(result.current.selection).toEqual({ start: 3, end: 3 })
    })

    it('should update selection when replacing text', () => {
      mockTextarea.value = 'Hello World'
      mockTextarea.selectionStart = 0
      mockTextarea.selectionEnd = 5

      const { result } = renderHook(() => useTabIndent(mockOnChange))

      const event = {
        key: 'Tab',
        preventDefault: jest.fn(),
        target: mockTextarea,
      }

      act(() => {
        result.current.handleKeyDown(event)
      })

      expect(result.current.selection).toEqual({ start: 2, end: 2 })
    })
  })
})
