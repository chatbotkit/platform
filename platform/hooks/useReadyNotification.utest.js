import useReadyNotification, {
  useReadyNotificationHandler,
} from './useReadyNotification'

import { renderHook } from '@testing-library/react'

describe('useReadyNotification', () => {
  let postMessageSpy

  beforeEach(() => {
    // Mock window.parent.postMessage
    postMessageSpy = jest.fn()
    Object.defineProperty(window, 'parent', {
      writable: true,
      value: { postMessage: postMessageSpy },
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should post ready message to parent when ready is true', () => {
      renderHook(() => useReadyNotification(true))

      expect(postMessageSpy).toHaveBeenCalledWith('ready', '*')
      expect(postMessageSpy).toHaveBeenCalledTimes(1)
    })

    it('should post ready message when no ready parameter provided (defaults to true)', () => {
      renderHook(() => useReadyNotification())

      expect(postMessageSpy).toHaveBeenCalledWith('ready', '*')
      expect(postMessageSpy).toHaveBeenCalledTimes(1)
    })

    it('should not post message when ready is false', () => {
      renderHook(() => useReadyNotification(false))

      expect(postMessageSpy).not.toHaveBeenCalled()
    })
  })

  describe('ready state changes', () => {
    it('should post message when ready changes from false to true', () => {
      const { rerender } = renderHook(
        ({ ready }) => useReadyNotification(ready),
        {
          initialProps: { ready: false },
        }
      )

      expect(postMessageSpy).not.toHaveBeenCalled()

      rerender({ ready: true })

      expect(postMessageSpy).toHaveBeenCalledWith('ready', '*')
      expect(postMessageSpy).toHaveBeenCalledTimes(1)
    })

    it('should not post additional messages when ready stays true', () => {
      const { rerender } = renderHook(
        ({ ready }) => useReadyNotification(ready),
        {
          initialProps: { ready: true },
        }
      )

      expect(postMessageSpy).toHaveBeenCalledTimes(1)

      rerender({ ready: true })

      // Still only called once since ready didn't change
      expect(postMessageSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('edge cases', () => {
    it('should handle undefined parent window gracefully', () => {
      Object.defineProperty(window, 'parent', {
        writable: true,
        value: null,
      })

      expect(() => {
        renderHook(() => useReadyNotification(true))
      }).not.toThrow()
    })

    it('should handle null ready value', () => {
      renderHook(() => useReadyNotification(null))

      expect(postMessageSpy).not.toHaveBeenCalled()
    })

    it('should handle undefined ready value (defaults to true)', () => {
      renderHook(() => useReadyNotification(undefined))

      expect(postMessageSpy).toHaveBeenCalledWith('ready', '*')
    })
  })
})

describe('useReadyNotificationHandler', () => {
  let addEventListenerSpy
  let removeEventListenerSpy

  beforeEach(() => {
    addEventListenerSpy = jest.spyOn(window, 'addEventListener')
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('message event handling', () => {
    it('should add message event listener on mount', () => {
      const handler = jest.fn()

      renderHook(() => useReadyNotificationHandler(handler))

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )
    })

    it('should call handler when ready message is received', () => {
      const handler = jest.fn()

      renderHook(() => useReadyNotificationHandler(handler))

      const messageEvent = new MessageEvent('message', {
        data: 'ready',
      })

      window.dispatchEvent(messageEvent)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should not call handler for non-ready messages', () => {
      const handler = jest.fn()

      renderHook(() => useReadyNotificationHandler(handler))

      const messageEvent = new MessageEvent('message', {
        data: 'other-message',
      })

      window.dispatchEvent(messageEvent)

      expect(handler).not.toHaveBeenCalled()
    })

    it('should not call handler for null data', () => {
      const handler = jest.fn()

      renderHook(() => useReadyNotificationHandler(handler))

      const messageEvent = new MessageEvent('message', {
        data: null,
      })

      window.dispatchEvent(messageEvent)

      expect(handler).not.toHaveBeenCalled()
    })

    it('should not call handler for undefined data', () => {
      const handler = jest.fn()

      renderHook(() => useReadyNotificationHandler(handler))

      const messageEvent = new MessageEvent('message', {
        data: undefined,
      })

      window.dispatchEvent(messageEvent)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('iframe filtering', () => {
    it('should only call handler for messages from specified iframe', () => {
      const handler = jest.fn()
      const iframe = {
        contentWindow: {},
      }

      renderHook(() => useReadyNotificationHandler(handler, iframe))

      // Message from the correct iframe
      const correctMessage = new MessageEvent('message', {
        data: 'ready',
        source: iframe.contentWindow,
      })

      window.dispatchEvent(correctMessage)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should not call handler for messages from different iframe', () => {
      const handler = jest.fn()
      const iframe = {
        contentWindow: {},
      }
      const otherWindow = {}

      renderHook(() => useReadyNotificationHandler(handler, iframe))

      // Message from a different source
      const wrongMessage = new MessageEvent('message', {
        data: 'ready',
        source: otherWindow,
      })

      window.dispatchEvent(wrongMessage)

      expect(handler).not.toHaveBeenCalled()
    })

    it('should filter out messages when iframe is provided but source does not match', () => {
      const handler = jest.fn()
      const iframe = {
        contentWindow: {},
      }

      renderHook(() => useReadyNotificationHandler(handler, iframe))

      // Message without source (should be filtered out)
      const messageWithoutSource = new MessageEvent('message', {
        data: 'ready',
      })

      window.dispatchEvent(messageWithoutSource)

      expect(handler).not.toHaveBeenCalled()
    })

    it('should accept all ready messages when iframe is null', () => {
      const handler = jest.fn()

      renderHook(() => useReadyNotificationHandler(handler, null))

      const message1 = new MessageEvent('message', {
        data: 'ready',
        source: {},
      })

      const message2 = new MessageEvent('message', {
        data: 'ready',
        source: {},
      })

      window.dispatchEvent(message1)
      window.dispatchEvent(message2)

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('cleanup', () => {
    it('should remove event listener on unmount', () => {
      const handler = jest.fn()

      const { unmount } = renderHook(() => useReadyNotificationHandler(handler))

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )
    })

    it('should not call handler after unmount', () => {
      const handler = jest.fn()

      const { unmount } = renderHook(() => useReadyNotificationHandler(handler))

      unmount()

      const messageEvent = new MessageEvent('message', {
        data: 'ready',
      })

      window.dispatchEvent(messageEvent)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('handler updates', () => {
    it('should use updated handler when it changes', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      const { rerender } = renderHook(
        ({ handler }) => useReadyNotificationHandler(handler),
        {
          initialProps: { handler: handler1 },
        }
      )

      const messageEvent = new MessageEvent('message', {
        data: 'ready',
      })

      window.dispatchEvent(messageEvent)

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).not.toHaveBeenCalled()

      // Update handler
      rerender({ handler: handler2 })

      window.dispatchEvent(messageEvent)

      expect(handler1).toHaveBeenCalledTimes(1) // Not called again
      expect(handler2).toHaveBeenCalledTimes(1) // New handler called
    })
  })

  describe('iframe updates', () => {
    it('should update iframe filtering when iframe prop changes', () => {
      const handler = jest.fn()
      const iframe1 = { contentWindow: {} }
      const iframe2 = { contentWindow: {} }

      const { rerender } = renderHook(
        ({ iframe }) => useReadyNotificationHandler(handler, iframe),
        {
          initialProps: { iframe: iframe1 },
        }
      )

      // Message from iframe1
      const message1 = new MessageEvent('message', {
        data: 'ready',
        source: iframe1.contentWindow,
      })

      window.dispatchEvent(message1)

      expect(handler).toHaveBeenCalledTimes(1)

      // Update to iframe2
      rerender({ iframe: iframe2 })

      handler.mockClear()

      // Message from iframe1 should now be ignored
      window.dispatchEvent(message1)
      expect(handler).not.toHaveBeenCalled()

      // Message from iframe2 should be accepted
      const message2 = new MessageEvent('message', {
        data: 'ready',
        source: iframe2.contentWindow,
      })

      window.dispatchEvent(message2)
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })
})
