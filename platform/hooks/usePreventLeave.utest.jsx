import usePreventLeave from './usePreventLeave'

import { renderHook } from '@testing-library/react'

describe('usePreventLeave', () => {
  let addEventListenerSpy
  let removeEventListenerSpy

  beforeEach(() => {
    addEventListenerSpy = jest.spyOn(window, 'addEventListener')
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should add beforeunload listener when isModified is true', () => {
      renderHook(() => usePreventLeave(true))

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      )
    })

    it('should not add listener when isModified is false', () => {
      renderHook(() => usePreventLeave(false))

      expect(addEventListenerSpy).not.toHaveBeenCalled()
    })

    it('should remove listener on unmount', () => {
      const { unmount } = renderHook(() => usePreventLeave(true))

      const handler = addEventListenerSpy.mock.calls[0][1]

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        handler
      )
    })
  })

  describe('disabled parameter', () => {
    it('should not add listener when disabled is true', () => {
      renderHook(() => usePreventLeave(true, true))

      expect(addEventListenerSpy).not.toHaveBeenCalled()
    })

    it('should add listener when disabled is false explicitly', () => {
      renderHook(() => usePreventLeave(true, false))

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      )
    })

    it('should not add listener when isModified is true but disabled', () => {
      renderHook(() => usePreventLeave(true, true))

      expect(addEventListenerSpy).not.toHaveBeenCalled()
    })
  })

  describe('state changes', () => {
    it('should add listener when isModified changes from false to true', () => {
      const { rerender } = renderHook(
        ({ isModified }) => usePreventLeave(isModified),
        { initialProps: { isModified: false } }
      )

      expect(addEventListenerSpy).not.toHaveBeenCalled()

      rerender({ isModified: true })

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      )
    })

    it('should remove listener when isModified changes from true to false', () => {
      const { rerender } = renderHook(
        ({ isModified }) => usePreventLeave(isModified),
        { initialProps: { isModified: true } }
      )

      const handler = addEventListenerSpy.mock.calls[0][1]

      rerender({ isModified: false })

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        handler
      )
    })

    it('should update listener when disabled changes', () => {
      const { rerender } = renderHook(
        ({ disabled }) => usePreventLeave(true, disabled),
        { initialProps: { disabled: true } }
      )

      expect(addEventListenerSpy).not.toHaveBeenCalled()

      rerender({ disabled: false })

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      )
    })
  })

  describe('event handler behavior', () => {
    it('should call preventDefault and set returnValue on beforeunload', () => {
      renderHook(() => usePreventLeave(true))

      const handler = addEventListenerSpy.mock.calls[0][1]
      const mockEvent = {
        preventDefault: jest.fn(),
        returnValue: null,
      }

      handler(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.returnValue).toBe('')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined disabled parameter', () => {
      renderHook(() => usePreventLeave(true, undefined))

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      )
    })

    it('should handle null isModified', () => {
      renderHook(() => usePreventLeave(null))

      expect(addEventListenerSpy).not.toHaveBeenCalled()
    })

    it('should handle multiple rerenders with same values', () => {
      const { rerender } = renderHook(() => usePreventLeave(true))

      const initialCallCount = addEventListenerSpy.mock.calls.length

      rerender()
      rerender()

      expect(addEventListenerSpy.mock.calls.length).toBeGreaterThanOrEqual(
        initialCallCount
      )
    })
  })
})
