import type { ChangeEvent } from 'react'
import { useCallback } from 'react'

import useControlledState from '@/hooks/useControlledState'

/**
 * Options for the useControllableInput hook.
 */
interface UseControllableInputOptions<T = string> {
  /** Default value for uncontrolled mode */
  defaultValue?: T
  /** Current value for controlled mode */
  value?: T
  /** Setter function for controlled mode */
  setValue?: (value: T) => void
  /** Optional change callback */
  onChange?: (
    event: ChangeEvent<HTMLInputElement> | { target: { value: T } }
  ) => void
}

/**
 * Return type for the useControllableInput hook.
 */
type UseControllableInputReturn<T = string> = [
  /** Current value */
  T | undefined,
  /** onChange handler for input events */
  (event: ChangeEvent<HTMLInputElement>) => void,
  /** Direct value setter that also triggers onChange */
  (newValue: T) => void,
]

/**
 * Hook that provides controlled input functionality with support for
 * both controlled and uncontrolled modes.
 *
 * In uncontrolled mode, use defaultValue.
 * In controlled mode, use value and setValue.
 */
export default function useControllableInput<T = string>({
  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,
  onChange: _onChange,
}: UseControllableInputOptions<T>): UseControllableInputReturn<T> {
  const [value, setValue] = useControlledState(_defaultValue, _value, _setValue)

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value as T)

      if (_onChange) {
        _onChange(event)
      }
    },
    [setValue, _onChange]
  )

  const setValueAndChange = useCallback(
    (newValue: T) => {
      setValue(newValue)

      if (_onChange) {
        _onChange({ target: { value: newValue } })
      }
    },
    [setValue, _onChange]
  )

  return [value, onChange, setValueAndChange]
}
