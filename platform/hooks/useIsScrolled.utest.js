import useIsContainerScrolled from '@/hooks/useIsContainerScrolled'

import useIsScrolled from './useIsScrolled'

import { renderHook } from '@testing-library/react'

jest.mock('@/hooks/useIsContainerScrolled', () => {
  return jest.fn()
})

describe('useIsScrolled', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useIsContainerScrolled.mockReturnValue(false)
  })

  describe('basic functionality', () => {
    it('should return ref and isScrolled value', () => {
      useIsContainerScrolled.mockReturnValue(false)

      const { result } = renderHook(() => useIsScrolled())

      expect(result.current).toHaveLength(2)
      expect(result.current[0]).toBeDefined()
      expect(result.current[0].current).toBeNull()
      expect(result.current[1]).toBe(false)
    })

    it('should return true when scrolled', () => {
      useIsContainerScrolled.mockReturnValue(true)

      const { result } = renderHook(() => useIsScrolled())

      expect(result.current[1]).toBe(true)
    })

    it('should pass ref to useIsContainerScrolled', () => {
      renderHook(() => useIsScrolled())

      expect(useIsContainerScrolled).toHaveBeenCalled()

      const passedRef = useIsContainerScrolled.mock.calls[0][0]

      expect(passedRef.current).toBeNull()
    })
  })

  describe('default options', () => {
    it('should use default options when none provided', () => {
      renderHook(() => useIsScrolled())

      expect(useIsContainerScrolled).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          anchor: 'top',
          threshold: 0,
          interval: 0,
          delay: 0,
          defaultValue: false,
        })
      )
    })

    it('should use empty object as default parameter', () => {
      renderHook(() => useIsScrolled({}))

      expect(useIsContainerScrolled).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          anchor: 'top',
          threshold: 0,
          interval: 0,
          delay: 0,
          defaultValue: false,
        })
      )
    })
  })

  describe('custom options', () => {
    it('should pass custom anchor option', () => {
      renderHook(() => useIsScrolled({ anchor: 'bottom' }))

      expect(useIsContainerScrolled).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          anchor: 'bottom',
        })
      )
    })

    it('should pass custom threshold option', () => {
      renderHook(() => useIsScrolled({ threshold: 100 }))

      expect(useIsContainerScrolled).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          threshold: 100,
        })
      )
    })

    it('should pass custom interval option', () => {
      renderHook(() => useIsScrolled({ interval: 200 }))

      expect(useIsContainerScrolled).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          interval: 200,
        })
      )
    })

    it('should pass custom delay option', () => {
      renderHook(() => useIsScrolled({ delay: 300 }))

      expect(useIsContainerScrolled).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          delay: 300,
        })
      )
    })

    it('should pass custom defaultValue option', () => {
      renderHook(() => useIsScrolled({ defaultValue: true }))

      expect(useIsContainerScrolled).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          defaultValue: true,
        })
      )
    })

    it('should pass all custom options together', () => {
      renderHook(() =>
        useIsScrolled({
          anchor: 'bottom',
          threshold: 50,
          interval: 100,
          delay: 200,
          defaultValue: true,
        })
      )

      expect(useIsContainerScrolled).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          anchor: 'bottom',
          threshold: 50,
          interval: 100,
          delay: 200,
          defaultValue: true,
        })
      )
    })
  })

  describe('ref behavior', () => {
    it('should return same ref instance across renders', () => {
      const { result, rerender } = renderHook(() => useIsScrolled())

      const firstRef = result.current[0]

      rerender()

      expect(result.current[0]).toBe(firstRef)
    })

    it('should initialize ref with null', () => {
      const { result } = renderHook(() => useIsScrolled())

      expect(result.current[0].current).toBeNull()
    })
  })

  describe('isScrolled updates', () => {
    it('should update isScrolled when useIsContainerScrolled changes', () => {
      useIsContainerScrolled.mockReturnValue(false)

      const { result, rerender } = renderHook(() => useIsScrolled())

      expect(result.current[1]).toBe(false)

      useIsContainerScrolled.mockReturnValue(true)

      rerender()

      expect(result.current[1]).toBe(true)
    })

    it('should reflect defaultValue in isScrolled initially', () => {
      useIsContainerScrolled.mockImplementation((ref, options) => {
        return options.defaultValue
      })

      const { result } = renderHook(() => useIsScrolled({ defaultValue: true }))

      expect(result.current[1]).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle zero values for numeric options', () => {
      renderHook(() =>
        useIsScrolled({
          threshold: 0,
          interval: 0,
          delay: 0,
        })
      )

      expect(useIsContainerScrolled).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          threshold: 0,
          interval: 0,
          delay: 0,
        })
      )
    })

    it('should handle negative values for numeric options', () => {
      renderHook(() =>
        useIsScrolled({
          threshold: -10,
          interval: -20,
          delay: -30,
        })
      )

      expect(useIsContainerScrolled).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          threshold: -10,
          interval: -20,
          delay: -30,
        })
      )
    })
  })
})
