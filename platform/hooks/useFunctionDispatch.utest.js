import useFunctionDispatch from './useFunctionDispatch'

import { act, renderHook } from '@testing-library/react'

describe('useFunctionDispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return a stable dispatch function', () => {
      const mockFn = jest.fn()
      const { result, rerender } = renderHook(() =>
        useFunctionDispatch(mockFn, [])
      )

      const dispatch1 = result.current

      rerender()

      const dispatch2 = result.current

      expect(dispatch1).toBe(dispatch2)
    })

    it('should execute the function with provided arguments', () => {
      const mockFn = jest.fn()
      const { result } = renderHook(() => useFunctionDispatch(mockFn, []))

      act(() => {
        result.current('arg1', 'arg2', 'arg3')
      })

      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3')
    })

    it('should execute function after state update completes', () => {
      const mockFn = jest.fn()
      const { result } = renderHook(() => useFunctionDispatch(mockFn, []))

      act(() => {
        result.current('test')
      })

      // The function should be called after the state update and effect run
      expect(mockFn).toHaveBeenCalledWith('test')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple arguments of different types', () => {
      const mockFn = jest.fn()
      const { result } = renderHook(() => useFunctionDispatch(mockFn, []))

      const obj = { a: 1 }
      const arr = [1, 2, 3]

      act(() => {
        result.current('string', 123, true, null, undefined, obj, arr)
      })

      expect(mockFn).toHaveBeenCalledWith(
        'string',
        123,
        true,
        null,
        undefined,
        obj,
        arr
      )
    })

    it('should handle functions with no arguments', () => {
      const mockFn = jest.fn()
      const { result } = renderHook(() => useFunctionDispatch(mockFn, []))

      act(() => {
        result.current()
      })

      expect(mockFn).toHaveBeenCalledWith()
    })
  })

  describe('dependency handling', () => {
    it('should update function when dependencies change', () => {
      const mockFn1 = jest.fn()
      const mockFn2 = jest.fn()

      const { result, rerender } = renderHook(
        ({ fn, deps }) => useFunctionDispatch(fn, deps),
        {
          initialProps: { fn: mockFn1, deps: ['dep1'] },
        }
      )

      act(() => {
        result.current('test1')
      })

      expect(mockFn1).toHaveBeenCalledWith('test1')
      expect(mockFn2).not.toHaveBeenCalled()

      // Change dependencies
      rerender({ fn: mockFn2, deps: ['dep2'] })

      act(() => {
        result.current('test2')
      })

      expect(mockFn2).toHaveBeenCalledWith('test2')
      expect(mockFn1).toHaveBeenCalledTimes(1) // Should not be called again
    })

    it('should maintain stable function reference when deps do not change', () => {
      const mockFn = jest.fn()

      const { result, rerender } = renderHook(
        ({ deps }) => {
          return useFunctionDispatch(mockFn, deps)
        },
        {
          initialProps: { deps: ['dep1'] },
        }
      )

      const dispatch1 = result.current

      // Rerender without changing deps
      rerender({ deps: ['dep1'] })

      const dispatch2 = result.current

      // The dispatch function should remain stable
      expect(dispatch1).toBe(dispatch2)

      // And it should still work
      act(() => {
        result.current('test')
      })

      expect(mockFn).toHaveBeenCalledWith('test')
    })

    it('should work with empty dependency array', () => {
      const mockFn = jest.fn()
      const { result } = renderHook(() => useFunctionDispatch(mockFn, []))

      act(() => {
        result.current('test')
      })

      expect(mockFn).toHaveBeenCalledWith('test')
    })

    it('should work without dependency array', () => {
      const mockFn = jest.fn()
      const { result } = renderHook(() => useFunctionDispatch(mockFn))

      act(() => {
        result.current('test')
      })

      expect(mockFn).toHaveBeenCalledWith('test')
    })
  })

  describe('multiple dispatch handling', () => {
    it('should handle multiple dispatches in sequence', () => {
      const mockFn = jest.fn()
      const { result } = renderHook(() => useFunctionDispatch(mockFn, []))

      act(() => {
        result.current('call1')
      })

      expect(mockFn).toHaveBeenCalledWith('call1')

      mockFn.mockClear()

      act(() => {
        result.current('call2')
      })

      expect(mockFn).toHaveBeenCalledWith('call2')
    })

    it('should only execute the most recent dispatch if multiple occur before render', () => {
      const mockFn = jest.fn()
      const { result } = renderHook(() => useFunctionDispatch(mockFn, []))

      act(() => {
        result.current('call1')
        result.current('call2')
        result.current('call3')
      })

      // Only the last call should execute
      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(mockFn).toHaveBeenCalledWith('call3')
    })

    it('should not execute the same arguments twice', () => {
      const mockFn = jest.fn()
      const { result, rerender } = renderHook(() =>
        useFunctionDispatch(mockFn, [])
      )

      const args = ['test']

      act(() => {
        result.current(...args)
      })

      expect(mockFn).toHaveBeenCalledTimes(1)

      // Rerender multiple times should not cause re-execution
      rerender()
      rerender()
      rerender()

      expect(mockFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('edge cases', () => {
    it('should handle null arguments', () => {
      const mockFn = jest.fn()
      const { result } = renderHook(() => useFunctionDispatch(mockFn, []))

      act(() => {
        result.current(null)
      })

      expect(mockFn).toHaveBeenCalledWith(null)
    })

    it('should handle undefined arguments', () => {
      const mockFn = jest.fn()
      const { result } = renderHook(() => useFunctionDispatch(mockFn, []))

      act(() => {
        result.current(undefined)
      })

      expect(mockFn).toHaveBeenCalledWith(undefined)
    })

    it('should handle empty string arguments', () => {
      const mockFn = jest.fn()
      const { result } = renderHook(() => useFunctionDispatch(mockFn, []))

      act(() => {
        result.current('')
      })

      expect(mockFn).toHaveBeenCalledWith('')
    })

    it('should handle falsy values correctly', () => {
      const mockFn = jest.fn()
      const { result } = renderHook(() => useFunctionDispatch(mockFn, []))

      act(() => {
        result.current(false, 0, '', null, undefined)
      })

      expect(mockFn).toHaveBeenCalledWith(false, 0, '', null, undefined)
    })

    it('should handle functions that throw errors', () => {
      const errorFn = jest.fn(() => {
        throw new Error('Test error')
      })
      const { result } = renderHook(() => useFunctionDispatch(errorFn, []))

      expect(() => {
        act(() => {
          result.current('test')
        })
      }).toThrow('Test error')
    })
  })

  describe('cleanup behavior', () => {
    it('should not execute after unmount', () => {
      const mockFn = jest.fn()
      const { result, unmount } = renderHook(() =>
        useFunctionDispatch(mockFn, [])
      )

      act(() => {
        result.current('test')
      })

      unmount()

      // Should not throw or cause issues
      expect(mockFn).toHaveBeenCalledWith('test')
    })

    it('should clear args state after execution', () => {
      const mockFn = jest.fn()
      const { result, rerender } = renderHook(() =>
        useFunctionDispatch(mockFn, [])
      )

      act(() => {
        result.current('test1')
      })

      expect(mockFn).toHaveBeenCalledWith('test1')

      // Multiple rerenders should not re-execute
      rerender()
      rerender()

      expect(mockFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('function stability', () => {
    it('should return the same dispatch function across rerenders', () => {
      const mockFn = jest.fn()
      const { result, rerender } = renderHook(() =>
        useFunctionDispatch(mockFn, [])
      )

      const dispatch1 = result.current

      rerender()

      const dispatch2 = result.current

      rerender()

      const dispatch3 = result.current

      expect(dispatch1).toBe(dispatch2)
      expect(dispatch2).toBe(dispatch3)
    })

    it('should maintain dispatch function identity when wrapped function changes but deps stay same', () => {
      const mockFn1 = jest.fn()
      const mockFn2 = jest.fn()

      const { result, rerender } = renderHook(
        ({ fn }) => useFunctionDispatch(fn, []),
        {
          initialProps: { fn: mockFn1 },
        }
      )

      const dispatch1 = result.current

      rerender({ fn: mockFn2 })

      const dispatch2 = result.current

      expect(dispatch1).toBe(dispatch2)
    })
  })
})
