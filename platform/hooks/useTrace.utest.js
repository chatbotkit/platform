import { useTraceClient, useTraceServer } from './useTrace'

import '@testing-library/jest-dom'
import { act, renderHook } from '@testing-library/react'

jest.mock('@/hooks/useBroadcastChannel')

// eslint-disable-next-line @typescript-eslint/no-require-imports
const useBroadcastChannel = require('@/hooks/useBroadcastChannel').default

describe('useTraceClient', () => {
  let mockBroadcastChannel
  let originalWindow
  let originalDocument

  beforeEach(() => {
    jest.clearAllMocks()
    mockBroadcastChannel = {
      postMessage: jest.fn(),
    }
    useBroadcastChannel.mockReturnValue(mockBroadcastChannel)

    originalWindow = global.window
    originalDocument = global.document

    // @note mock window globals for trace client
    if (global.window) {
      global.window.location = { href: 'http://test.com' }
    }

    if (global.document) {
      Object.defineProperty(global.document, 'title', {
        writable: true,
        value: 'Test Page',
      })
    }
  })

  afterEach(() => {
    if (originalWindow) {
      global.window = originalWindow
    }

    if (originalDocument) {
      global.document = originalDocument
    }
  })

  describe('basic functionality', () => {
    it('should return TraceClient instance', () => {
      const { result } = renderHook(() => useTraceClient())

      expect(result.current).toBeDefined()
      expect(typeof result.current.event).toBe('function')
      expect(typeof result.current.log).toBe('function')
    })

    it('should send event via broadcast channel', () => {
      const { result } = renderHook(() => useTraceClient())

      act(() => {
        result.current.event('test-event', { foo: 'bar' })
      })

      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith({
        type: 'test-event',
        data: { foo: 'bar' },
        window: {
          url: global.window?.location?.href,
          title: 'Test Page',
        },
      })
    })

    it('should send log event', () => {
      const { result } = renderHook(() => useTraceClient())

      act(() => {
        result.current.log('message', 'arg2', 'arg3')
      })

      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith({
        type: 'log',
        data: ['message', 'arg2', 'arg3'],
        window: {
          url: global.window?.location?.href,
          title: 'Test Page',
        },
      })
    })
  })

  describe('edge cases', () => {
    it('should handle missing broadcast channel', () => {
      useBroadcastChannel.mockReturnValue(null)

      const { result } = renderHook(() => useTraceClient())

      expect(() => {
        act(() => {
          result.current.event('test', {})
        })
      }).not.toThrow()
    })

    it('should handle missing window globals', () => {
      const savedLocation = global.window?.location
      const savedTitle = global.document?.title

      if (global.window) {
        delete global.window.location
      }

      if (global.document) {
        Object.defineProperty(global.document, 'title', {
          writable: true,
          value: undefined,
        })
      }

      const { result } = renderHook(() => useTraceClient())

      act(() => {
        result.current.event('test', { data: 'value' })
      })

      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith({
        type: 'test',
        data: { data: 'value' },
        window: {
          url: undefined,
          title: undefined,
        },
      })

      if (global.window && savedLocation) {
        global.window.location = savedLocation
      }

      if (global.document && savedTitle !== undefined) {
        Object.defineProperty(global.document, 'title', {
          writable: true,
          value: savedTitle,
        })
      }
    })

    it('should handle closed broadcast channel', () => {
      mockBroadcastChannel.postMessage.mockImplementation(() => {
        throw new Error('Channel closed')
      })

      const { result } = renderHook(() => useTraceClient())

      expect(() => {
        act(() => {
          result.current.event('test', {})
        })
      }).not.toThrow()
    })
  })

  describe('stability', () => {
    it('should return same instance when broadcast channel unchanged', () => {
      const { result, rerender } = renderHook(() => useTraceClient())

      const firstInstance = result.current

      rerender()

      expect(result.current).toBe(firstInstance)
    })

    it('should return new instance when broadcast channel changes', () => {
      const { result, rerender } = renderHook(() => useTraceClient())

      const firstInstance = result.current

      const newChannel = { postMessage: jest.fn() }

      useBroadcastChannel.mockReturnValue(newChannel)

      rerender()

      expect(result.current).not.toBe(firstInstance)
    })
  })
})

describe('useTraceServer', () => {
  let mockBroadcastChannel

  beforeEach(() => {
    jest.clearAllMocks()
    mockBroadcastChannel = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
    useBroadcastChannel.mockReturnValue(mockBroadcastChannel)
  })

  describe('basic functionality', () => {
    it('should add message listener on mount', () => {
      const onEvent = jest.fn()

      renderHook(() => useTraceServer(onEvent))

      expect(mockBroadcastChannel.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )
    })

    it('should call onEvent when message received', () => {
      const onEvent = jest.fn()

      renderHook(() => useTraceServer(onEvent))

      const messageHandler =
        mockBroadcastChannel.addEventListener.mock.calls[0][1]

      act(() => {
        messageHandler({
          data: {
            type: 'log',
            data: ['test message'],
            window: { url: 'http://test.com', title: 'Test' },
          },
        })
      })

      expect(onEvent).toHaveBeenCalledWith('log', ['test message'], {
        url: 'http://test.com',
        title: 'Test',
      })
    })

    it('should remove listener on unmount', () => {
      const onEvent = jest.fn()
      const { unmount } = renderHook(() => useTraceServer(onEvent))

      const messageHandler =
        mockBroadcastChannel.addEventListener.mock.calls[0][1]

      unmount()

      expect(mockBroadcastChannel.removeEventListener).toHaveBeenCalledWith(
        'message',
        messageHandler
      )
    })
  })

  describe('edge cases', () => {
    it('should handle missing broadcast channel', () => {
      useBroadcastChannel.mockReturnValue(null)

      const onEvent = jest.fn()

      renderHook(() => useTraceServer(onEvent))

      expect(mockBroadcastChannel.addEventListener).not.toHaveBeenCalled()
    })

    it('should ignore messages without type', () => {
      const onEvent = jest.fn()

      renderHook(() => useTraceServer(onEvent))

      const messageHandler =
        mockBroadcastChannel.addEventListener.mock.calls[0][1]

      act(() => {
        messageHandler({ data: { data: 'value' } })
      })

      expect(onEvent).not.toHaveBeenCalled()
    })

    it('should ignore messages without data', () => {
      const onEvent = jest.fn()

      renderHook(() => useTraceServer(onEvent))

      const messageHandler =
        mockBroadcastChannel.addEventListener.mock.calls[0][1]

      act(() => {
        messageHandler({ data: null })
      })

      expect(onEvent).not.toHaveBeenCalled()
    })
  })
})
