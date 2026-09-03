/* eslint-disable @typescript-eslint/no-require-imports */
import useTextCompletion from './useTextCompletion'

import { act, renderHook } from '@testing-library/react'

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: jest.fn(),
}))

// Import after mocking
const useFetch = require('@/hooks/useFetch').default

describe('useTextCompletion', () => {
  let mockFetch

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup default mock for useFetch
    mockFetch = jest.fn()
    useFetch.mockReturnValue({
      fetch: mockFetch,
    })

    // Mock document.execCommand
    document.execCommand = jest.fn()
  })

  afterEach(() => {
    delete document.execCommand
  })

  describe('initialization', () => {
    it('should return onKeyDown function', () => {
      const { result } = renderHook(() => useTextCompletion())

      expect(result.current).toHaveProperty('onKeyDown')
      expect(typeof result.current.onKeyDown).toBe('function')
    })

    it('should initialize useFetch with correct options', () => {
      renderHook(() => useTextCompletion())

      expect(useFetch).toHaveBeenCalledWith({
        loadingMessage: true,
        failureMessage: true,
      })
    })
  })

  describe('onKeyDown - keyboard shortcuts', () => {
    it('should trigger completion on Ctrl+Enter', async () => {
      mockFetch.mockResolvedValue({
        data: { completion: ' completed text' },
        error: null,
      })

      const { result } = renderHook(() => useTextCompletion())

      const event = {
        ctrlKey: true,
        keyCode: 13, // Enter key
        preventDefault: jest.fn(),
        target: { value: 'test prompt' },
      }

      await act(async () => {
        await result.current.onKeyDown(event)
      })

      expect(event.preventDefault).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/text/complete', {
        data: {
          prompt: 'test prompt',
        },
      })
      expect(document.execCommand).toHaveBeenCalledWith(
        'insertText',
        false,
        ' completed text'
      )
    })

    it('should trigger completion on Meta+Enter (Mac)', async () => {
      mockFetch.mockResolvedValue({
        data: { completion: ' completed text' },
        error: null,
      })

      const { result } = renderHook(() => useTextCompletion())

      const event = {
        metaKey: true,
        keyCode: 13,
        preventDefault: jest.fn(),
        target: { value: 'test prompt' },
      }

      await act(async () => {
        await result.current.onKeyDown(event)
      })

      expect(event.preventDefault).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/text/complete', {
        data: {
          prompt: 'test prompt',
        },
      })
    })

    it('should not trigger on Enter without modifier keys', async () => {
      const { result } = renderHook(() => useTextCompletion())

      const event = {
        ctrlKey: false,
        metaKey: false,
        keyCode: 13,
        preventDefault: jest.fn(),
        target: { value: 'test prompt' },
      }

      await act(async () => {
        await result.current.onKeyDown(event)
      })

      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should not trigger on Ctrl+other keys', async () => {
      const { result } = renderHook(() => useTextCompletion())

      const event = {
        ctrlKey: true,
        keyCode: 65, // 'A' key
        preventDefault: jest.fn(),
        target: { value: 'test prompt' },
      }

      await act(async () => {
        await result.current.onKeyDown(event)
      })

      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('text completion behavior', () => {
    it('should insert completion text using execCommand', async () => {
      mockFetch.mockResolvedValue({
        data: { completion: 'AI generated completion' },
        error: null,
      })

      const { result } = renderHook(() => useTextCompletion())

      const event = {
        ctrlKey: true,
        keyCode: 13,
        preventDefault: jest.fn(),
        target: { value: 'original text' },
      }

      await act(async () => {
        await result.current.onKeyDown(event)
      })

      expect(document.execCommand).toHaveBeenCalledWith(
        'insertText',
        false,
        'AI generated completion'
      )
    })

    it('should handle empty completion text', async () => {
      mockFetch.mockResolvedValue({
        data: { completion: '' },
        error: null,
      })

      const { result } = renderHook(() => useTextCompletion())

      const event = {
        ctrlKey: true,
        keyCode: 13,
        preventDefault: jest.fn(),
        target: { value: 'test' },
      }

      await act(async () => {
        await result.current.onKeyDown(event)
      })

      expect(document.execCommand).toHaveBeenCalledWith('insertText', false, '')
    })

    it('should send correct prompt to API', async () => {
      mockFetch.mockResolvedValue({
        data: { completion: 'response' },
        error: null,
      })

      const { result } = renderHook(() => useTextCompletion())

      const promptText = 'Write a function that'

      const event = {
        ctrlKey: true,
        keyCode: 13,
        preventDefault: jest.fn(),
        target: { value: promptText },
      }

      await act(async () => {
        await result.current.onKeyDown(event)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/text/complete', {
        data: {
          prompt: promptText,
        },
      })
    })
  })

  describe('error handling', () => {
    it('should not insert text when API returns error', async () => {
      mockFetch.mockResolvedValue({
        data: null,
        error: { message: 'API Error' },
      })

      const { result } = renderHook(() => useTextCompletion())

      const event = {
        ctrlKey: true,
        keyCode: 13,
        preventDefault: jest.fn(),
        target: { value: 'test prompt' },
      }

      await act(async () => {
        await result.current.onKeyDown(event)
      })

      expect(event.preventDefault).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalled()
      expect(document.execCommand).not.toHaveBeenCalled()
    })

    it('should handle fetch rejection gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useTextCompletion())

      const event = {
        ctrlKey: true,
        keyCode: 13,
        preventDefault: jest.fn(),
        target: { value: 'test prompt' },
      }

      await expect(
        act(async () => {
          await result.current.onKeyDown(event)
        })
      ).rejects.toThrow('Network error')

      expect(document.execCommand).not.toHaveBeenCalled()
    })

    it('should handle null error in response', async () => {
      mockFetch.mockResolvedValue({
        data: { completion: 'text' },
        error: null,
      })

      const { result } = renderHook(() => useTextCompletion())

      const event = {
        ctrlKey: true,
        keyCode: 13,
        preventDefault: jest.fn(),
        target: { value: 'prompt' },
      }

      await act(async () => {
        await result.current.onKeyDown(event)
      })

      expect(document.execCommand).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle event with empty target value', async () => {
      mockFetch.mockResolvedValue({
        data: { completion: 'default completion' },
        error: null,
      })

      const { result } = renderHook(() => useTextCompletion())

      const event = {
        ctrlKey: true,
        keyCode: 13,
        preventDefault: jest.fn(),
        target: { value: '' },
      }

      await act(async () => {
        await result.current.onKeyDown(event)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/text/complete', {
        data: {
          prompt: '',
        },
      })
    })

    it('should handle multiple rapid key presses', async () => {
      mockFetch.mockResolvedValue({
        data: { completion: 'text' },
        error: null,
      })

      const { result } = renderHook(() => useTextCompletion())

      const event = {
        ctrlKey: true,
        keyCode: 13,
        preventDefault: jest.fn(),
        target: { value: 'prompt' },
      }

      await act(async () => {
        await result.current.onKeyDown(event)
        await result.current.onKeyDown(event)
        await result.current.onKeyDown(event)
      })

      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should handle both ctrlKey and metaKey being true', async () => {
      mockFetch.mockResolvedValue({
        data: { completion: 'completion' },
        error: null,
      })

      const { result } = renderHook(() => useTextCompletion())

      const event = {
        ctrlKey: true,
        metaKey: true,
        keyCode: 13,
        preventDefault: jest.fn(),
        target: { value: 'prompt' },
      }

      await act(async () => {
        await result.current.onKeyDown(event)
      })

      expect(event.preventDefault).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})
