import useBroadcastChannelState from './useBroadcastChannelState'

import { act, renderHook } from '@testing-library/react'

describe('useBroadcastChannelState', () => {
  beforeEach(() => {
    // Clean up any existing broadcast channels
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default value', () => {
      const { result } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial')
      )

      const [value] = result.current

      expect(value).toBe('initial')
    })

    it('should initialize with null value', () => {
      const { result } = renderHook(() =>
        useBroadcastChannelState('test-channel', null)
      )

      const [value] = result.current

      expect(value).toBeNull()
    })

    it('should initialize with object value', () => {
      const initialObj = { count: 0, name: 'test' }

      const { result } = renderHook(() =>
        useBroadcastChannelState('test-channel', initialObj)
      )

      const [value] = result.current

      expect(value).toEqual(initialObj)
    })

    it('should initialize with array value', () => {
      const initialArr = [1, 2, 3]

      const { result } = renderHook(() =>
        useBroadcastChannelState('test-channel', initialArr)
      )

      const [value] = result.current

      expect(value).toEqual(initialArr)
    })
  })

  describe('channel communication', () => {
    it('should send and receive messages between two hook instances', async () => {
      const { result: result1 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial')
      )

      const { result: result2 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial')
      )

      // Send from first instance
      act(() => {
        const [, sendValue] = result1.current

        sendValue('updated')
      })

      // Wait for message to propagate
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      // Check second instance received the update
      const [value2] = result2.current

      expect(value2).toBe('updated')
    })

    it('should support updater function', async () => {
      const { result: result1 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 0)
      )

      const { result: result2 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 0)
      )

      // Send with updater function
      act(() => {
        const [, sendValue] = result1.current

        sendValue((prev) => prev + 1)
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      const [value2] = result2.current

      expect(value2).toBe(1)
    })

    it('should handle complex object updates', async () => {
      const initial = { count: 0, items: [] }

      const { result: result1 } = renderHook(() =>
        useBroadcastChannelState('test-channel', initial)
      )

      const { result: result2 } = renderHook(() =>
        useBroadcastChannelState('test-channel', initial)
      )

      const update = { count: 5, items: ['a', 'b'] }

      act(() => {
        const [, sendValue] = result1.current

        sendValue(update)
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      const [value2] = result2.current

      expect(value2).toEqual(update)
    })
  })

  describe('custom message types and property keys', () => {
    it('should support custom message type', async () => {
      const { result: result1 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial', 'update', 'value')
      )

      const { result: result2 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial', 'update', 'value')
      )

      act(() => {
        const [, sendValue] = result1.current

        sendValue('custom')
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      const [value2] = result2.current

      expect(value2).toBe('custom')
    })

    it('should support custom property key', async () => {
      const { result: result1 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial', 'set', 'data')
      )

      const { result: result2 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial', 'set', 'data')
      )

      act(() => {
        const [, sendValue] = result1.current

        sendValue('custom-data')
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      const [value2] = result2.current

      expect(value2).toBe('custom-data')
    })

    it('should ignore messages with different message type', async () => {
      const { result: result1 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial', 'typeA', 'value')
      )

      const { result: result2 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial', 'typeB', 'value')
      )

      act(() => {
        const [, sendValue] = result1.current

        sendValue('updated')
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      // Should not receive update due to different message type
      const [value2] = result2.current

      expect(value2).toBe('initial')
    })
  })

  describe('channel lifecycle', () => {
    it('should cleanup channel on unmount', () => {
      const { unmount } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial')
      )

      // Should not throw on unmount
      expect(() => unmount()).not.toThrow()
    })

    it('should handle sending before channel is ready', () => {
      const { result } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial')
      )

      // Try to send immediately before channel is fully initialized
      // This should not throw
      expect(() => {
        const [, sendValue] = result.current

        sendValue('test')
      }).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined value', async () => {
      const { result: result1 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial')
      )

      const { result: result2 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial')
      )

      act(() => {
        const [, sendValue] = result1.current

        sendValue(undefined)
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      // undefined should be received
      const [value2] = result2.current

      expect(value2).toBeUndefined()
    })

    it('should handle boolean values', async () => {
      const { result: result1 } = renderHook(() =>
        useBroadcastChannelState('test-channel', false)
      )

      const { result: result2 } = renderHook(() =>
        useBroadcastChannelState('test-channel', false)
      )

      act(() => {
        const [, sendValue] = result1.current

        sendValue(true)
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      const [value2] = result2.current

      expect(value2).toBe(true)
    })

    it('should handle numeric zero', async () => {
      const { result: result1 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 1)
      )

      const { result: result2 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 1)
      )

      act(() => {
        const [, sendValue] = result1.current

        sendValue(0)
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      const [value2] = result2.current

      expect(value2).toBe(0)
    })

    it('should handle empty string', async () => {
      const { result: result1 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial')
      )

      const { result: result2 } = renderHook(() =>
        useBroadcastChannelState('test-channel', 'initial')
      )

      act(() => {
        const [, sendValue] = result1.current

        sendValue('')
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      const [value2] = result2.current

      expect(value2).toBe('')
    })
  })

  describe('channel isolation', () => {
    it('should isolate messages between different channel names', async () => {
      const { result: result1 } = renderHook(() =>
        useBroadcastChannelState('channel-a', 'initial')
      )

      const { result: result2 } = renderHook(() =>
        useBroadcastChannelState('channel-b', 'initial')
      )

      act(() => {
        const [, sendValue] = result1.current

        sendValue('updated')
      })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      // Different channel should not receive the message
      const [value2] = result2.current

      expect(value2).toBe('initial')
    })
  })
})
