import useIncrementIndexAfterDelay from './useIncrementIndexAfterDelay'

import { act, renderHook } from '@testing-library/react'

describe('useIncrementIndexAfterDelay', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('increments until reaching the target and stops', () => {
    const { result } = renderHook(() => useIncrementIndexAfterDelay(2, 100))

    expect(result.current).toBe(0)

    act(() => {
      jest.advanceTimersByTime(100)
    })

    expect(result.current).toBe(1)

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current).toBe(2)
  })

  it('supports infinite targets by continuing to increment', () => {
    const { result } = renderHook(() =>
      useIncrementIndexAfterDelay(Infinity, 50)
    )

    expect(result.current).toBe(0)

    act(() => {
      jest.advanceTimersByTime(150)
    })

    expect(result.current).toBe(3)
  })

  it('does not increment when disabled', () => {
    const { result, rerender } = renderHook(
      ({ disabled }) => useIncrementIndexAfterDelay(3, 100, disabled),
      {
        initialProps: { disabled: true },
      }
    )

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current).toBe(0)

    rerender({ disabled: false })

    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(result.current).toBe(3)
  })

  it('ignores invalid targets without scheduling work', () => {
    const { result } = renderHook(() =>
      useIncrementIndexAfterDelay(undefined, 100)
    )

    expect(result.current).toBe(0)

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current).toBe(0)
  })
})
