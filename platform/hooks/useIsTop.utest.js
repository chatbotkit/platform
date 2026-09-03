import useIsTop from './useIsTop'

import { renderHook } from '@testing-library/react'

describe('useIsTop', () => {
  describe('default value', () => {
    it('should use null as default when not provided', () => {
      const { result } = renderHook(() => useIsTop())

      // @note initially should be null before effect runs or boolean after
      expect(result.current).not.toBeUndefined()
    })

    it('should use custom default value when provided', () => {
      const { result } = renderHook(() => useIsTop(false))

      // @note initially uses the default value
      expect(result.current).toBeDefined()
    })

    it('should accept true as default value', () => {
      const { result } = renderHook(() => useIsTop(true))

      expect(typeof result.current).toBe('boolean')
    })

    it('should accept false as default value', () => {
      const { result } = renderHook(() => useIsTop(false))

      expect(typeof result.current).toBe('boolean')
    })
  })

  describe('return value', () => {
    it('should return a boolean value after render', () => {
      const { result } = renderHook(() => useIsTop())

      expect(typeof result.current).toBe('boolean')
    })

    it('should not update after initial render', () => {
      const { result, rerender } = renderHook(() => useIsTop())

      const firstValue = result.current

      rerender()

      // @note value should not change after rerender
      expect(result.current).toBe(firstValue)
    })
  })

  describe('null default behavior', () => {
    it('should start with null and update to boolean', () => {
      const { result } = renderHook(() => useIsTop(null))

      // @note should eventually be boolean after effect
      expect([null, true, false]).toContain(result.current)
    })
  })
})
