import useBroadcastChannel from './useBroadcastChannel'

import { renderHook } from '@testing-library/react'

describe('useBroadcastChannel', () => {
  let originalBroadcastChannel
  let originalWindow

  beforeEach(() => {
    originalBroadcastChannel = global.BroadcastChannel
    originalWindow = global.window

    // Mock BroadcastChannel
    global.BroadcastChannel = jest.fn(function (name) {
      this.name = name
      this.close = jest.fn()
      this.postMessage = jest.fn()
      this.onmessage = null
    })
  })

  afterEach(() => {
    global.BroadcastChannel = originalBroadcastChannel
    global.window = originalWindow
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should create a broadcast channel with given name', () => {
      renderHook(() => useBroadcastChannel('test-channel'))

      expect(global.BroadcastChannel).toHaveBeenCalledWith('test-channel')
    })

    it('should return channel instance after mount', () => {
      const { result } = renderHook(() => useBroadcastChannel('test-channel'))

      expect(result.current).toBeInstanceOf(global.BroadcastChannel)
    })
  })

  describe('channel management', () => {
    it('should close channel on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useBroadcastChannel('test-channel')
      )

      const channel = result.current

      unmount()

      expect(channel.close).toHaveBeenCalled()
    })

    it('should create new channel when name changes', () => {
      const { result, rerender } = renderHook(
        ({ name }) => useBroadcastChannel(name),
        { initialProps: { name: 'channel-1' } }
      )

      const firstChannel = result.current

      rerender({ name: 'channel-2' })

      expect(firstChannel.close).toHaveBeenCalled()
      expect(global.BroadcastChannel).toHaveBeenCalledWith('channel-2')
    })

    it('should not recreate channel when name unchanged', () => {
      const { result, rerender } = renderHook(
        ({ name }) => useBroadcastChannel(name),
        { initialProps: { name: 'test-channel' } }
      )

      const firstChannel = result.current
      const callCount = global.BroadcastChannel.mock.calls.length

      rerender({ name: 'test-channel' })

      expect(result.current).toBe(firstChannel)
      expect(global.BroadcastChannel.mock.calls.length).toBe(callCount)
    })
  })

  describe('browser compatibility', () => {
    it('should handle missing BroadcastChannel', () => {
      delete global.BroadcastChannel

      const { result } = renderHook(() => useBroadcastChannel('test-channel'))

      // Without BroadcastChannel API, hook returns null or doesn't crash
      expect(result.current).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle empty channel name', () => {
      renderHook(() => useBroadcastChannel(''))

      expect(global.BroadcastChannel).toHaveBeenCalledWith('')
    })

    it('should handle special characters in channel name', () => {
      const specialName = 'test-channel-@#$%'

      renderHook(() => useBroadcastChannel(specialName))

      expect(global.BroadcastChannel).toHaveBeenCalledWith(specialName)
    })

    it('should handle unicode channel names', () => {
      const unicodeName = '测试频道'

      renderHook(() => useBroadcastChannel(unicodeName))

      expect(global.BroadcastChannel).toHaveBeenCalledWith(unicodeName)
    })

    it('should handle very long channel names', () => {
      const longName = 'a'.repeat(1000)

      renderHook(() => useBroadcastChannel(longName))

      expect(global.BroadcastChannel).toHaveBeenCalledWith(longName)
    })
  })

  describe('cleanup', () => {
    it('should close old channel before creating new one', () => {
      const { result, rerender } = renderHook(
        ({ name }) => useBroadcastChannel(name),
        { initialProps: { name: 'channel-1' } }
      )

      const firstChannel = result.current
      const closeFirstSpy = firstChannel.close

      rerender({ name: 'channel-2' })

      expect(closeFirstSpy).toHaveBeenCalled()
    })

    it('should not error on double unmount', () => {
      const { unmount } = renderHook(() => useBroadcastChannel('test-channel'))

      unmount()

      expect(() => unmount()).not.toThrow()
    })
  })

  describe('state consistency', () => {
    it('should maintain channel reference between renders', () => {
      const { result, rerender } = renderHook(() =>
        useBroadcastChannel('test-channel')
      )

      const channel = result.current

      rerender()

      expect(result.current).toBe(channel)
    })

    it('should have channel immediately available', () => {
      const { result } = renderHook(() => useBroadcastChannel('test-channel'))

      expect(result.current).toBeTruthy()
      expect(result.current).toBeInstanceOf(global.BroadcastChannel)
    })
  })
})
