import useDeps from './useDeps'

import { renderHook } from '@testing-library/react'

describe('useDeps', () => {
  describe('basic functionality', () => {
    it('should return initial depsId of 1 after mount', () => {
      const { result } = renderHook(() => useDeps([]))

      expect(result.current).toBe(1)
    })

    it('should increment depsId when dependency changes', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: ['a'] },
      })

      expect(result.current).toBe(1)

      rerender({ deps: ['b'] })

      expect(result.current).toBe(2)
    })

    it('should not increment depsId when dependencies stay the same', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: ['a'] },
      })

      expect(result.current).toBe(1)

      rerender({ deps: ['a'] })

      expect(result.current).toBe(1)
    })

    it('should increment depsId for each dependency change', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: ['a'] },
      })

      expect(result.current).toBe(1)

      rerender({ deps: ['b'] })
      expect(result.current).toBe(2)

      rerender({ deps: ['c'] })
      expect(result.current).toBe(3)

      rerender({ deps: ['d'] })
      expect(result.current).toBe(4)
    })
  })

  describe('multiple dependencies', () => {
    it('should track changes in multiple dependencies', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: ['a', 'b'] },
      })

      expect(result.current).toBe(1)

      rerender({ deps: ['a', 'c'] })
      expect(result.current).toBe(2)

      rerender({ deps: ['d', 'c'] })
      expect(result.current).toBe(3)
    })

    it('should not increment if all dependencies remain the same', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: ['a', 'b', 'c'] },
      })

      expect(result.current).toBe(1)

      rerender({ deps: ['a', 'b', 'c'] })
      expect(result.current).toBe(1)

      rerender({ deps: ['a', 'b', 'c'] })
      expect(result.current).toBe(1)
    })

    it('should increment when any single dependency changes', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: ['a', 'b', 'c'] },
      })

      expect(result.current).toBe(1)

      // change only first dependency
      rerender({ deps: ['x', 'b', 'c'] })
      expect(result.current).toBe(2)

      // change only middle dependency
      rerender({ deps: ['x', 'y', 'c'] })
      expect(result.current).toBe(3)

      // change only last dependency
      rerender({ deps: ['x', 'y', 'z'] })
      expect(result.current).toBe(4)
    })
  })

  describe('reference vs value changes', () => {
    it('should not increment when array has same values (React compares by value)', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: ['a'] },
      })

      expect(result.current).toBe(1)

      // new array reference with same value - no change
      rerender({ deps: ['a'] })
      expect(result.current).toBe(1)

      // still same value - no change
      rerender({ deps: ['a'] })
      expect(result.current).toBe(1)
    })

    it('should track object reference changes', () => {
      const obj1 = { key: 'value' }
      const obj2 = { key: 'value' }

      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: [obj1] },
      })

      expect(result.current).toBe(1)

      // same reference - no change
      rerender({ deps: [obj1] })
      expect(result.current).toBe(1)

      // different reference - change
      rerender({ deps: [obj2] })
      expect(result.current).toBe(2)
    })

    it('should track number changes', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: [1] },
      })

      expect(result.current).toBe(1)

      rerender({ deps: [1] })
      expect(result.current).toBe(1)

      rerender({ deps: [2] })
      expect(result.current).toBe(2)
    })
  })

  describe('empty and undefined dependencies', () => {
    it('should handle empty array as default', () => {
      const { result, rerender } = renderHook(() => useDeps())

      expect(result.current).toBe(1)

      rerender()
      expect(result.current).toBe(1)
    })

    it('should handle explicitly passed empty array', () => {
      const { result, rerender } = renderHook(() => useDeps([]))

      expect(result.current).toBe(1)

      rerender()
      expect(result.current).toBe(1)
    })

    it('should not increment with consistently empty dependencies', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: [] },
      })

      expect(result.current).toBe(1)

      rerender({ deps: [] })
      expect(result.current).toBe(1) // same values, no change

      rerender({ deps: [] })
      expect(result.current).toBe(1) // same values, no change
    })
  })

  describe('edge cases', () => {
    it('should handle null in dependencies', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: [null] },
      })

      expect(result.current).toBe(1)

      rerender({ deps: [null] })
      expect(result.current).toBe(1)

      rerender({ deps: ['value'] })
      expect(result.current).toBe(2)
    })

    it('should handle undefined in dependencies', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: [undefined] },
      })

      expect(result.current).toBe(1)

      rerender({ deps: [undefined] })
      expect(result.current).toBe(1)

      rerender({ deps: ['value'] })
      expect(result.current).toBe(2)
    })

    it('should handle boolean dependencies', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: [true] },
      })

      expect(result.current).toBe(1)

      rerender({ deps: [true] })
      expect(result.current).toBe(1)

      rerender({ deps: [false] })
      expect(result.current).toBe(2)
    })

    it('should handle mixed type dependencies', () => {
      const obj = { key: 'value' }
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: ['string', 42, true, null, obj] },
      })

      expect(result.current).toBe(1)

      // same reference for object
      rerender({ deps: ['string', 42, true, null, obj] })
      expect(result.current).toBe(1)

      // different object reference
      rerender({ deps: ['string', 42, true, null, { key: 'value' }] })
      expect(result.current).toBe(2)
    })
  })

  describe('counter behavior', () => {
    it('should continuously increment on each change', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: [0] },
      })

      expect(result.current).toBe(1)

      for (let i = 1; i <= 10; i++) {
        rerender({ deps: [i] })
        expect(result.current).toBe(i + 1)
      }
    })

    it('should not decrement on change revert', () => {
      const { result, rerender } = renderHook(({ deps }) => useDeps(deps), {
        initialProps: { deps: ['a'] },
      })

      expect(result.current).toBe(1)

      rerender({ deps: ['b'] })
      expect(result.current).toBe(2)

      // reverting to 'a' is still a change
      rerender({ deps: ['a'] })
      expect(result.current).toBe(3)
    })
  })
})
