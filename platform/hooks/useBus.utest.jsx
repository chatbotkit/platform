import { useListen, usePublish } from './useBus'

import { act, renderHook } from '@testing-library/react'

describe('useBus', () => {
  describe('usePublish', () => {
    it('should return a stable function reference across re-renders', () => {
      const { result, rerender } = renderHook(() =>
        usePublish('publish-stable')
      )

      const first = result.current

      rerender()

      expect(result.current).toBe(first)
    })
  })

  describe('useListen', () => {
    it('should receive messages published on the same channel', () => {
      const channel = 'listen-basic'
      const received = []

      const { result: pub } = renderHook(() => usePublish(channel))

      renderHook(() => useListen(channel, (data) => received.push(data)))

      act(() => {
        pub.current('hello')
      })

      expect(received).toEqual(['hello'])
    })

    it('should receive multiple messages in order', () => {
      const channel = 'listen-order'
      const received = []

      const { result: pub } = renderHook(() => usePublish(channel))

      renderHook(() => useListen(channel, (data) => received.push(data)))

      act(() => {
        pub.current(1)
        pub.current(2)
        pub.current(3)
      })

      expect(received).toEqual([1, 2, 3])
    })

    it('should stop receiving messages after unmount', () => {
      const channel = 'listen-unmount'
      const received = []

      const { result: pub } = renderHook(() => usePublish(channel))
      const { unmount } = renderHook(() =>
        useListen(channel, (data) => received.push(data))
      )

      act(() => {
        pub.current('before')
      })

      unmount()

      act(() => {
        pub.current('after')
      })

      expect(received).toEqual(['before'])
    })

    it('should use the latest callback without re-registering the listener', () => {
      const channel = 'listen-callback-update'
      const received = []

      const { result: pub } = renderHook(() => usePublish(channel))

      let callbackVersion = 1

      const { rerender } = renderHook(() =>
        useListen(channel, (data) =>
          received.push(`v${callbackVersion}:${data}`)
        )
      )

      act(() => {
        pub.current('a')
      })

      callbackVersion = 2
      rerender()

      act(() => {
        pub.current('b')
      })

      expect(received).toEqual(['v1:a', 'v2:b'])
    })
  })

  describe('channel isolation', () => {
    it('should not deliver messages across different channels', () => {
      const receivedA = []
      const receivedB = []

      const { result: pubA } = renderHook(() => usePublish('iso-channel-a'))
      const { result: pubB } = renderHook(() => usePublish('iso-channel-b'))

      renderHook(() =>
        useListen('iso-channel-a', (data) => receivedA.push(data))
      )
      renderHook(() =>
        useListen('iso-channel-b', (data) => receivedB.push(data))
      )

      act(() => {
        pubA.current('only-a')
        pubB.current('only-b')
      })

      expect(receivedA).toEqual(['only-a'])
      expect(receivedB).toEqual(['only-b'])
    })

    it('should support multiple listeners on the same channel', () => {
      const channel = 'multi-listen'
      const receivedX = []
      const receivedY = []

      const { result: pub } = renderHook(() => usePublish(channel))

      renderHook(() => useListen(channel, (data) => receivedX.push(data)))
      renderHook(() => useListen(channel, (data) => receivedY.push(data)))

      act(() => {
        pub.current('broadcast')
      })

      expect(receivedX).toEqual(['broadcast'])
      expect(receivedY).toEqual(['broadcast'])
    })
  })
})
