import { getRandomId } from '@/lib/string'
import toast from '@/lib/toast'

import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'

import useMagicDialog from './useMagicDialog'

import { renderHook } from '@testing-library/react'

jest.mock('@/lib/string', () => ({
  getRandomId: jest.fn(() => 'random-id-123'),
}))

jest.mock('@/lib/toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}))

jest.mock('@/components/AutoTextarea', () => {
  return function AutoTextarea(props) {
    return null
  }
})

jest.mock('@/hooks/useFetch', () => {
  return jest.fn(() => ({
    fetch: jest.fn(),
  }))
})

jest.mock('@/hooks/usePopup', () => {
  return jest.fn(() => ({
    popup: null,
    openPopup: jest.fn(),
    closePopup: jest.fn(),
  }))
})

describe('useMagicDialog', () => {
  let mockFetch
  let mockOpenPopup
  let mockClosePopup

  beforeEach(() => {
    jest.clearAllMocks()

    mockFetch = jest.fn()
    mockOpenPopup = jest.fn()
    mockClosePopup = jest.fn()

    useFetch.mockReturnValue({
      fetch: mockFetch,
    })

    usePopup.mockReturnValue({
      popup: <div>Mock Popup</div>,
      openPopup: mockOpenPopup,
      closePopup: mockClosePopup,
    })
  })

  describe('initialization', () => {
    it('should initialize with correct hook dependencies', () => {
      renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
          input: 'test input',
          title: 'Test Dialog',
        })
      )

      expect(useFetch).toHaveBeenCalledWith({
        loadingMessage: true,
        failureMessage: true,
      })

      expect(usePopup).toHaveBeenCalledWith({
        title: 'Test Dialog',
      })
    })

    it('should return dialog, open, and close functions', () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
          input: 'test input',
          title: 'Test Dialog',
        })
      )

      expect(result.current).toHaveProperty('dialog')
      expect(result.current).toHaveProperty('open')
      expect(result.current).toHaveProperty('close')
      expect(typeof result.current.open).toBe('function')
      expect(typeof result.current.close).toBe('function')
    })
  })

  describe('open function', () => {
    it('should call openPopup with correct structure', () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
          input: 'default input',
          title: 'Test Dialog',
          placeholder: 'Enter text',
        })
      )

      result.current.open({ callback: jest.fn() })

      expect(mockOpenPopup).toHaveBeenCalledTimes(1)
      expect(mockOpenPopup).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          actions: expect.objectContaining({
            Generate: expect.any(Object),
            Use: expect.any(Object),
          }),
        })
      )
    })

    it('should use options input over default input', () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
          input: 'default input',
          title: 'Test Dialog',
        })
      )

      result.current.open({
        input: 'custom input',
        callback: jest.fn(),
      })

      expect(mockOpenPopup).toHaveBeenCalled()
    })

    it('should use options children over default children', () => {
      const defaultChildren = <div>Default</div>
      const customChildren = <div>Custom</div>

      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
          children: defaultChildren,
        })
      )

      result.current.open({
        children: customChildren,
        callback: jest.fn(),
      })

      expect(mockOpenPopup).toHaveBeenCalled()
    })

    it('should use options placeholder over default placeholder', () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
          placeholder: 'default placeholder',
        })
      )

      result.current.open({
        placeholder: 'custom placeholder',
        callback: jest.fn(),
      })

      expect(mockOpenPopup).toHaveBeenCalled()
    })
  })

  describe('close function', () => {
    it('should call closePopup', () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
        })
      )

      result.current.close()

      expect(mockClosePopup).toHaveBeenCalledTimes(1)
    })
  })

  describe('Generate action', () => {
    it('should validate input before generating', async () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
        })
      )

      result.current.open({ callback: jest.fn() })

      const callArgs = mockOpenPopup.mock.calls[0]
      const actions = callArgs[1].actions
      const generateAction = actions.Generate

      // Call with empty input
      await generateAction.fn({ input: '' })

      expect(toast.error).toHaveBeenCalledWith('Please specify some input...', {
        duration: 3000,
        id: 'random-id-123',
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should validate trimmed input', async () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
        })
      )

      result.current.open({ callback: jest.fn() })

      const callArgs = mockOpenPopup.mock.calls[0]
      const actions = callArgs[1].actions
      const generateAction = actions.Generate

      // Call with whitespace-only input
      await generateAction.fn({ input: '   ' })

      expect(toast.error).toHaveBeenCalledWith('Please specify some input...', {
        duration: 3000,
        id: 'random-id-123',
      })
    })

    it('should call API with correct parameters when input is valid', async () => {
      mockFetch.mockResolvedValue({
        data: { text: 'Generated text' },
        error: null,
      })

      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
        })
      )

      result.current.open({ callback: jest.fn() })

      const callArgs = mockOpenPopup.mock.calls[0]
      const actions = callArgs[1].actions
      const generateAction = actions.Generate

      await generateAction.fn({ input: 'valid input' })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/magic/test-prompt/generate',
        {
          data: {
            text: 'valid input',
          },
          loadingMessage: 'Generating...',
        }
      )
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        error: { message: 'API error' },
        data: null,
      })

      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
        })
      )

      result.current.open({ callback: jest.fn() })

      const callArgs = mockOpenPopup.mock.calls[0]
      const actions = callArgs[1].actions
      const generateAction = actions.Generate

      await generateAction.fn({ input: 'valid input' })

      expect(mockFetch).toHaveBeenCalled()
      // Should not throw
    })

    it('should handle undefined input', async () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
        })
      )

      result.current.open({ callback: jest.fn() })

      const callArgs = mockOpenPopup.mock.calls[0]
      const actions = callArgs[1].actions
      const generateAction = actions.Generate

      await generateAction.fn({})

      expect(toast.error).toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Use action', () => {
    it('should validate suggestion before using', async () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
        })
      )

      const mockCallback = jest.fn()

      result.current.open({ callback: mockCallback })

      const callArgs = mockOpenPopup.mock.calls[0]
      const actions = callArgs[1].actions
      const useAction = actions.Use

      // Call without suggestion
      await useAction.fn({})

      expect(toast.error).toHaveBeenCalledWith(
        'There is no suggestion to use...',
        {
          duration: 3000,
          id: 'random-id-123',
        }
      )

      expect(mockCallback).not.toHaveBeenCalled()
      expect(mockClosePopup).not.toHaveBeenCalled()
    })

    it('should call callback with suggestion and close popup', async () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
        })
      )

      const mockCallback = jest.fn()

      result.current.open({ callback: mockCallback })

      const callArgs = mockOpenPopup.mock.calls[0]
      const actions = callArgs[1].actions
      const useAction = actions.Use

      await useAction.fn({ suggestion: 'Generated suggestion text' })

      expect(mockCallback).toHaveBeenCalledWith('Generated suggestion text')
      expect(mockClosePopup).toHaveBeenCalled()
    })

    it('should be marked as default action', () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
        })
      )

      result.current.open({ callback: jest.fn() })

      const callArgs = mockOpenPopup.mock.calls[0]
      const actions = callArgs[1].actions
      const useAction = actions.Use

      expect(useAction.default).toBe(true)
    })

    it('should handle empty string suggestion', async () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
        })
      )

      const mockCallback = jest.fn()

      result.current.open({ callback: mockCallback })

      const callArgs = mockOpenPopup.mock.calls[0]
      const actions = callArgs[1].actions
      const useAction = actions.Use

      await useAction.fn({ suggestion: '' })

      expect(toast.error).toHaveBeenCalled()
      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('integration', () => {
    it('should handle complete workflow: open -> generate -> use -> close', async () => {
      mockFetch.mockResolvedValue({
        data: { text: 'AI generated text' },
        error: null,
      })

      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
          title: 'Test Dialog',
        })
      )

      const mockCallback = jest.fn()

      // Open dialog
      result.current.open({ callback: mockCallback })

      expect(mockOpenPopup).toHaveBeenCalled()

      const callArgs = mockOpenPopup.mock.calls[0]
      const actions = callArgs[1].actions

      // Generate
      await actions.Generate.fn({ input: 'test input' })

      expect(mockFetch).toHaveBeenCalled()

      // Use
      await actions.Use.fn({ suggestion: 'AI generated text' })

      expect(mockCallback).toHaveBeenCalledWith('AI generated text')
      expect(mockClosePopup).toHaveBeenCalled()
    })

    it('should use getRandomId for toast IDs', async () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
        })
      )

      result.current.open({ callback: jest.fn() })

      const callArgs = mockOpenPopup.mock.calls[0]
      const actions = callArgs[1].actions

      await actions.Generate.fn({ input: '' })

      expect(getRandomId).toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledWith(expect.any(String), {
        duration: 3000,
        id: 'random-id-123',
      })
    })
  })

  describe('edge cases', () => {
    it('should handle missing promptId', () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          title: 'Test Dialog',
        })
      )

      expect(result.current).toBeDefined()
      expect(result.current.open).toBeDefined()
    })

    it('should handle missing callback in options', async () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
        })
      )

      // Open without callback
      expect(() => result.current.open({})).not.toThrow()
    })

    it('should handle null options', () => {
      const { result } = renderHook(() =>
        useMagicDialog({
          promptId: 'test-prompt',
        })
      )

      expect(() => result.current.open(null)).not.toThrow()
    })
  })
})
