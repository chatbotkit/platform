/* eslint-disable @typescript-eslint/no-require-imports */
import useCopyWebsiteTheme from './useCopyWebsiteTheme'

import { act, renderHook } from '@testing-library/react'

jest.mock('@/hooks/usePopup', () => {
  return jest.fn(() => ({
    popup: <div data-testid="mock-popup">Popup Content</div>,
    openPopup: jest.fn(),
    closePopup: jest.fn(),
  }))
})

describe('useCopyWebsiteTheme', () => {
  let addEventListenerSpy
  let removeEventListenerSpy

  beforeEach(() => {
    jest.clearAllMocks()
    addEventListenerSpy = jest.spyOn(window, 'addEventListener')
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  describe('basic functionality', () => {
    it('should return popup component and open handler', () => {
      const onChange = jest.fn()
      const { result } = renderHook(() => useCopyWebsiteTheme(onChange))

      expect(result.current).toHaveLength(2)
      expect(result.current[0]).toBeDefined()
      expect(typeof result.current[1]).toBe('function')
    })

    it('should register message event listener on mount', () => {
      const onChange = jest.fn()

      renderHook(() => useCopyWebsiteTheme(onChange))

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )
    })

    it('should cleanup message event listener on unmount', () => {
      const onChange = jest.fn()
      const { unmount } = renderHook(() => useCopyWebsiteTheme(onChange))

      const messageHandler = addEventListenerSpy.mock.calls[0][1]

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'message',
        messageHandler
      )
    })
  })

  describe('popup handling', () => {
    it('should call openPopup when handler is invoked', () => {
      const onChange = jest.fn()
      const usePopup = require('@/hooks/usePopup')
      const mockOpenPopup = jest.fn()

      usePopup.mockReturnValue({
        popup: <div>Popup</div>,
        openPopup: mockOpenPopup,
        closePopup: jest.fn(),
      })

      const { result } = renderHook(() => useCopyWebsiteTheme(onChange))
      const [, handleOpenPopup] = result.current

      act(() => {
        handleOpenPopup()
      })

      expect(mockOpenPopup).toHaveBeenCalledTimes(1)
    })

    it('should call onChange callback on popup close', () => {
      const onChange = jest.fn()
      const usePopup = require('@/hooks/usePopup')

      let onCloseCallback

      usePopup.mockImplementation((config) => {
        onCloseCallback = config.onClose

        return {
          popup: <div>Popup</div>,
          openPopup: jest.fn(),
          closePopup: jest.fn(),
        }
      })

      renderHook(() => useCopyWebsiteTheme(onChange))

      act(() => {
        onCloseCallback()
      })

      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('message handling', () => {
    it('should ignore messages from different sources', () => {
      const onChange = jest.fn()

      renderHook(() => useCopyWebsiteTheme(onChange))

      const messageHandler = addEventListenerSpy.mock.calls[0][1]

      act(() => {
        messageHandler({
          source: null,
          data: { type: 'setProperties', data: {} },
        })
      })

      expect(onChange).not.toHaveBeenCalled()
    })

    it('should ignore messages with different type', () => {
      const onChange = jest.fn()

      renderHook(() => useCopyWebsiteTheme(onChange))

      const messageHandler = addEventListenerSpy.mock.calls[0][1]

      act(() => {
        messageHandler({
          source: window,
          data: { type: 'otherType', data: {} },
        })
      })

      expect(onChange).not.toHaveBeenCalled()
    })

    it('should handle setProperties message type', () => {
      const onChange = jest.fn()
      const usePopup = require('@/hooks/usePopup')
      const mockClosePopup = jest.fn()

      usePopup.mockReturnValue({
        popup: <div>Popup</div>,
        openPopup: jest.fn(),
        closePopup: mockClosePopup,
      })

      renderHook(() => useCopyWebsiteTheme(onChange))

      const messageHandler = addEventListenerSpy.mock.calls[0][1]

      act(() => {
        messageHandler({
          source: null,
          data: { type: 'setProperties', data: { color: 'blue' } },
        })
      })

      // @note message is ignored because source doesn't match widgetsPreviewRef.current.contentWindow
      expect(onChange).not.toHaveBeenCalled()
      expect(mockClosePopup).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle onChange callback not provided', () => {
      const { result } = renderHook(() => useCopyWebsiteTheme(undefined))

      expect(result.current).toHaveLength(2)
      expect(typeof result.current[1]).toBe('function')
    })

    it('should handle multiple re-renders without errors', () => {
      const onChange = jest.fn()
      const { rerender } = renderHook(() => useCopyWebsiteTheme(onChange))

      expect(() => {
        rerender()
        rerender()
      }).not.toThrow()
    })

    it('should preserve openPopup handler reference', () => {
      const onChange = jest.fn()
      const { result, rerender } = renderHook(() =>
        useCopyWebsiteTheme(onChange)
      )

      const [, handler1] = result.current

      rerender()

      const [, handler2] = result.current

      expect(handler1).toBe(handler2)
    })
  })
})
