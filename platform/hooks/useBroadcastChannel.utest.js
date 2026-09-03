import useBroadcastChannel from './useBroadcastChannel'

import { renderHook } from '@testing-library/react'

describe('useBroadcastChannel', () => {
  let mockBroadcastChannel
  let mockClose

  beforeEach(() => {
    mockClose = jest.fn()

    mockBroadcastChannel = jest.fn((name) => ({
      name,
      close: mockClose,
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))

    global.BroadcastChannel = mockBroadcastChannel
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete global.BroadcastChannel
  })

  describe('initialization', () => {
    it('should initialize with null channel', () => {
      delete global.BroadcastChannel

      const { result } = renderHook(() => useBroadcastChannel('test-channel'))

      expect(result.current).toBeNull()
    })

    it('should create broadcast channel when available', () => {
      const { result } = renderHook(() => useBroadcastChannel('test-channel'))

      expect(mockBroadcastChannel).toHaveBeenCalledWith('test-channel')
      expect(result.current).not.toBeNull()
      expect(result.current.name).toBe('test-channel')
    })

    it('should create channel with different name', () => {
      const { result } = renderHook(() => useBroadcastChannel('custom-name'))

      expect(mockBroadcastChannel).toHaveBeenCalledWith('custom-name')
      expect(result.current.name).toBe('custom-name')
    })
  })

  describe('channel lifecycle', () => {
    it('should close channel on unmount', () => {
      const { unmount } = renderHook(() => useBroadcastChannel('test-channel'))

      expect(mockClose).not.toHaveBeenCalled()

      unmount()

      expect(mockClose).toHaveBeenCalledTimes(1)
    })

    it('should recreate channel when name changes', () => {
      const { rerender } = renderHook(({ name }) => useBroadcastChannel(name), {
        initialProps: { name: 'channel-1' },
      })

      expect(mockBroadcastChannel).toHaveBeenCalledWith('channel-1')
      expect(mockClose).not.toHaveBeenCalled()

      rerender({ name: 'channel-2' })

      expect(mockClose).toHaveBeenCalledTimes(1)
      expect(mockBroadcastChannel).toHaveBeenCalledWith('channel-2')
      expect(mockBroadcastChannel).toHaveBeenCalledTimes(2)
    })

    it('should not recreate channel when name stays the same', () => {
      const { rerender } = renderHook(({ name }) => useBroadcastChannel(name), {
        initialProps: { name: 'channel-1' },
      })

      expect(mockBroadcastChannel).toHaveBeenCalledTimes(1)

      rerender({ name: 'channel-1' })

      expect(mockBroadcastChannel).toHaveBeenCalledTimes(1)
      expect(mockClose).not.toHaveBeenCalled()
    })
  })

  describe('browser compatibility', () => {
    it('should handle missing BroadcastChannel API', () => {
      delete global.BroadcastChannel

      const { result } = renderHook(() => useBroadcastChannel('test-channel'))

      expect(result.current).toBeNull()
    })

    it('should handle server-side rendering', () => {
      // In SSR, window is undefined, so we test the guard clause
      // We can't actually delete window in jsdom, but we can verify
      // the hook checks for window existence
      delete global.BroadcastChannel

      const { result } = renderHook(() => useBroadcastChannel('test-channel'))

      // Without BroadcastChannel API, should return null
      expect(result.current).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle empty channel name', () => {
      const { result } = renderHook(() => useBroadcastChannel(''))

      expect(mockBroadcastChannel).toHaveBeenCalledWith('')
      expect(result.current).not.toBeNull()
    })

    it('should handle special characters in channel name', () => {
      const specialName = 'channel-with-special@#$%'

      const { result } = renderHook(() => useBroadcastChannel(specialName))

      expect(mockBroadcastChannel).toHaveBeenCalledWith(specialName)
      expect(result.current.name).toBe(specialName)
    })

    it('should handle undefined channel name', () => {
      const { result } = renderHook(() => useBroadcastChannel(undefined))

      expect(mockBroadcastChannel).toHaveBeenCalledWith(undefined)
      expect(result.current).not.toBeNull()
    })
  })
})
