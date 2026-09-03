import { getSessionItemKey, useSessionChannel } from './frame'

import { renderHook } from '@testing-library/react'

describe('useSessionChannel', () => {
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
    it('should return undefined when session is null', () => {
      const { result } = renderHook(() => useSessionChannel({ session: null }))

      expect(result.current).toBeUndefined()
    })

    it('should return undefined when session is undefined', () => {
      const { result } = renderHook(() =>
        useSessionChannel({ session: undefined })
      )

      expect(result.current).toBeUndefined()
    })

    it('should create broadcast channel with correct name', () => {
      const { result } = renderHook(() =>
        useSessionChannel({ session: 'test-session' })
      )

      expect(mockBroadcastChannel).toHaveBeenCalledWith(
        getSessionItemKey('test-session', 'channel')
      )
      expect(result.current).not.toBeUndefined()
      expect(result.current.name).toBe(
        getSessionItemKey('test-session', 'channel')
      )
    })
  })

  describe('channel lifecycle', () => {
    it('should close channel on unmount', () => {
      const { unmount } = renderHook(() =>
        useSessionChannel({ session: 'test-session' })
      )

      expect(mockClose).not.toHaveBeenCalled()

      unmount()

      expect(mockClose).toHaveBeenCalledTimes(1)
    })

    it('should recreate channel when session changes', () => {
      const { rerender } = renderHook(
        ({ session }) => useSessionChannel({ session }),
        { initialProps: { session: 'session-1' } }
      )

      expect(mockBroadcastChannel).toHaveBeenCalledWith(
        getSessionItemKey('session-1', 'channel')
      )
      expect(mockBroadcastChannel).toHaveBeenCalledTimes(1)

      rerender({ session: 'session-2' })

      expect(mockClose).toHaveBeenCalledTimes(1)
      expect(mockBroadcastChannel).toHaveBeenCalledWith(
        getSessionItemKey('session-2', 'channel')
      )
      expect(mockBroadcastChannel).toHaveBeenCalledTimes(2)
    })

    it('should not recreate channel when session stays the same', () => {
      const { rerender } = renderHook(
        ({ session }) => useSessionChannel({ session }),
        { initialProps: { session: 'same-session' } }
      )

      expect(mockBroadcastChannel).toHaveBeenCalledTimes(1)

      rerender({ session: 'same-session' })

      expect(mockBroadcastChannel).toHaveBeenCalledTimes(1)
      expect(mockClose).not.toHaveBeenCalled()
    })
  })

  describe('browser compatibility', () => {
    it('should handle missing BroadcastChannel API', () => {
      delete global.BroadcastChannel

      const { result } = renderHook(() =>
        useSessionChannel({ session: 'test-session' })
      )

      expect(result.current).toBeUndefined()
    })

    it('should handle BroadcastChannel constructor throwing', () => {
      global.BroadcastChannel = jest.fn(() => {
        throw new Error('SecurityError: The operation is insecure.')
      })

      const { result } = renderHook(() =>
        useSessionChannel({ session: 'test-session' })
      )

      // @note should gracefully handle error and return undefined

      expect(result.current).toBeUndefined()
    })
  })

  describe('channel transitions', () => {
    it('should transition from null session to valid session', () => {
      const { result, rerender } = renderHook(
        ({ session }) => useSessionChannel({ session }),
        { initialProps: { session: null } }
      )

      expect(result.current).toBeUndefined()
      expect(mockBroadcastChannel).not.toHaveBeenCalled()

      rerender({ session: 'new-session' })

      expect(mockBroadcastChannel).toHaveBeenCalledWith(
        getSessionItemKey('new-session', 'channel')
      )
      expect(result.current).not.toBeUndefined()
    })

    it('should transition from valid session to null', () => {
      const { result, rerender } = renderHook(
        ({ session }) => useSessionChannel({ session }),
        { initialProps: { session: 'active-session' } }
      )

      expect(result.current).not.toBeUndefined()

      rerender({ session: null })

      expect(mockClose).toHaveBeenCalledTimes(1)

      // @note the hook closes the old channel but keeps it in state
      // this is the current implementation behavior

      expect(result.current).not.toBeUndefined()
    })
  })
})
