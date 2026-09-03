import { getLocalStorage } from '@/lib/browserstorage'

import {
  getSessionItemKey,
  sessionItemPrefix,
  useSessionCleanup,
} from './frame'

import { act, renderHook } from '@testing-library/react'

describe('useSessionCleanup', () => {
  let localStorage

  beforeEach(() => {
    localStorage = getLocalStorage()

    // clean up any existing session keys

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)

      if (key && key.startsWith(sessionItemPrefix)) {
        localStorage.removeItem(key)
      }
    }
  })

  afterEach(() => {
    // clean up after each test

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)

      if (key && key.startsWith(sessionItemPrefix)) {
        localStorage.removeItem(key)
      }
    }
  })

  describe('cleanupSession callback', () => {
    it('should return a cleanup function', () => {
      const { result } = renderHook(() =>
        useSessionCleanup({ session: 'test-session', channel: null })
      )

      expect(typeof result.current).toBe('function')
    })

    it('should do nothing when session is null', () => {
      // @note use valid JSON with future expiresAt to survive auto-cleanup

      const validData = JSON.stringify({
        value: 'value1',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })

      localStorage.setItem(getSessionItemKey('other', 'key1'), validData)

      const { result } = renderHook(() =>
        useSessionCleanup({ session: null, channel: null })
      )

      act(() => {
        result.current()
      })

      // should not remove keys for other sessions

      expect(localStorage.getItem(getSessionItemKey('other', 'key1'))).toBe(
        validData
      )

      localStorage.removeItem(getSessionItemKey('other', 'key1'))
    })

    it('should remove all keys for the given session', () => {
      const session = 'cleanup-test'

      localStorage.setItem(getSessionItemKey(session, 'key1'), 'value1')
      localStorage.setItem(getSessionItemKey(session, 'key2'), 'value2')
      localStorage.setItem(getSessionItemKey(session, 'key3'), 'value3')

      const { result } = renderHook(() =>
        useSessionCleanup({ session, channel: null })
      )

      act(() => {
        result.current()
      })

      expect(localStorage.getItem(getSessionItemKey(session, 'key1'))).toBe(
        null
      )
      expect(localStorage.getItem(getSessionItemKey(session, 'key2'))).toBe(
        null
      )
      expect(localStorage.getItem(getSessionItemKey(session, 'key3'))).toBe(
        null
      )
    })

    it('should not remove keys for other sessions', () => {
      const session = 'my-session'
      const otherSession = 'other-session'

      // @note use valid JSON with future expiresAt to survive auto-cleanup

      const validData = JSON.stringify({
        value: 'value1',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })

      const otherData = JSON.stringify({
        value: 'other1',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })

      localStorage.setItem(getSessionItemKey(session, 'key1'), validData)
      localStorage.setItem(getSessionItemKey(otherSession, 'key1'), otherData)

      const { result } = renderHook(() =>
        useSessionCleanup({ session, channel: null })
      )

      act(() => {
        result.current()
      })

      expect(localStorage.getItem(getSessionItemKey(session, 'key1'))).toBe(
        null
      )
      expect(
        localStorage.getItem(getSessionItemKey(otherSession, 'key1'))
      ).toBe(otherData)

      localStorage.removeItem(getSessionItemKey(otherSession, 'key1'))
    })

    it('should post cleanup messages to channel', () => {
      const session = 'channel-test'
      const mockPostMessage = jest.fn()
      const mockChannel = { postMessage: mockPostMessage }

      // @note use valid JSON with future expiresAt to survive auto-cleanup

      const data1 = JSON.stringify({
        value: 'value1',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })

      const data2 = JSON.stringify({
        value: 'value2',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })

      localStorage.setItem(getSessionItemKey(session, 'key1'), data1)
      localStorage.setItem(getSessionItemKey(session, 'key2'), data2)

      const { result } = renderHook(() =>
        useSessionCleanup({ session, channel: mockChannel })
      )

      act(() => {
        result.current()
      })

      expect(mockPostMessage).toHaveBeenCalledTimes(2)
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'cleanup',
        session: session,
        key: 'key1',
      })
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'cleanup',
        session: session,
        key: 'key2',
      })
    })

    it('should handle closed channel gracefully', () => {
      const session = 'closed-channel-test'
      const mockChannel = {
        postMessage: jest.fn().mockImplementation(() => {
          throw new Error('Channel is closed')
        }),
      }

      localStorage.setItem(getSessionItemKey(session, 'key1'), 'value1')

      const { result } = renderHook(() =>
        useSessionCleanup({ session, channel: mockChannel })
      )

      // should not throw

      expect(() => {
        act(() => {
          result.current()
        })
      }).not.toThrow()

      // should still remove the key

      expect(localStorage.getItem(getSessionItemKey(session, 'key1'))).toBe(
        null
      )
    })
  })

  describe('automatic expired session cleanup', () => {
    it('should remove expired session items on mount', () => {
      const expiredSession = 'expired-session'
      const validSession = 'valid-session'

      // set up expired item

      const expiredData = JSON.stringify({
        value: 'expired-value',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      })

      localStorage.setItem(
        getSessionItemKey(expiredSession, 'key1'),
        expiredData
      )

      // set up valid item

      const validData = JSON.stringify({
        value: 'valid-value',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })

      localStorage.setItem(getSessionItemKey(validSession, 'key1'), validData)

      renderHook(() => useSessionCleanup({ session: 'current', channel: null }))

      // expired item should be removed

      expect(
        localStorage.getItem(getSessionItemKey(expiredSession, 'key1'))
      ).toBe(null)

      // valid item should remain

      expect(
        localStorage.getItem(getSessionItemKey(validSession, 'key1'))
      ).toBe(validData)

      localStorage.removeItem(getSessionItemKey(validSession, 'key1'))
    })

    it('should handle items with invalid JSON gracefully', () => {
      const session = 'invalid-json'

      localStorage.setItem(getSessionItemKey(session, 'key1'), 'not-valid-json')

      // should not throw

      expect(() => {
        renderHook(() =>
          useSessionCleanup({ session: 'current', channel: null })
        )
      }).not.toThrow()

      // @note invalid JSON is treated as expired (no valid expiresAt) and removed

      expect(localStorage.getItem(getSessionItemKey(session, 'key1'))).toBe(
        null
      )
    })

    it('should handle items without expiresAt field', () => {
      const session = 'no-expiry'

      const noExpiryData = JSON.stringify({ value: 'test' })

      localStorage.setItem(getSessionItemKey(session, 'key1'), noExpiryData)

      renderHook(() => useSessionCleanup({ session: 'current', channel: null }))

      // item with no expiresAt treated as expired (Date.now() > 0)

      expect(localStorage.getItem(getSessionItemKey(session, 'key1'))).toBe(
        null
      )
    })
  })

  describe('callback stability', () => {
    it('should return stable callback when dependencies unchanged', () => {
      const session = 'stable-test'
      const channel = { postMessage: jest.fn() }

      const { result, rerender } = renderHook(
        ({ session, channel }) => useSessionCleanup({ session, channel }),
        { initialProps: { session, channel } }
      )

      const firstCallback = result.current

      rerender({ session, channel })

      expect(result.current).toBe(firstCallback)
    })

    it('should return new callback when session changes', () => {
      const channel = { postMessage: jest.fn() }

      const { result, rerender } = renderHook(
        ({ session, channel }) => useSessionCleanup({ session, channel }),
        { initialProps: { session: 'session-1', channel } }
      )

      const firstCallback = result.current

      rerender({ session: 'session-2', channel })

      expect(result.current).not.toBe(firstCallback)
    })

    it('should return new callback when channel changes', () => {
      const session = 'channel-change-test'
      const channel1 = { postMessage: jest.fn() }
      const channel2 = { postMessage: jest.fn() }

      const { result, rerender } = renderHook(
        ({ session, channel }) => useSessionCleanup({ session, channel }),
        { initialProps: { session, channel: channel1 } }
      )

      const firstCallback = result.current

      rerender({ session, channel: channel2 })

      expect(result.current).not.toBe(firstCallback)
    })
  })

  describe('cross-origin iframe compatibility', () => {
    it('should handle storage with length and key() methods', () => {
      const session = 'iframe-test'

      localStorage.setItem(getSessionItemKey(session, 'key1'), 'value1')

      // verify storage has length and key methods

      expect(typeof localStorage.length).toBe('number')
      expect(typeof localStorage.key).toBe('function')

      const { result } = renderHook(() =>
        useSessionCleanup({ session, channel: null })
      )

      act(() => {
        result.current()
      })

      expect(localStorage.getItem(getSessionItemKey(session, 'key1'))).toBe(
        null
      )
    })

    it('should handle empty storage gracefully', () => {
      const { result } = renderHook(() =>
        useSessionCleanup({ session: 'empty-storage-test', channel: null })
      )

      // should not throw on empty storage

      expect(() => {
        act(() => {
          result.current()
        })
      }).not.toThrow()
    })
  })
})
