import { useListen, usePublish } from './useBus'

import { act, renderHook } from '@testing-library/react'

describe('useBus', () => {
  it('publishes messages to listeners on the same channel', () => {
    const callback = jest.fn()
    const { result } = renderHook(() => usePublish('channel-a'))

    renderHook(() => useListen('channel-a', callback))

    act(() => {
      result.current({ value: 1 })
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith({ value: 1 })
  })

  it('isolates messages by channel', () => {
    const callbackA = jest.fn()
    const callbackB = jest.fn()
    const { result: publisherA } = renderHook(() => usePublish('channel-a'))
    const { result: publisherB } = renderHook(() => usePublish('channel-b'))

    renderHook(() => useListen('channel-a', callbackA))
    renderHook(() => useListen('channel-b', callbackB))

    act(() => {
      publisherA.current('one')
    })

    expect(callbackA).toHaveBeenCalledWith('one')
    expect(callbackB).not.toHaveBeenCalled()

    act(() => {
      publisherB.current('two')
    })

    expect(callbackB).toHaveBeenCalledWith('two')
  })

  it('uses the latest listener callback after rerender', () => {
    const firstCallback = jest.fn()
    const secondCallback = jest.fn()
    const { result: publisher } = renderHook(() => usePublish('channel-c'))

    const { rerender } = renderHook(
      ({ onMessage }) => useListen('channel-c', onMessage),
      {
        initialProps: {
          onMessage: firstCallback,
        },
      }
    )

    rerender({ onMessage: secondCallback })

    act(() => {
      publisher.current('updated')
    })

    expect(firstCallback).not.toHaveBeenCalled()
    expect(secondCallback).toHaveBeenCalledWith('updated')
  })

  it('stops listening after unmount', () => {
    const callback = jest.fn()
    const { result: publisher } = renderHook(() => usePublish('channel-d'))
    const { unmount } = renderHook(() => useListen('channel-d', callback))

    unmount()

    act(() => {
      publisher.current('ignored')
    })

    expect(callback).not.toHaveBeenCalled()
  })
})
