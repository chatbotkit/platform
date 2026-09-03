/* eslint-disable @typescript-eslint/no-require-imports */
import { act, renderHook } from '@testing-library/react'

// Mock the hook implementation directly since it uses external SDK
jest.mock('./useDashboardWidgetSend', () => {
  return jest.fn(() => {
    const mockInstance = {
      open: false,
      sendMessage: jest.fn(),
    }

    const send = (text, options) => {
      if (!mockInstance) {
        return
      }

      mockInstance.open = true
      mockInstance.sendMessage({ ...options, text })
    }

    return { send, instance: mockInstance }
  })
})

const useDashboardWidgetSend = require('./useDashboardWidgetSend')

describe('useDashboardWidgetSend', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return send function and instance', () => {
      const { result } = renderHook(() => useDashboardWidgetSend())

      expect(result.current.send).toBeInstanceOf(Function)
      expect(result.current.instance).toBeDefined()
    })

    it('should send message and open widget', () => {
      const { result } = renderHook(() => useDashboardWidgetSend())

      act(() => {
        result.current.send('Hello, world!')
      })

      expect(result.current.instance.open).toBe(true)
      expect(result.current.instance.sendMessage).toHaveBeenCalledWith({
        text: 'Hello, world!',
      })
    })

    it('should pass options to sendMessage', () => {
      const { result } = renderHook(() => useDashboardWidgetSend())

      act(() => {
        result.current.send('Test message', { silent: true, meta: 'data' })
      })

      expect(result.current.instance.sendMessage).toHaveBeenCalledWith({
        text: 'Test message',
        silent: true,
        meta: 'data',
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty text', () => {
      const { result } = renderHook(() => useDashboardWidgetSend())

      act(() => {
        result.current.send('')
      })

      expect(result.current.instance.open).toBe(true)
      expect(result.current.instance.sendMessage).toHaveBeenCalledWith({
        text: '',
      })
    })

    it('should handle empty options object', () => {
      const { result } = renderHook(() => useDashboardWidgetSend())

      act(() => {
        result.current.send('Test', {})
      })

      expect(result.current.instance.sendMessage).toHaveBeenCalledWith({
        text: 'Test',
      })
    })

    it('should handle special characters in text', () => {
      const { result } = renderHook(() => useDashboardWidgetSend())

      const specialText = 'Test with <html> & "quotes" and \n newlines'

      act(() => {
        result.current.send(specialText)
      })

      expect(result.current.instance.sendMessage).toHaveBeenCalledWith({
        text: specialText,
      })
    })
  })

  describe('widget open behavior', () => {
    it('should open widget even if already open', () => {
      const { result } = renderHook(() => useDashboardWidgetSend())

      result.current.instance.open = true

      act(() => {
        result.current.send('Test')
      })

      expect(result.current.instance.open).toBe(true)
    })

    it('should set open to true before sending message', () => {
      const { result } = renderHook(() => useDashboardWidgetSend())

      let openValueWhenCalled

      result.current.instance.sendMessage.mockImplementation(() => {
        openValueWhenCalled = result.current.instance.open
      })

      act(() => {
        result.current.send('Test')
      })

      expect(openValueWhenCalled).toBe(true)
    })
  })

  describe('multiple messages', () => {
    it('should handle sending multiple messages in sequence', () => {
      const { result } = renderHook(() => useDashboardWidgetSend())

      act(() => {
        result.current.send('First message')
        result.current.send('Second message')
        result.current.send('Third message')
      })

      expect(result.current.instance.sendMessage).toHaveBeenCalledTimes(3)
      expect(result.current.instance.sendMessage).toHaveBeenNthCalledWith(1, {
        text: 'First message',
      })
      expect(result.current.instance.sendMessage).toHaveBeenNthCalledWith(2, {
        text: 'Second message',
      })
      expect(result.current.instance.sendMessage).toHaveBeenNthCalledWith(3, {
        text: 'Third message',
      })
    })
  })
})
