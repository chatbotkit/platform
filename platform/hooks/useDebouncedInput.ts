import { useCallback, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, RefObject } from 'react'

interface DebouncedInputOptions {
  /** Initial value for the input */
  defaultValue?: string
  /** Debounce delay in milliseconds (default: 300) */
  delay?: number
}

interface DebouncedInputResult {
  /** Current debounced value (updates after delay) */
  value: string
  /** Ref to attach to the input element */
  inputRef: RefObject<HTMLInputElement | null>
  /** Props to spread on the input element */
  inputProps: {
    ref: RefObject<HTMLInputElement | null>
    defaultValue: string
    onChange: (event: ChangeEvent<HTMLInputElement>) => void
  }
  /** Manually set the value (updates both input and state immediately) */
  setValue: (value: string) => void
  /** Clear the input */
  clear: () => void
}

/**
 * A hook for high-performance debounced input handling.
 *
 * Uses an uncontrolled input pattern to avoid React re-renders on every
 * keystroke. The debounced value only updates after the specified delay,
 * triggering a single re-render instead of one per keystroke.
 *
 * @example
 * ```tsx
 * function SearchBox() {
 *   const { value, inputProps } = useDebouncedInput({ delay: 300 })
 *
 *   // value only updates 300ms after user stops typing
 *   const results = useFuzzySearch(items, value)
 *
 *   return <input {...inputProps} placeholder="Search..." />
 * }
 * ```
 */
export default function useDebouncedInput(
  options: DebouncedInputOptions = {}
): DebouncedInputResult {
  const { defaultValue = '', delay = 300 } = options

  const inputRef = useRef<HTMLInputElement | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [value, setValueState] = useState(defaultValue)

  // @note debounced handler that only updates state after delay
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        setValueState(newValue)
      }, delay)
    },
    [delay]
  )

  // @note immediately set both input value and state (for programmatic updates)
  const setValue = useCallback((newValue: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (inputRef.current) {
      inputRef.current.value = newValue
    }

    setValueState(newValue)
  }, [])

  // @note clear both input and state
  const clear = useCallback(() => {
    setValue('')
  }, [setValue])

  // @note memoized props object to avoid unnecessary re-renders
  const inputProps = useMemo(
    () => ({
      ref: inputRef,
      defaultValue,
      onChange: handleChange,
    }),
    [defaultValue, handleChange]
  )

  return {
    value,
    inputRef,
    inputProps,
    setValue,
    clear,
  }
}
