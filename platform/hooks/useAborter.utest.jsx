import useAborter from './useAborter'

import { act, renderHook } from '@testing-library/react'

describe('useAborter', () => {
  describe('basic functionality', () => {
    it('should create an aborter instance', () => {
      const { result } = renderHook(() => useAborter())

      expect(result.current).toBeDefined()
      expect(result.current.signal).toBeInstanceOf(AbortSignal)
    })

    it('should not be aborted initially', () => {
      const { result } = renderHook(() => useAborter())

      expect(result.current.aborted).toBe(false)
    })

    it('should provide an abort signal', () => {
      const { result } = renderHook(() => useAborter())

      expect(result.current.signal).toBeInstanceOf(AbortSignal)
      expect(result.current.signal.aborted).toBe(false)
    })
  })

  describe('abort functionality', () => {
    it('should abort the signal', () => {
      const { result } = renderHook(() => useAborter())

      act(() => {
        result.current.abort()
      })

      expect(result.current.aborted).toBe(true)
      expect(result.current.signal.aborted).toBe(true)
    })

    it('should abort with a reason', () => {
      const { result } = renderHook(() => useAborter())
      const reason = 'User cancelled'

      act(() => {
        result.current.abort(reason)
      })

      expect(result.current.aborted).toBe(true)
      expect(result.current.signal.reason).toBe(reason)
    })

    it('should not abort again if already aborted', () => {
      const { result } = renderHook(() => useAborter())

      act(() => {
        result.current.abort('First abort')
      })

      const firstSignal = result.current.signal

      act(() => {
        result.current.abort('Second abort')
      })

      expect(result.current.signal).toBe(firstSignal)
      expect(result.current.signal.reason).toBe('First abort')
    })
  })

  describe('reset functionality', () => {
    it('should reset the abort controller', () => {
      const { result } = renderHook(() => useAborter())

      act(() => {
        result.current.abort('Test abort')
      })

      expect(result.current.aborted).toBe(true)

      const oldSignal = result.current.signal

      act(() => {
        result.current.reset()
      })

      expect(result.current.aborted).toBe(false)
      expect(result.current.signal).not.toBe(oldSignal)
    })

    it('should reset with a reason', () => {
      const { result } = renderHook(() => useAborter())

      act(() => {
        result.current.reset('Reset reason')
      })

      expect(result.current.aborted).toBe(false)
    })
  })

  describe('assertNotAborted', () => {
    it('should not throw if not aborted', () => {
      const { result } = renderHook(() => useAborter())

      expect(() => {
        result.current.assertNotAborted()
      }).not.toThrow()
    })

    it('should throw AbortError if aborted', () => {
      const { result } = renderHook(() => useAborter())

      act(() => {
        result.current.abort()
      })

      expect(() => {
        result.current.assertNotAborted()
      }).toThrow()
    })

    it('should throw with custom reason', () => {
      const { result } = renderHook(() => useAborter())
      const reason = 'Custom abort reason'

      act(() => {
        result.current.abort(reason)
      })

      expect(() => {
        result.current.assertNotAborted()
      }).toThrow(reason)
    })

    it('should throw an error with name AbortError', () => {
      const { result } = renderHook(() => useAborter())

      act(() => {
        result.current.abort()
      })

      try {
        result.current.assertNotAborted()
      } catch (error) {
        expect(error.name).toBe('AbortError')
      }
    })
  })

  describe('isAbortError', () => {
    it('should return true for AbortError instances', () => {
      const { result } = renderHook(() => useAborter())

      act(() => {
        result.current.abort()
      })

      try {
        result.current.assertNotAborted()
      } catch (error) {
        expect(result.current.isAbortError(error)).toBe(true)
      }
    })

    it('should return true for errors with name AbortError', () => {
      const { result } = renderHook(() => useAborter())
      const error = new Error('Test')

      error.name = 'AbortError'

      expect(result.current.isAbortError(error)).toBe(true)
    })

    it('should return false for regular errors', () => {
      const { result } = renderHook(() => useAborter())
      const error = new Error('Regular error')

      expect(result.current.isAbortError(error)).toBe(false)
    })

    it('should return false for null', () => {
      const { result } = renderHook(() => useAborter())

      expect(result.current.isAbortError(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      const { result } = renderHook(() => useAborter())

      expect(result.current.isAbortError(undefined)).toBe(false)
    })
  })

  describe('memoization with dependencies', () => {
    it('should create new instance when deps change', () => {
      const { result, rerender } = renderHook(({ dep }) => useAborter([dep]), {
        initialProps: { dep: 1 },
      })

      const firstInstance = result.current

      rerender({ dep: 2 })

      expect(result.current).not.toBe(firstInstance)
    })

    it('should keep same instance when deps unchanged', () => {
      const { result, rerender } = renderHook(({ dep }) => useAborter([dep]), {
        initialProps: { dep: 1 },
      })

      const firstInstance = result.current

      rerender({ dep: 1 })

      expect(result.current).toBe(firstInstance)
    })

    it('should work with empty deps array', () => {
      const { result, rerender } = renderHook(() => useAborter([]))

      const firstInstance = result.current

      rerender()

      expect(result.current).toBe(firstInstance)
    })
  })

  describe('integration with fetch', () => {
    it('should be compatible with fetch abort signal', () => {
      const { result } = renderHook(() => useAborter())

      const fetchOptions = {
        signal: result.current.signal,
      }

      expect(fetchOptions.signal).toBeInstanceOf(AbortSignal)
      expect(fetchOptions.signal.aborted).toBe(false)

      act(() => {
        result.current.abort()
      })

      expect(fetchOptions.signal.aborted).toBe(true)
    })
  })
})
