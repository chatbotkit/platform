import usePrevious from './usePrevious'

import { renderHook } from '@testing-library/react'

describe('usePrevious', () => {
  describe('initialization', () => {
    it('should return undefined initially when no default provided', () => {
      const { result } = renderHook(() => usePrevious('initial'))

      expect(result.current).toBeUndefined()
    })

    it('should return default value initially when provided', () => {
      const { result } = renderHook(() => usePrevious('initial', 'default'))

      expect(result.current).toBe('default')
    })

    it('should handle null as default value', () => {
      const { result } = renderHook(() => usePrevious('initial', null))

      expect(result.current).toBeNull()
    })

    it('should handle empty string as default value', () => {
      const { result } = renderHook(() => usePrevious('initial', ''))

      expect(result.current).toBe('')
    })

    it('should handle 0 as default value', () => {
      const { result } = renderHook(() => usePrevious(1, 0))

      expect(result.current).toBe(0)
    })

    it('should handle false as default value', () => {
      const { result } = renderHook(() => usePrevious(true, false))

      expect(result.current).toBe(false)
    })
  })

  describe('value tracking', () => {
    it('should return previous value after update', () => {
      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value),
        {
          initialProps: { value: 'first' },
        }
      )

      expect(result.current).toBeUndefined()

      rerender({ value: 'second' })

      expect(result.current).toBe('first')
    })

    it('should track multiple value changes', () => {
      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value),
        {
          initialProps: { value: 1 },
        }
      )

      expect(result.current).toBeUndefined()

      rerender({ value: 2 })
      expect(result.current).toBe(1)

      rerender({ value: 3 })
      expect(result.current).toBe(2)

      rerender({ value: 4 })
      expect(result.current).toBe(3)
    })

    it('should track value changes with default value', () => {
      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value, 'default'),
        {
          initialProps: { value: 'first' },
        }
      )

      expect(result.current).toBe('default')

      rerender({ value: 'second' })
      expect(result.current).toBe('first')

      rerender({ value: 'third' })
      expect(result.current).toBe('second')
    })
  })

  describe('different value types', () => {
    it('should track string values', () => {
      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value),
        {
          initialProps: { value: 'hello' },
        }
      )

      rerender({ value: 'world' })

      expect(result.current).toBe('hello')
    })

    it('should track number values', () => {
      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value),
        {
          initialProps: { value: 42 },
        }
      )

      rerender({ value: 100 })

      expect(result.current).toBe(42)
    })

    it('should track boolean values', () => {
      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value),
        {
          initialProps: { value: true },
        }
      )

      rerender({ value: false })

      expect(result.current).toBe(true)
    })

    it('should track object values', () => {
      const obj1 = { id: 1, name: 'first' }
      const obj2 = { id: 2, name: 'second' }

      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value),
        {
          initialProps: { value: obj1 },
        }
      )

      rerender({ value: obj2 })

      expect(result.current).toBe(obj1)
      expect(result.current).toEqual({ id: 1, name: 'first' })
    })

    it('should track array values', () => {
      const arr1 = [1, 2, 3]
      const arr2 = [4, 5, 6]

      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value),
        {
          initialProps: { value: arr1 },
        }
      )

      rerender({ value: arr2 })

      expect(result.current).toBe(arr1)
      expect(result.current).toEqual([1, 2, 3])
    })

    it('should track null values', () => {
      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value),
        {
          initialProps: { value: null },
        }
      )

      rerender({ value: 'something' })

      expect(result.current).toBeNull()
    })

    it('should track undefined values', () => {
      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value),
        {
          initialProps: { value: undefined },
        }
      )

      rerender({ value: 'something' })

      expect(result.current).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('should handle same value updates', () => {
      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value),
        {
          initialProps: { value: 'same' },
        }
      )

      rerender({ value: 'same' })

      expect(result.current).toBe('same')
    })

    it('should handle rapid value changes', () => {
      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value),
        {
          initialProps: { value: 0 },
        }
      )

      for (let i = 1; i <= 10; i++) {
        rerender({ value: i })
        expect(result.current).toBe(i - 1)
      }
    })

    it('should handle value changing from truthy to falsy', () => {
      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value),
        {
          initialProps: { value: 'truthy' },
        }
      )

      rerender({ value: '' })
      expect(result.current).toBe('truthy')

      rerender({ value: 0 })
      expect(result.current).toBe('')

      rerender({ value: false })
      expect(result.current).toBe(0)

      rerender({ value: null })
      expect(result.current).toBe(false)

      rerender({ value: undefined })
      expect(result.current).toBeNull()
    })

    it('should handle object reference changes', () => {
      const obj = { value: 1 }

      const { result, rerender } = renderHook(
        ({ value }) => usePrevious(value),
        {
          initialProps: { value: obj },
        }
      )

      obj.value = 2
      rerender({ value: obj })

      // Should track the same reference
      expect(result.current).toBe(obj)
    })
  })
})
