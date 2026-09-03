import useEventChannel from './useEventChannel'

import { act, renderHook } from '@testing-library/react'

describe('useEventChannel', () => {
  it('should return a stable channel object', () => {
    const { result, rerender } = renderHook(() => useEventChannel())

    const channel = result.current

    rerender()

    expect(result.current).toBe(channel)
    expect(result.current.emit).toBe(channel.emit)
    expect(result.current.subscribe).toBe(channel.subscribe)
  })

  it('should emit events to a subscribed listener', () => {
    const listener = jest.fn()
    const event = { type: 'test', value: 1 }

    const { result } = renderHook(() => useEventChannel())

    act(() => {
      result.current.subscribe(listener)
      result.current.emit(event)
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(event)
  })

  it('should emit events to multiple listeners in subscription order', () => {
    const firstListener = jest.fn()
    const secondListener = jest.fn()

    const { result } = renderHook(() => useEventChannel())

    act(() => {
      result.current.subscribe(firstListener)
      result.current.subscribe(secondListener)
      result.current.emit('event')
    })

    expect(firstListener).toHaveBeenCalledWith('event')
    expect(secondListener).toHaveBeenCalledWith('event')
    expect(firstListener.mock.invocationCallOrder[0]).toBeLessThan(
      secondListener.mock.invocationCallOrder[0]
    )
  })

  it('should stop emitting to an unsubscribed listener', () => {
    const listener = jest.fn()

    const { result } = renderHook(() => useEventChannel())

    let unsubscribe

    act(() => {
      unsubscribe = result.current.subscribe(listener)
      result.current.emit('before')
      unsubscribe()
      result.current.emit('after')
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('before')
  })

  it('should subscribe the same listener only once', () => {
    const listener = jest.fn()

    const { result } = renderHook(() => useEventChannel())

    act(() => {
      result.current.subscribe(listener)
      result.current.subscribe(listener)
      result.current.emit('event')
    })

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('should not emit to listeners added during the current emit', () => {
    const lateListener = jest.fn()

    const { result } = renderHook(() => useEventChannel())

    act(() => {
      result.current.subscribe(() => {
        result.current.subscribe(lateListener)
      })

      result.current.emit('first')
    })

    expect(lateListener).not.toHaveBeenCalled()

    act(() => {
      result.current.emit('second')
    })

    expect(lateListener).toHaveBeenCalledTimes(1)
    expect(lateListener).toHaveBeenCalledWith('second')
  })

  it('should still emit to listeners removed during the current emit', () => {
    const removedListener = jest.fn()

    const { result } = renderHook(() => useEventChannel())

    let unsubscribe

    act(() => {
      result.current.subscribe(() => {
        unsubscribe()
      })

      unsubscribe = result.current.subscribe(removedListener)

      result.current.emit('first')
    })

    expect(removedListener).toHaveBeenCalledTimes(1)
    expect(removedListener).toHaveBeenCalledWith('first')

    act(() => {
      result.current.emit('second')
    })

    expect(removedListener).toHaveBeenCalledTimes(1)
  })

  it('should not emit after the hook is unmounted and unsubscribed', () => {
    const listener = jest.fn()
    const { result, unmount } = renderHook(() => useEventChannel())

    const unsubscribe = result.current.subscribe(listener)

    unmount()

    unsubscribe()
    result.current.emit('event')

    expect(listener).not.toHaveBeenCalled()
  })
})
