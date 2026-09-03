import useBroadcastChannel from '@/hooks/useBroadcastChannel'

import { useTraceClient, useTraceServer } from './useTrace'

import { act, renderHook } from '@testing-library/react'

jest.mock('@/hooks/useBroadcastChannel', () => ({
  __esModule: true,
  default: jest.fn(),
}))

describe('useTrace', () => {
  let mockBroadcastChannel

  beforeEach(() => {
    jest.clearAllMocks()

    mockBroadcastChannel = {
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }

    useBroadcastChannel.mockReturnValue(mockBroadcastChannel)

    delete window.location
    window.location = { href: 'https://example.com/test' }

    Object.defineProperty(document, 'title', {
      value: 'Test Page',
      writable: true,
      configurable: true,
    })
  })

  describe('useTraceClient', () => {
    describe('basic functionality', () => {
      it('should create a trace client instance', () => {
        const { result } = renderHook(() => useTraceClient())

        expect(result.current).toBeDefined()
        expect(typeof result.current.event).toBe('function')
        expect(typeof result.current.log).toBe('function')
      })

      it('should return same instance when broadcast channel does not change', () => {
        const { result, rerender } = renderHook(() => useTraceClient())

        const firstInstance = result.current

        rerender()

        expect(result.current).toBe(firstInstance)
      })

      it('should create new instance when broadcast channel changes', () => {
        const { result, rerender } = renderHook(() => useTraceClient())

        const firstInstance = result.current

        const newChannel = {
          postMessage: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        }

        useBroadcastChannel.mockReturnValue(newChannel)

        rerender()

        expect(result.current).not.toBe(firstInstance)
      })
    })

    describe('event method', () => {
      it('should post message with event type and data', () => {
        const { result } = renderHook(() => useTraceClient())

        act(() => {
          result.current.event('test-event', { foo: 'bar' })
        })

        expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith({
          type: 'test-event',
          data: { foo: 'bar' },
          window: {
            url: 'https://example.com/test',
            title: 'Test Page',
          },
        })
      })

      it('should handle window location error gracefully', () => {
        delete window.location

        const { result } = renderHook(() => useTraceClient())

        act(() => {
          result.current.event('test-event', { foo: 'bar' })
        })

        expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith({
          type: 'test-event',
          data: { foo: 'bar' },
          window: {
            url: undefined,
            title: undefined,
          },
        })
      })

      it('should handle broadcast channel errors gracefully', () => {
        mockBroadcastChannel.postMessage.mockImplementation(() => {
          throw new Error('Channel closed')
        })

        const { result } = renderHook(() => useTraceClient())

        expect(() => {
          act(() => {
            result.current.event('test-event', { foo: 'bar' })
          })
        }).not.toThrow()
      })

      it('should not post message if broadcast channel is null', () => {
        useBroadcastChannel.mockReturnValue(null)

        const { result } = renderHook(() => useTraceClient())

        act(() => {
          result.current.event('test-event', { foo: 'bar' })
        })

        expect(mockBroadcastChannel.postMessage).not.toHaveBeenCalled()
      })
    })

    describe('log method', () => {
      it('should call event with log type', () => {
        const { result } = renderHook(() => useTraceClient())

        const eventSpy = jest.spyOn(result.current, 'event')

        act(() => {
          result.current.log('message 1', 'message 2', { data: true })
        })

        expect(eventSpy).toHaveBeenCalledWith('log', [
          'message 1',
          'message 2',
          { data: true },
        ])
      })

      it('should post message through broadcast channel', () => {
        const { result } = renderHook(() => useTraceClient())

        act(() => {
          result.current.log('test message')
        })

        expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith({
          type: 'log',
          data: ['test message'],
          window: {
            url: 'https://example.com/test',
            title: 'Test Page',
          },
        })
      })
    })
  })

  describe('useTraceServer', () => {
    describe('basic functionality', () => {
      it('should add message event listener on mount', () => {
        const onEvent = jest.fn()

        renderHook(() => useTraceServer(onEvent))

        expect(mockBroadcastChannel.addEventListener).toHaveBeenCalledWith(
          'message',
          expect.any(Function)
        )
      })

      it('should remove event listener on unmount', () => {
        const onEvent = jest.fn()

        const { unmount } = renderHook(() => useTraceServer(onEvent))

        const addedListener =
          mockBroadcastChannel.addEventListener.mock.calls[0][1]

        unmount()

        expect(mockBroadcastChannel.removeEventListener).toHaveBeenCalledWith(
          'message',
          addedListener
        )
      })

      it('should not add listener if broadcast channel is null', () => {
        useBroadcastChannel.mockReturnValue(null)

        const onEvent = jest.fn()

        renderHook(() => useTraceServer(onEvent))

        expect(mockBroadcastChannel.addEventListener).not.toHaveBeenCalled()
      })
    })

    describe('message handling', () => {
      it('should call onEvent when message received', () => {
        const onEvent = jest.fn()

        renderHook(() => useTraceServer(onEvent))

        const messageHandler =
          mockBroadcastChannel.addEventListener.mock.calls[0][1]

        act(() => {
          messageHandler({
            data: {
              type: 'test-event',
              data: { foo: 'bar' },
              window: { url: 'https://example.com', title: 'Example' },
            },
          })
        })

        expect(onEvent).toHaveBeenCalledWith(
          'test-event',
          { foo: 'bar' },
          { url: 'https://example.com', title: 'Example' }
        )
      })

      it('should not call onEvent if type is missing', () => {
        const onEvent = jest.fn()

        renderHook(() => useTraceServer(onEvent))

        const messageHandler =
          mockBroadcastChannel.addEventListener.mock.calls[0][1]

        act(() => {
          messageHandler({
            data: {
              data: { foo: 'bar' },
            },
          })
        })

        expect(onEvent).not.toHaveBeenCalled()
      })

      it('should not call onEvent if data is missing', () => {
        const onEvent = jest.fn()

        renderHook(() => useTraceServer(onEvent))

        const messageHandler =
          mockBroadcastChannel.addEventListener.mock.calls[0][1]

        act(() => {
          messageHandler({
            data: null,
          })
        })

        expect(onEvent).not.toHaveBeenCalled()
      })

      it('should not call onEvent if onEvent callback is not provided', () => {
        renderHook(() => useTraceServer(undefined))

        const messageHandler =
          mockBroadcastChannel.addEventListener.mock.calls[0][1]

        expect(() => {
          act(() => {
            messageHandler({
              data: {
                type: 'test-event',
                data: { foo: 'bar' },
              },
            })
          })
        }).not.toThrow()
      })
    })

    describe('dependency updates', () => {
      it('should update listener when onEvent changes', () => {
        const onEvent1 = jest.fn()
        const onEvent2 = jest.fn()

        const { rerender } = renderHook(
          ({ callback }) => useTraceServer(callback),
          { initialProps: { callback: onEvent1 } }
        )

        expect(mockBroadcastChannel.addEventListener).toHaveBeenCalledTimes(1)
        expect(mockBroadcastChannel.removeEventListener).toHaveBeenCalledTimes(
          0
        )

        rerender({ callback: onEvent2 })

        expect(mockBroadcastChannel.addEventListener).toHaveBeenCalledTimes(2)
        expect(mockBroadcastChannel.removeEventListener).toHaveBeenCalledTimes(
          1
        )
      })

      it('should update listener when broadcast channel changes', () => {
        const onEvent = jest.fn()

        const { rerender } = renderHook(() => useTraceServer(onEvent))

        const newChannel = {
          postMessage: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        }

        useBroadcastChannel.mockReturnValue(newChannel)

        rerender()

        expect(mockBroadcastChannel.removeEventListener).toHaveBeenCalledTimes(
          1
        )
        expect(newChannel.addEventListener).toHaveBeenCalledTimes(1)
      })
    })
  })
})
