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

    it('should remove listener on cleanup', () => {
      const { unmount } = renderHook(() => usePreventLeave(true))

      const listener = addEventListenerSpy.mock.calls[0][1]

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        listener
      )
    })
  })

  describe('disabled prop', () => {
    it('should not add listener when disabled is true', () => {
      renderHook(() => usePreventLeave(true, true))

      expect(addEventListenerSpy).not.toHaveBeenCalled()
    })

    it('should add listener when disabled is false', () => {
      renderHook(() => usePreventLeave(true, false))

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      )
    })

    it('should default disabled to false', () => {
      renderHook(() => usePreventLeave(true))

      expect(addEventListenerSpy).toHaveBeenCalled()
    })
  })

  describe('listener behavior', () => {
    it('should call preventDefault on beforeunload event', () => {
      renderHook(() => usePreventLeave(true))

      const listener = addEventListenerSpy.mock.calls[0][1]
      const mockEvent = {
        preventDefault: jest.fn(),
        returnValue: undefined,
      }

      listener(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.returnValue).toBe('')
    })

    it('should set returnValue to empty string', () => {
      renderHook(() => usePreventLeave(true))

      const listener = addEventListenerSpy.mock.calls[0][1]
      const mockEvent = {
        preventDefault: jest.fn(),
        returnValue: undefined,
      }

      listener(mockEvent)

      expect(mockEvent.returnValue).toBe('')
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

      const listener = addEventListenerSpy.mock.calls[0][1]

      rerender({ isModified: false })

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        listener
      )
    })

    it('should update listener when disabled changes', () => {
      const { rerender } = renderHook(
        ({ isModified, disabled }) => usePreventLeave(isModified, disabled),
        { initialProps: { isModified: true, disabled: false } }
      )

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1)

      const firstListener = addEventListenerSpy.mock.calls[0][1]

      rerender({ isModified: true, disabled: true })

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        firstListener
      )
      expect(addEventListenerSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('edge cases', () => {
    it('should handle undefined isModified', () => {
      renderHook(() => usePreventLeave(undefined))

      expect(addEventListenerSpy).not.toHaveBeenCalled()
    })

    it('should handle null isModified', () => {
      renderHook(() => usePreventLeave(null))

      expect(addEventListenerSpy).not.toHaveBeenCalled()
    })

    it('should handle multiple rerenders with same props', () => {
      const { rerender } = renderHook(() => usePreventLeave(true))

      const callCount = addEventListenerSpy.mock.calls.length

      rerender()
      rerender()
      rerender()

      expect(addEventListenerSpy).toHaveBeenCalledTimes(callCount)
    })
  })
})
