/* eslint-disable @typescript-eslint/no-require-imports */
import useDebounce from './useDebounce'

import { renderHook, waitFor } from '@testing-library/react'

jest.mock('@/hooks/useDeps', () => ({
  __esModule: true,
  default: jest.fn((deps) => deps),
}))

describe('useDebounce', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('basic functionality', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useDebounce('initial', 500))

      expect(result.current).toBe('initial')
    })

    it('should debounce value changes with specified delay', async () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: 'initial', delay: 500 },
        }
      )

      expect(result.current).toBe('initial')

      // Change value
      rerender({ value: 'updated', delay: 500 })

      // Value should not update immediately
      expect(result.current).toBe('initial')

      // Fast-forward time
      jest.advanceTimersByTime(500)

      await waitFor(() => {
        expect(result.current).toBe('updated')
      })
    })

    it('should reset debounce timer on rapid value changes', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        {
          initialProps: { value: 'initial' },
        }
      )

      // Change value multiple times rapidly
      rerender({ value: 'change1' })
      jest.advanceTimersByTime(200)

      rerender({ value: 'change2' })
      jest.advanceTimersByTime(200)

      rerender({ value: 'final' })

      // Should still have initial value
      expect(result.current).toBe('initial')

      // Advance by full delay
      jest.advanceTimersByTime(500)

      await waitFor(() => {
        expect(result.current).toBe('final')
      })
    })
  })

  describe('delay < 1 behavior', () => {
    it('should set value immediately when delay is 0', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 0),
        {
          initialProps: { value: 'initial' },
        }
      )

      expect(result.current).toBe('initial')

      rerender({ value: 'updated' })

      // Should update immediately without waiting
      expect(result.current).toBe('updated')
    })

    it('should set value immediately when delay is negative', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, -1),
        {
          initialProps: { value: 'initial' },
        }
      )

      expect(result.current).toBe('initial')

      rerender({ value: 'updated' })

      expect(result.current).toBe('updated')
    })
  })

  describe('edge cases', () => {
    it('should handle null value', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        {
          initialProps: { value: 'initial' },
        }
      )

      rerender({ value: null })

      jest.advanceTimersByTime(500)

      await waitFor(() => {
        expect(result.current).toBe(null)
      })
    })

    it('should handle undefined value', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        {
          initialProps: { value: 'initial' },
        }
      )

      rerender({ value: undefined })

      jest.advanceTimersByTime(500)

      await waitFor(() => {
        expect(result.current).toBe(undefined)
      })
    })

    it('should handle empty string', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        {
          initialProps: { value: 'initial' },
        }
      )

      rerender({ value: '' })

      jest.advanceTimersByTime(500)

      await waitFor(() => {
        expect(result.current).toBe('')
      })
    })

    it('should handle object values', async () => {
      const obj1 = { id: 1, name: 'test' }
      const obj2 = { id: 2, name: 'updated' }

      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        {
          initialProps: { value: obj1 },
        }
      )

      expect(result.current).toBe(obj1)

      rerender({ value: obj2 })

      jest.advanceTimersByTime(500)

      await waitFor(() => {
        expect(result.current).toBe(obj2)
      })
    })

    it('should handle array values', async () => {
      const arr1 = [1, 2, 3]
      const arr2 = [4, 5, 6]

      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        {
          initialProps: { value: arr1 },
        }
      )

      expect(result.current).toBe(arr1)

      rerender({ value: arr2 })

      jest.advanceTimersByTime(500)

      await waitFor(() => {
        expect(result.current).toBe(arr2)
      })
    })
  })

  describe('delay changes', () => {
    it('should handle delay changes', async () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: 'initial', delay: 500 },
        }
      )

      rerender({ value: 'updated', delay: 1000 })

      // Should use new delay
      jest.advanceTimersByTime(500)
      expect(result.current).toBe('initial')

      jest.advanceTimersByTime(500)

      await waitFor(() => {
        expect(result.current).toBe('updated')
      })
    })

    it('should switch from debounced to immediate when delay becomes 0', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: 'initial', delay: 500 },
        }
      )

      // Change to delay 0
      rerender({ value: 'updated', delay: 0 })

      // Should update immediately
      expect(result.current).toBe('updated')
    })
  })

  describe('cleanup', () => {
    it('should clear timeout on unmount', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      const { unmount } = renderHook(() => useDebounce('test', 500))

      unmount()

      expect(clearTimeoutSpy).toHaveBeenCalled()

      clearTimeoutSpy.mockRestore()
    })

    it('should clear previous timeout when value changes', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      const { rerender } = renderHook(({ value }) => useDebounce(value, 500), {
        initialProps: { value: 'initial' },
      })

      const callCountBefore = clearTimeoutSpy.mock.calls.length

      rerender({ value: 'updated' })

      expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(callCountBefore)

      clearTimeoutSpy.mockRestore()
    })
  })

  describe('dependency tracking', () => {
    it('should pass deps to useDeps hook', () => {
      const useDeps = require('@/hooks/useDeps').default
      const deps = ['dep1', 'dep2']

      renderHook(() => useDebounce('value', 500, deps))

      expect(useDeps).toHaveBeenCalledWith(deps)
    })

    it('should handle undefined deps', () => {
      const useDeps = require('@/hooks/useDeps').default

      renderHook(() => useDebounce('value', 500))

      expect(useDeps).toHaveBeenCalledWith(undefined)
    })
  })
})
