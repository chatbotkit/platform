import useControllableInput from './useControllableInput'

import { act, renderHook } from '@testing-library/react'

describe('useControllableInput', () => {
  describe('uncontrolled mode (defaultValue)', () => {
    it('should initialize with defaultValue', () => {
      const { result } = renderHook(() =>
        useControllableInput({ defaultValue: 'initial' })
      )

      const [value] = result.current

      expect(value).toBe('initial')
    })

    it('should update value on onChange event', () => {
      const { result } = renderHook(() =>
        useControllableInput({ defaultValue: '' })
      )

      const [, onChange] = result.current

      act(() => {
        onChange({ target: { value: 'new value' } })
      })

      const [value] = result.current

      expect(value).toBe('new value')
    })

    it('should update value via setValueAndChange', () => {
      const { result } = renderHook(() =>
        useControllableInput({ defaultValue: 'initial' })
      )

      const [, , setValueAndChange] = result.current

      act(() => {
        setValueAndChange('updated')
      })

      const [value] = result.current

      expect(value).toBe('updated')
    })

    it('should call custom onChange callback when provided', () => {
      const mockOnChange = jest.fn()

      const { result } = renderHook(() =>
        useControllableInput({
          defaultValue: '',
          onChange: mockOnChange,
        })
      )

      const [, onChange] = result.current

      const event = { target: { value: 'test' } }

      act(() => {
        onChange(event)
      })

      expect(mockOnChange).toHaveBeenCalledWith(event)
      expect(mockOnChange).toHaveBeenCalledTimes(1)
    })

    it('should call onChange callback with setValueAndChange', () => {
      const mockOnChange = jest.fn()

      const { result } = renderHook(() =>
        useControllableInput({
          defaultValue: '',
          onChange: mockOnChange,
        })
      )

      const [, , setValueAndChange] = result.current

      act(() => {
        setValueAndChange('new value')
      })

      expect(mockOnChange).toHaveBeenCalledWith({
        target: { value: 'new value' },
      })
      expect(mockOnChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('controlled mode (value + setValue)', () => {
    it('should use controlled value', () => {
      const mockSetValue = jest.fn()

      const { result } = renderHook(() =>
        useControllableInput({
          value: 'controlled',
          setValue: mockSetValue,
        })
      )

      const [value] = result.current

      expect(value).toBe('controlled')
    })

    it('should call setValue on onChange', () => {
      const mockSetValue = jest.fn()

      const { result } = renderHook(() =>
        useControllableInput({
          value: 'initial',
          setValue: mockSetValue,
        })
      )

      const [, onChange] = result.current

      act(() => {
        onChange({ target: { value: 'changed' } })
      })

      expect(mockSetValue).toHaveBeenCalledWith('changed')
      expect(mockSetValue).toHaveBeenCalledTimes(1)
    })

    it('should call setValue via setValueAndChange', () => {
      const mockSetValue = jest.fn()

      const { result } = renderHook(() =>
        useControllableInput({
          value: 'initial',
          setValue: mockSetValue,
        })
      )

      const [, , setValueAndChange] = result.current

      act(() => {
        setValueAndChange('direct update')
      })

      expect(mockSetValue).toHaveBeenCalledWith('direct update')
      expect(mockSetValue).toHaveBeenCalledTimes(1)
    })

    it('should call both setValue and onChange callbacks', () => {
      const mockSetValue = jest.fn()
      const mockOnChange = jest.fn()

      const { result } = renderHook(() =>
        useControllableInput({
          value: 'initial',
          setValue: mockSetValue,
          onChange: mockOnChange,
        })
      )

      const [, onChange] = result.current

      const event = { target: { value: 'test' } }

      act(() => {
        onChange(event)
      })

      expect(mockSetValue).toHaveBeenCalledWith('test')
      expect(mockOnChange).toHaveBeenCalledWith(event)
    })
  })

  describe('edge cases', () => {
    it('should handle empty string as defaultValue', () => {
      const { result } = renderHook(() =>
        useControllableInput({ defaultValue: '' })
      )

      const [value] = result.current

      expect(value).toBe('')
    })

    it('should handle null as defaultValue', () => {
      const { result } = renderHook(() =>
        useControllableInput({ defaultValue: null })
      )

      const [value] = result.current

      expect(value).toBeNull()
    })

    it('should handle undefined as defaultValue', () => {
      const { result } = renderHook(() =>
        useControllableInput({ defaultValue: undefined })
      )

      const [value] = result.current

      expect(value).toBeUndefined()
    })

    it('should work without any callbacks', () => {
      const { result } = renderHook(() =>
        useControllableInput({ defaultValue: 'test' })
      )

      const [, onChange, setValueAndChange] = result.current

      act(() => {
        onChange({ target: { value: 'changed' } })
      })

      const [value1] = result.current

      expect(value1).toBe('changed')

      act(() => {
        setValueAndChange('updated')
      })

      const [value2] = result.current

      expect(value2).toBe('updated')
    })

    it('should handle rapid value changes', () => {
      const { result } = renderHook(() =>
        useControllableInput({ defaultValue: '' })
      )

      const [, onChange] = result.current

      act(() => {
        onChange({ target: { value: 'a' } })
        onChange({ target: { value: 'ab' } })
        onChange({ target: { value: 'abc' } })
      })

      const [value] = result.current

      expect(value).toBe('abc')
    })
  })

  describe('callback stability', () => {
    it('should maintain callback references when callbacks change', () => {
      const mockOnChange1 = jest.fn()
      const mockOnChange2 = jest.fn()

      const { result, rerender } = renderHook(
        ({ onChange }) => useControllableInput({ defaultValue: '', onChange }),
        { initialProps: { onChange: mockOnChange1 } }
      )

      const [, onChange1] = result.current

      rerender({ onChange: mockOnChange2 })

      const [, onChange2] = result.current

      // onChange callback should be different due to dependency change
      expect(onChange1).not.toBe(onChange2)

      act(() => {
        onChange2({ target: { value: 'test' } })
      })

      expect(mockOnChange2).toHaveBeenCalledWith({ target: { value: 'test' } })
      expect(mockOnChange1).not.toHaveBeenCalled()
    })
  })
})
