import useInitial from './useInitial'

import { renderHook } from '@testing-library/react'

describe('useInitial', () => {
  describe('basic functionality', () => {
    it('should return the initial value', () => {
      const { result } = renderHook(() => useInitial('test'))

      expect(result.current).toBe('test')
    })

    it('should return initial number value', () => {
      const { result } = renderHook(() => useInitial(42))

      expect(result.current).toBe(42)
    })

    it('should return initial object value', () => {
      const initialObject = { key: 'value' }
      const { result } = renderHook(() => useInitial(initialObject))

      expect(result.current).toBe(initialObject)
    })

    it('should return initial array value', () => {
      const initialArray = [1, 2, 3]
      const { result } = renderHook(() => useInitial(initialArray))

      expect(result.current).toBe(initialArray)
    })
  })

  describe('function initialization', () => {
    it('should execute function to get initial value', () => {
      const initializer = jest.fn(() => 'computed')
      const { result } = renderHook(() => useInitial(initializer))

      expect(initializer).toHaveBeenCalledTimes(1)
      expect(result.current).toBe('computed')
    })

    it('should only call initializer function once', () => {
      const initializer = jest.fn(() => 'value')
      const { result, rerender } = renderHook(() => useInitial(initializer))

      expect(initializer).toHaveBeenCalledTimes(1)
      expect(result.current).toBe('value')

      // re-render should not call initializer again
      rerender()
      expect(initializer).toHaveBeenCalledTimes(1)
      expect(result.current).toBe('value')
    })

    it('should handle function that returns object', () => {
      const initializer = () => ({ computed: true })
      const { result } = renderHook(() => useInitial(initializer))

      expect(result.current).toEqual({ computed: true })
    })

    it('should handle function that returns null', () => {
      const initializer = () => null
      const { result } = renderHook(() => useInitial(initializer))

      expect(result.current).toBeNull()
    })

    it('should handle function that returns undefined', () => {
      const initializer = () => undefined
      const { result } = renderHook(() => useInitial(initializer))

      expect(result.current).toBeUndefined()
    })
  })

  describe('memoization', () => {
    it('should maintain same reference across re-renders', () => {
      const initialObject = { key: 'value' }
      const { result, rerender } = renderHook(() => useInitial(initialObject))

      const firstReference = result.current

      rerender()

      const secondReference = result.current

      expect(firstReference).toBe(secondReference)
    })

    it('should not re-execute function initializer on re-render', () => {
      let executionCount = 0

      const initializer = () => {
        executionCount++

        return `value-${executionCount}`
      }

      const { result, rerender } = renderHook(() => useInitial(initializer))

      expect(result.current).toBe('value-1')
      expect(executionCount).toBe(1)

      rerender()
      rerender()
      rerender()

      expect(result.current).toBe('value-1')
      expect(executionCount).toBe(1)
    })

    it('should ignore prop changes and keep initial value', () => {
      let prop = 'first'
      const { result, rerender } = renderHook(() => useInitial(prop))

      expect(result.current).toBe('first')

      prop = 'second'
      rerender()

      // value should still be 'first' despite prop change
      expect(result.current).toBe('first')
    })
  })

  describe('edge cases', () => {
    it('should handle null initial value', () => {
      const { result } = renderHook(() => useInitial(null))

      expect(result.current).toBeNull()
    })

    it('should handle undefined initial value', () => {
      const { result } = renderHook(() => useInitial(undefined))

      expect(result.current).toBeUndefined()
    })

    it('should handle empty string', () => {
      const { result } = renderHook(() => useInitial(''))

      expect(result.current).toBe('')
    })

    it('should handle zero', () => {
      const { result } = renderHook(() => useInitial(0))

      expect(result.current).toBe(0)
    })

    it('should handle false', () => {
      const { result } = renderHook(() => useInitial(false))

      expect(result.current).toBe(false)
    })

    it('should handle empty array', () => {
      const emptyArray = []
      const { result } = renderHook(() => useInitial(emptyArray))

      expect(result.current).toBe(emptyArray)
      expect(result.current).toEqual([])
    })

    it('should handle empty object', () => {
      const emptyObject = {}
      const { result } = renderHook(() => useInitial(emptyObject))

      expect(result.current).toBe(emptyObject)
      expect(result.current).toEqual({})
    })
  })
})
