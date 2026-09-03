import { captureUnknownError, codeFromError } from '@/lib/response'

import useCodeAction from './useCodeAction'

import { act, renderHook } from '@testing-library/react'

jest.mock('@/lib/error', () => ({}))

jest.mock('@/lib/response', () => ({
  captureUnknownError: jest.fn(),
  codeFromError: jest.fn(),
}))

jest.mock('@/components/CodeAction', () => {
  return function MockCodeAction({ code }) {
    return code
  }
})

describe('useCodeAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with null code action', () => {
      const { result } = renderHook(() => useCodeAction())

      const [codeAction] = result.current

      expect(codeAction).toBeNull()
    })

    it('should return setError function', () => {
      const { result } = renderHook(() => useCodeAction())

      const [, setError] = result.current

      expect(typeof setError).toBe('function')
    })
  })

  describe('string error handling', () => {
    it('should handle string error', () => {
      const { result } = renderHook(() => useCodeAction())

      act(() => {
        const [, setError] = result.current

        setError('test_error_code')
      })

      const [codeAction] = result.current

      expect(codeAction).not.toBeNull()
      expect(captureUnknownError).toHaveBeenCalledWith('test_error_code')
    })

    it('should set code directly from string', () => {
      const { result } = renderHook(() => useCodeAction())

      act(() => {
        const [, setError] = result.current

        setError('custom_error')
      })

      const [codeAction] = result.current

      expect(codeAction).not.toBeNull()
    })
  })

  describe('Error object handling', () => {
    it('should handle Error object', () => {
      const error = new Error('Test error message')

      codeFromError.mockReturnValue('extracted_error_code')

      const { result } = renderHook(() => useCodeAction())

      act(() => {
        const [, setError] = result.current

        setError(error)
      })

      const [codeAction] = result.current

      expect(codeAction).not.toBeNull()
      expect(captureUnknownError).toHaveBeenCalledWith(error)
      expect(codeFromError).toHaveBeenCalledWith(error)
    })

    it('should extract code from Error object using codeFromError', () => {
      const error = new Error('Complex error')

      codeFromError.mockReturnValue('complex_error_code')

      const { result } = renderHook(() => useCodeAction())

      act(() => {
        const [, setError] = result.current

        setError(error)
      })

      expect(codeFromError).toHaveBeenCalledWith(error)
    })
  })

  describe('update counter functionality', () => {
    it('should increment update counter on each setError call', () => {
      const { result } = renderHook(() => useCodeAction())

      act(() => {
        const [, setError] = result.current

        setError('first_error')
      })

      const firstCodeAction = result.current[0]

      act(() => {
        const [, setError] = result.current

        setError('second_error')
      })

      const secondCodeAction = result.current[0]

      // Code actions should be different objects due to key change
      expect(firstCodeAction).not.toBe(secondCodeAction)
    })

    it('should handle multiple sequential errors', () => {
      const { result } = renderHook(() => useCodeAction())

      act(() => {
        const [, setError] = result.current

        setError('error_1')
      })

      expect(captureUnknownError).toHaveBeenCalledTimes(1)

      act(() => {
        const [, setError] = result.current

        setError('error_2')
      })

      expect(captureUnknownError).toHaveBeenCalledTimes(2)

      act(() => {
        const [, setError] = result.current

        setError('error_3')
      })

      expect(captureUnknownError).toHaveBeenCalledTimes(3)
    })
  })

  describe('edge cases', () => {
    it('should handle null error', () => {
      codeFromError.mockReturnValue(null)

      const { result } = renderHook(() => useCodeAction())

      act(() => {
        const [, setError] = result.current

        setError(null)
      })

      expect(captureUnknownError).toHaveBeenCalledWith(null)
      expect(codeFromError).toHaveBeenCalledWith(null)
    })

    it('should handle undefined error', () => {
      codeFromError.mockReturnValue(undefined)

      const { result } = renderHook(() => useCodeAction())

      act(() => {
        const [, setError] = result.current

        setError(undefined)
      })

      expect(captureUnknownError).toHaveBeenCalledWith(undefined)
      expect(codeFromError).toHaveBeenCalledWith(undefined)
    })

    it('should handle empty string error', () => {
      const { result } = renderHook(() => useCodeAction())

      act(() => {
        const [, setError] = result.current

        setError('')
      })

      expect(captureUnknownError).toHaveBeenCalledWith('')
    })

    it('should handle objects that are not Error instances', () => {
      const customError = { code: 'custom_code', message: 'Custom message' }

      codeFromError.mockReturnValue('custom_error_code')

      const { result } = renderHook(() => useCodeAction())

      act(() => {
        const [, setError] = result.current

        setError(customError)
      })

      expect(captureUnknownError).toHaveBeenCalledWith(customError)
      expect(codeFromError).toHaveBeenCalledWith(customError)
    })
  })

  describe('stability', () => {
    it('should maintain setError reference across renders', () => {
      const { result, rerender } = renderHook(() => useCodeAction())

      const [, firstSetError] = result.current

      rerender()

      const [, secondSetError] = result.current

      expect(firstSetError).toBe(secondSetError)
    })
  })
})
