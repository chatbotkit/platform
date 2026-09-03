import { useState } from 'react'

import useControlledState from './useControlledState'

import { act, renderHook } from '@testing-library/react'

describe('useControlledState', () => {
  describe('uncontrolled mode', () => {
    it('should use initial value when uncontrolled', () => {
      const { result } = renderHook(() =>
        useControlledState('initial', undefined, undefined)
      )

      const [value] = result.current

      expect(value).toBe('initial')
    })

    it('should update internal state when setValue is called', () => {
      const { result } = renderHook(() =>
        useControlledState('initial', undefined, undefined)
      )

      act(() => {
        const [, setValue] = result.current

        setValue('updated')
      })

      const [value] = result.current

      expect(value).toBe('updated')
    })

    it('should handle multiple state updates', () => {
      const { result } = renderHook(() =>
        useControlledState(0, undefined, undefined)
      )

      act(() => {
        const [, setValue] = result.current

        setValue(1)
      })

      expect(result.current[0]).toBe(1)

      act(() => {
        const [, setValue] = result.current

        setValue(2)
      })

      expect(result.current[0]).toBe(2)

      act(() => {
        const [, setValue] = result.current

        setValue(3)
      })

      expect(result.current[0]).toBe(3)
    })

    it('should return initial value as third element', () => {
      const { result } = renderHook(() =>
        useControlledState('initial', undefined, undefined)
      )

      const [, , initialValue] = result.current

      expect(initialValue).toBe('initial')
    })

    it('should preserve initial value after updates', () => {
      const { result } = renderHook(() =>
        useControlledState('initial', undefined, undefined)
      )

      act(() => {
        const [, setValue] = result.current

        setValue('updated')
      })

      const [, , initialValue] = result.current

      expect(initialValue).toBe('initial')
    })
  })

  describe('controlled mode with value only', () => {
    it('should use controlled value when value is provided', () => {
      const { result } = renderHook(() =>
        useControlledState('initial', 'controlled', undefined)
      )

      const [value] = result.current

      expect(value).toBe('controlled')
    })

    it('should update when controlled value changes', () => {
      const { result, rerender } = renderHook(
        ({ controlledValue }) =>
          useControlledState('initial', controlledValue, undefined),
        { initialProps: { controlledValue: 'first' } }
      )

      expect(result.current[0]).toBe('first')

      rerender({ controlledValue: 'second' })

      expect(result.current[0]).toBe('second')
    })

    it('should not update internal state in controlled mode', () => {
      const { result } = renderHook(() =>
        useControlledState('initial', 'controlled', undefined)
      )

      act(() => {
        const [, setValue] = result.current

        setValue('attempted update')
      })

      const [value] = result.current

      expect(value).toBe('controlled')
    })

    it('should use controlled value as initial value', () => {
      const { result } = renderHook(() =>
        useControlledState('initial', 'controlled', undefined)
      )

      const [, , initialValue] = result.current

      expect(initialValue).toBe('controlled')
    })
  })

  describe('controlled mode with setValue callback', () => {
    it('should use controlled value when setValue is provided', () => {
      const setValue = jest.fn()
      const { result } = renderHook(() =>
        useControlledState('initial', 'controlled', setValue)
      )

      const [value] = result.current

      expect(value).toBe('controlled')
    })

    it('should call setValue callback when internal setValue is called', () => {
      const setValueCallback = jest.fn()
      const { result } = renderHook(() =>
        useControlledState('initial', 'controlled', setValueCallback)
      )

      act(() => {
        const [, setValue] = result.current

        setValue('new value')
      })

      expect(setValueCallback).toHaveBeenCalledWith('new value')
      expect(setValueCallback).toHaveBeenCalledTimes(1)
    })

    it('should resolve function updater before calling setValue callback', () => {
      const setValueCallback = jest.fn()
      const { result } = renderHook(() =>
        useControlledState('initial', 'controlled', setValueCallback)
      )

      const updater = (prev) => prev + ' updated'

      act(() => {
        const [, setValue] = result.current

        setValue(updater)
      })

      expect(setValueCallback).toHaveBeenCalledWith('controlled updated')
    })

    it('should accumulate controlled function updaters before parent rerender', () => {
      const { result } = renderHook(() => {
        const [controlledValue, setControlledValue] = useState('')

        const [value, setValue] = useControlledState(
          '',
          controlledValue,
          setControlledValue
        )

        return { value, setValue }
      })

      act(() => {
        result.current.setValue((prev) => prev + 't')
        result.current.setValue((prev) => prev + 'e')
        result.current.setValue((prev) => prev + 's')
      })

      expect(result.current.value).toBe('tes')
    })

    it('should update value only when controlled value changes from parent', () => {
      const setValueCallback = jest.fn()
      const { result, rerender } = renderHook(
        ({ controlledValue }) =>
          useControlledState('initial', controlledValue, setValueCallback),
        { initialProps: { controlledValue: 'first' } }
      )

      expect(result.current[0]).toBe('first')

      // Parent updates controlled value
      rerender({ controlledValue: 'second' })

      expect(result.current[0]).toBe('second')

      // Internal setValue should call callback but not change displayed value
      act(() => {
        const [, setValue] = result.current

        setValue('internal attempt')
      })

      expect(setValueCallback).toHaveBeenCalledWith('internal attempt')
      expect(result.current[0]).toBe('second')
    })
  })

  describe('controlled mode with undefined value but setValue callback', () => {
    it('should be in controlled mode when only setValue is provided', () => {
      const setValueCallback = jest.fn()
      const { result } = renderHook(() =>
        useControlledState('initial', undefined, setValueCallback)
      )

      const [value] = result.current

      expect(value).toBe(undefined)
    })

    it('should call setValue callback in controlled mode with undefined value', () => {
      const setValueCallback = jest.fn()
      const { result } = renderHook(() =>
        useControlledState('initial', undefined, setValueCallback)
      )

      act(() => {
        const [, setValue] = result.current

        setValue('new value')
      })

      expect(setValueCallback).toHaveBeenCalledWith('new value')
    })
  })

  describe('callback stability', () => {
    it('should maintain stable setValue reference when controlled', () => {
      const setValueCallback = jest.fn()
      const { result, rerender } = renderHook(() =>
        useControlledState('initial', 'controlled', setValueCallback)
      )

      const firstSetValue = result.current[1]

      rerender()

      const secondSetValue = result.current[1]

      expect(firstSetValue).toBe(secondSetValue)
    })

    it('should update setValue when isControlled state changes', () => {
      const setValueCallback = jest.fn()
      const { result, rerender } = renderHook(
        ({ controlled }) =>
          useControlledState(
            'initial',
            controlled ? 'controlled' : undefined,
            controlled ? setValueCallback : undefined
          ),
        { initialProps: { controlled: false } }
      )

      const uncontrolledSetValue = result.current[1]

      rerender({ controlled: true })

      const controlledSetValue = result.current[1]

      // Should be different references
      expect(uncontrolledSetValue).not.toBe(controlledSetValue)
    })
  })

  describe('edge cases', () => {
    it('should handle null as initial value', () => {
      const { result } = renderHook(() =>
        useControlledState(null, undefined, undefined)
      )

      const [value] = result.current

      expect(value).toBe(null)
    })

    it('should handle undefined as initial value', () => {
      const { result } = renderHook(() =>
        useControlledState(undefined, undefined, undefined)
      )

      const [value] = result.current

      expect(value).toBe(undefined)
    })

    it('should handle 0 as initial value', () => {
      const { result } = renderHook(() =>
        useControlledState(0, undefined, undefined)
      )

      const [value] = result.current

      expect(value).toBe(0)
    })

    it('should handle empty string as initial value', () => {
      const { result } = renderHook(() =>
        useControlledState('', undefined, undefined)
      )

      const [value] = result.current

      expect(value).toBe('')
    })

    it('should handle false as initial value', () => {
      const { result } = renderHook(() =>
        useControlledState(false, undefined, undefined)
      )

      const [value] = result.current

      expect(value).toBe(false)
    })

    it('should handle object as initial value', () => {
      const initialObject = { key: 'value' }
      const { result } = renderHook(() =>
        useControlledState(initialObject, undefined, undefined)
      )

      const [value] = result.current

      expect(value).toEqual(initialObject)
    })

    it('should handle array as initial value', () => {
      const initialArray = [1, 2, 3]
      const { result } = renderHook(() =>
        useControlledState(initialArray, undefined, undefined)
      )

      const [value] = result.current

      expect(value).toEqual(initialArray)
    })
  })

  describe('cleanup', () => {
    it('should not throw errors on unmount', () => {
      const { unmount } = renderHook(() =>
        useControlledState('initial', undefined, undefined)
      )

      expect(() => unmount()).not.toThrow()
    })

    it('should not throw errors on unmount in controlled mode', () => {
      const setValueCallback = jest.fn()
      const { unmount } = renderHook(() =>
        useControlledState('initial', 'controlled', setValueCallback)
      )

      expect(() => unmount()).not.toThrow()
    })
  })
})
