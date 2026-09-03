/* eslint-disable no-console */
import usePostMessageHandler, { postMessage } from './usePostMessageHandler'

import { act, renderHook, waitFor } from '@testing-library/react'

describe('postMessage utility', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should send postMessage to target window', () => {
      const mockTarget = {
        postMessage: jest.fn(),
      }

      postMessage('test-type', { foo: 'bar' }, mockTarget)

      expect(mockTarget.postMessage).toHaveBeenCalledWith(
        {
          type: 'test-type',
          props: { foo: 'bar' },
        },
        '*'
      )
    })

    it('should default to window.parent as target', () => {
      const mockPostMessage = jest.fn()
      const originalParent = window.parent

      Object.defineProperty(window, 'parent', {
        writable: true,
        value: { postMessage: mockPostMessage },
      })

      postMessage('test-type', { data: 'value' })

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: 'test-type',
          props: { data: 'value' },
        },
        '*'
      )

      Object.defineProperty(window, 'parent', {
        writable: true,
        value: originalParent,
      })
    })

    it('should handle errors gracefully when target is closed', () => {
      const mockTarget = {
        postMessage: jest.fn(() => {
          throw new Error('Target closed')
        }),
      }

      // Should not throw
      expect(() => {
        postMessage('test-type', {}, mockTarget)
      }).not.toThrow()
    })
  })
})

describe('usePostMessageHandler', () => {
  let mockHandler

  beforeEach(() => {
    mockHandler = jest.fn()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should throw error if name is not provided', () => {
      // Suppress console.error for this test
      const originalError = console.error

      console.error = jest.fn()

      expect(() => {
        renderHook(() => usePostMessageHandler(null, mockHandler, []))
      }).toThrow('Handler must have a name')

      console.error = originalError
    })

    it('should throw error if name is empty string', () => {
      const originalError = console.error

      console.error = jest.fn()

      expect(() => {
        renderHook(() => usePostMessageHandler('', mockHandler, []))
      }).toThrow('Handler must have a name')

      console.error = originalError
    })

    it('should not throw error with valid name', () => {
      expect(() => {
        renderHook(() => usePostMessageHandler('test-handler', mockHandler, []))
      }).not.toThrow()
    })
  })

  describe('message handling', () => {
    it('should call handler when matching message is received', async () => {
      renderHook(() => usePostMessageHandler('test-event', mockHandler, []))

      await act(async () => {
        window.postMessage(
          {
            type: 'test-event',
            props: { data: 'value' },
          },
          '*'
        )
      })

      await waitFor(() => {
        expect(mockHandler).toHaveBeenCalledWith({ data: 'value' })
      })
    })

    it('should not call handler for different message types', async () => {
      renderHook(() => usePostMessageHandler('test-event', mockHandler, []))

      await act(async () => {
        window.postMessage(
          {
            type: 'other-event',
            props: { data: 'value' },
          },
          '*'
        )
      })

      // Wait a bit to ensure handler is not called
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockHandler).not.toHaveBeenCalled()
    })

    it('should handle params property', async () => {
      renderHook(() => usePostMessageHandler('test-event', mockHandler, []))

      await act(async () => {
        window.postMessage(
          {
            type: 'test-event',
            params: { param1: 'value1' },
          },
          '*'
        )
      })

      await waitFor(() => {
        expect(mockHandler).toHaveBeenCalledWith({ param1: 'value1' })
      })
    })

    it('should handle props property', async () => {
      renderHook(() => usePostMessageHandler('test-event', mockHandler, []))

      await act(async () => {
        window.postMessage(
          {
            type: 'test-event',
            props: { prop1: 'value1' },
          },
          '*'
        )
      })

      await waitFor(() => {
        expect(mockHandler).toHaveBeenCalledWith({ prop1: 'value1' })
      })
    })

    it('should use empty object if no params or props provided', async () => {
      renderHook(() => usePostMessageHandler('test-event', mockHandler, []))

      await act(async () => {
        window.postMessage(
          {
            type: 'test-event',
          },
          '*'
        )
      })

      await waitFor(() => {
        expect(mockHandler).toHaveBeenCalledWith({})
      })
    })

    it('should handle async handlers', async () => {
      const asyncHandler = jest.fn(async (data) => {
        await new Promise((resolve) => setTimeout(resolve, 10))

        return data
      })

      renderHook(() => usePostMessageHandler('test-event', asyncHandler, []))

      await act(async () => {
        window.postMessage(
          {
            type: 'test-event',
            props: { async: 'data' },
          },
          '*'
        )
      })

      await waitFor(() => {
        expect(asyncHandler).toHaveBeenCalledWith({ async: 'data' })
      })
    })
  })

  describe('handler updates', () => {
    it('should use updated handler when deps change', async () => {
      let handlerVersion = 1
      const { rerender } = renderHook(
        ({ deps }) => {
          const handler = jest.fn(() => {
            mockHandler(handlerVersion)
          })

          usePostMessageHandler('test-event', handler, deps)
        },
        {
          initialProps: { deps: [1] },
        }
      )

      await act(async () => {
        window.postMessage(
          {
            type: 'test-event',
            props: {},
          },
          '*'
        )
      })

      await waitFor(() => {
        expect(mockHandler).toHaveBeenCalledWith(1)
      })

      mockHandler.mockClear()
      handlerVersion = 2

      rerender({ deps: [2] })

      await act(async () => {
        window.postMessage(
          {
            type: 'test-event',
            props: {},
          },
          '*'
        )
      })

      await waitFor(() => {
        expect(mockHandler).toHaveBeenCalledWith(2)
      })
    })
  })

  describe('cleanup', () => {
    it('should remove event listener on unmount', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() =>
        usePostMessageHandler('test-event', mockHandler, [])
      )

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )

      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })

    it('should not call handler after unmount', async () => {
      const { unmount } = renderHook(() =>
        usePostMessageHandler('test-event', mockHandler, [])
      )

      unmount()

      await act(async () => {
        window.postMessage(
          {
            type: 'test-event',
            props: { data: 'value' },
          },
          '*'
        )
      })

      // Wait to ensure no handler is called
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockHandler).not.toHaveBeenCalled()
    })
  })

  describe('multiple handlers', () => {
    it('should allow multiple handlers for different event types', async () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      renderHook(() => usePostMessageHandler('event-1', handler1, []))
      renderHook(() => usePostMessageHandler('event-2', handler2, []))

      await act(async () => {
        window.postMessage(
          {
            type: 'event-1',
            props: { data: '1' },
          },
          '*'
        )
      })

      await waitFor(() => {
        expect(handler1).toHaveBeenCalledWith({ data: '1' })
      })

      expect(handler2).not.toHaveBeenCalled()

      handler1.mockClear()

      await act(async () => {
        window.postMessage(
          {
            type: 'event-2',
            props: { data: '2' },
          },
          '*'
        )
      })

      await waitFor(() => {
        expect(handler2).toHaveBeenCalledWith({ data: '2' })
      })

      expect(handler1).not.toHaveBeenCalled()
    })
  })
})
