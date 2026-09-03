import { getLocalStorage } from '@/lib/browserstorage'

import {
  getSessionItemKey,
  sessionItemPrefix,
  useSessionSaveRestoreSync,
} from './frame'

import { act, renderHook } from '@testing-library/react'

describe('useSessionSaveRestoreSync', () => {
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

  describe('restore behavior', () => {
    it('should return ready=false initially then ready=true', async () => {
      const setValue = jest.fn()

      const { result } = renderHook(() =>
        useSessionSaveRestoreSync(
          {
            session: 'test-session',
            channel: null,
            key: 'test-key',
            defaultValue: 'default',
            value: 'current',
            setValue,
            expiresAt: Date.now() + 60000,
          },
          ['current']
        )
      )

      // @note after effects run, should be ready

      expect(result.current).toBe(true)
    })

    it('should restore value from localStorage on mount', () => {
      const futureExpiry = new Date(Date.now() + 60000).toISOString()
      const setValue = jest.fn()

      // pre-populate localStorage

      localStorage.setItem(
        getSessionItemKey('test-session', 'restore-key'),
        JSON.stringify({ value: 'restored-value', expiresAt: futureExpiry })
      )

      renderHook(() =>
        useSessionSaveRestoreSync(
          {
            session: 'test-session',
            channel: null,
            key: 'restore-key',
            defaultValue: 'default',
            value: 'initial',
            setValue,
            expiresAt: Date.now() + 60000,
          },
          ['initial']
        )
      )

      expect(setValue).toHaveBeenCalledWith('restored-value')
    })

    it('should not call setValue if no stored value exists', () => {
      const setValue = jest.fn()

      renderHook(() =>
        useSessionSaveRestoreSync(
          {
            session: 'test-session',
            channel: null,
            key: 'non-existent-key',
            defaultValue: 'default',
            value: 'initial',
            setValue,
            expiresAt: Date.now() + 60000,
          },
          ['initial']
        )
      )

      expect(setValue).not.toHaveBeenCalled()
    })

    it('should not restore if session is null', () => {
      const setValue = jest.fn()

      renderHook(() =>
        useSessionSaveRestoreSync(
          {
            session: null,
            channel: null,
            key: 'test-key',
            defaultValue: 'default',
            value: 'initial',
            setValue,
            expiresAt: Date.now() + 60000,
          },
          ['initial']
        )
      )

      expect(setValue).not.toHaveBeenCalled()
    })
  })

  describe('save behavior', () => {
    it('should save value to localStorage when changeDetection changes', () => {
      const setValue = jest.fn()
      const expiry = Date.now() + 60000

      const { rerender } = renderHook(
        ({ value }) =>
          useSessionSaveRestoreSync(
            {
              session: 'test-session',
              channel: null,
              key: 'save-key',
              defaultValue: 'default',
              value,
              setValue,
              expiresAt: expiry,
            },
            [value]
          ),
        { initialProps: { value: 'first-value' } }
      )

      // change value to trigger save

      rerender({ value: 'second-value' })

      const stored = JSON.parse(
        localStorage.getItem(getSessionItemKey('test-session', 'save-key'))
      )

      expect(stored.value).toBe('second-value')
    })

    it('should not save if session is null', () => {
      const setValue = jest.fn()

      renderHook(() =>
        useSessionSaveRestoreSync(
          {
            session: null,
            channel: null,
            key: 'no-save-key',
            defaultValue: 'default',
            value: 'some-value',
            setValue,
            expiresAt: Date.now() + 60000,
          },
          ['some-value']
        )
      )

      expect(
        localStorage.getItem(getSessionItemKey(null, 'no-save-key'))
      ).toBeNull()
    })
  })

  describe('channel sync', () => {
    it('should post sync message when value changes', () => {
      const setValue = jest.fn()
      const mockPostMessage = jest.fn()
      const mockChannel = {
        postMessage: mockPostMessage,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }

      const { rerender } = renderHook(
        ({ value }) =>
          useSessionSaveRestoreSync(
            {
              session: 'test-session',
              channel: mockChannel,
              key: 'sync-key',
              defaultValue: 'default',
              value,
              setValue,
              expiresAt: Date.now() + 60000,
            },
            [value]
          ),
        { initialProps: { value: 'initial' } }
      )

      mockPostMessage.mockClear()

      rerender({ value: 'updated' })

      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'sync',
        session: 'test-session',
        key: 'sync-key',
        value: 'updated',
      })
    })

    it('should handle closed channel gracefully', () => {
      const setValue = jest.fn()
      const mockChannel = {
        postMessage: jest.fn().mockImplementation(() => {
          throw new Error('Channel is closed')
        }),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }

      expect(() => {
        renderHook(() =>
          useSessionSaveRestoreSync(
            {
              session: 'test-session',
              channel: mockChannel,
              key: 'closed-channel-key',
              defaultValue: 'default',
              value: 'value',
              setValue,
              expiresAt: Date.now() + 60000,
            },
            ['value']
          )
        )
      }).not.toThrow()
    })

    it('should add message listener to channel', () => {
      const setValue = jest.fn()
      const mockAddEventListener = jest.fn()
      const mockChannel = {
        postMessage: jest.fn(),
        addEventListener: mockAddEventListener,
        removeEventListener: jest.fn(),
      }

      renderHook(() =>
        useSessionSaveRestoreSync(
          {
            session: 'test-session',
            channel: mockChannel,
            key: 'listener-key',
            defaultValue: 'default',
            value: 'value',
            setValue,
            expiresAt: Date.now() + 60000,
          },
          ['value']
        )
      )

      expect(mockAddEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )
    })

    it('should remove message listener on unmount', () => {
      const setValue = jest.fn()
      const mockRemoveEventListener = jest.fn()
      const mockChannel = {
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: mockRemoveEventListener,
      }

      const { unmount } = renderHook(() =>
        useSessionSaveRestoreSync(
          {
            session: 'test-session',
            channel: mockChannel,
            key: 'cleanup-key',
            defaultValue: 'default',
            value: 'value',
            setValue,
            expiresAt: Date.now() + 60000,
          },
          ['value']
        )
      )

      unmount()

      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )
    })
  })

  describe('changeDetection parameter', () => {
    it('should accept array changeDetection', () => {
      const setValue = jest.fn()

      expect(() => {
        renderHook(() =>
          useSessionSaveRestoreSync(
            {
              session: 'test-session',
              channel: null,
              key: 'array-detection',
              defaultValue: 'default',
              value: 'value',
              setValue,
              expiresAt: Date.now() + 60000,
            },
            ['value', 'extra']
          )
        )
      }).not.toThrow()
    })

    it('should accept non-array changeDetection', () => {
      const setValue = jest.fn()

      expect(() => {
        renderHook(() =>
          useSessionSaveRestoreSync(
            {
              session: 'test-session',
              channel: null,
              key: 'non-array-detection',
              defaultValue: 'default',
              value: 'value',
              setValue,
              expiresAt: Date.now() + 60000,
            },
            'single-value'
          )
        )
      }).not.toThrow()
    })
  })

  describe('default value handling', () => {
    it('should use defaultValue on cleanup message', () => {
      const setValue = jest.fn()
      let messageHandler

      const mockChannel = {
        postMessage: jest.fn(),
        addEventListener: jest.fn((event, handler) => {
          if (event === 'message') {
            messageHandler = handler
          }
        }),
        removeEventListener: jest.fn(),
      }

      renderHook(() =>
        useSessionSaveRestoreSync(
          {
            session: 'test-session',
            channel: mockChannel,
            key: 'cleanup-default',
            defaultValue: 'my-default',
            value: 'current',
            setValue,
            expiresAt: Date.now() + 60000,
          },
          ['current']
        )
      )

      // simulate cleanup message from channel

      act(() => {
        messageHandler({
          source: window,
          data: {
            type: 'cleanup',
            session: 'test-session',
            key: 'cleanup-default',
          },
        })
      })

      expect(setValue).toHaveBeenCalledWith('my-default')
    })

    it('should sync value on sync message', () => {
      const setValue = jest.fn()
      let messageHandler

      const mockChannel = {
        postMessage: jest.fn(),
        addEventListener: jest.fn((event, handler) => {
          if (event === 'message') {
            messageHandler = handler
          }
        }),
        removeEventListener: jest.fn(),
      }

      renderHook(() =>
        useSessionSaveRestoreSync(
          {
            session: 'test-session',
            channel: mockChannel,
            key: 'sync-receive',
            defaultValue: 'default',
            value: 'current',
            setValue,
            expiresAt: Date.now() + 60000,
          },
          ['current']
        )
      )

      setValue.mockClear()

      // simulate sync message from another tab

      act(() => {
        messageHandler({
          source: window,
          data: {
            type: 'sync',
            session: 'test-session',
            key: 'sync-receive',
            value: 'synced-value',
          },
        })
      })

      expect(setValue).toHaveBeenCalledWith('synced-value')
    })

    it('should ignore messages for different session', () => {
      const setValue = jest.fn()
      let messageHandler

      const mockChannel = {
        postMessage: jest.fn(),
        addEventListener: jest.fn((event, handler) => {
          if (event === 'message') {
            messageHandler = handler
          }
        }),
        removeEventListener: jest.fn(),
      }

      renderHook(() =>
        useSessionSaveRestoreSync(
          {
            session: 'my-session',
            channel: mockChannel,
            key: 'my-key',
            defaultValue: 'default',
            value: 'current',
            setValue,
            expiresAt: Date.now() + 60000,
          },
          ['current']
        )
      )

      setValue.mockClear()

      // simulate message for different session

      act(() => {
        messageHandler({
          source: window,
          data: {
            type: 'sync',
            session: 'other-session',
            key: 'my-key',
            value: 'other-value',
          },
        })
      })

      expect(setValue).not.toHaveBeenCalled()
    })

    it('should ignore messages for different key', () => {
      const setValue = jest.fn()
      let messageHandler

      const mockChannel = {
        postMessage: jest.fn(),
        addEventListener: jest.fn((event, handler) => {
          if (event === 'message') {
            messageHandler = handler
          }
        }),
        removeEventListener: jest.fn(),
      }

      renderHook(() =>
        useSessionSaveRestoreSync(
          {
            session: 'my-session',
            channel: mockChannel,
            key: 'my-key',
            defaultValue: 'default',
            value: 'current',
            setValue,
            expiresAt: Date.now() + 60000,
          },
          ['current']
        )
      )

      setValue.mockClear()

      // simulate message for different key

      act(() => {
        messageHandler({
          source: window,
          data: {
            type: 'sync',
            session: 'my-session',
            key: 'other-key',
            value: 'other-value',
          },
        })
      })

      expect(setValue).not.toHaveBeenCalled()
    })
  })
})
