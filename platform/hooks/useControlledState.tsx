import { useCallback, useRef, useState } from 'react'

import useInitial from '@/hooks/useInitial'

/**
 * A hook that manages state that can be either controlled or uncontrolled.
 *
 * When `value` or `setValue` is provided, the component operates in controlled
 * mode, using the external state. Otherwise, it manages its own internal state.
 *
 * @param initialValue - The initial value for uncontrolled mode
 * @param value - The controlled value (makes the hook controlled when defined)
 * @param setValue - The controlled setter (makes the hook controlled when defined)
 * @returns A tuple of [currentValue, setValueFn, initialValue]
 */
export default function useControlledState<T>(
  initialValue: T,
  value: T | undefined,
  setValue: ((value: T) => void) | undefined
): [T, (value: T | ((value: T) => T)) => void, T] {
  const isControlled = value !== undefined || setValue !== undefined

  const thisInitialValue = useInitial<T>(() => {
    if (isControlled) {
      return value as T
    }

    return initialValue
  })

  const [uncontrolledValue, setUncontrolledValue] = useState(thisInitialValue)

  const thisValue = isControlled ? (value as T) : uncontrolledValue

  const latestValueRef = useRef(thisValue)

  latestValueRef.current = thisValue

  const thisSetValue = useCallback(
    (newValueOrUpdater: T | ((value: T) => T)) => {
      const baseValue = latestValueRef.current

      const newValue =
        typeof newValueOrUpdater === 'function'
          ? (newValueOrUpdater as (value: T) => T)(baseValue)
          : newValueOrUpdater

      if (Object.is(newValue, baseValue)) {
        return
      }

      if (!isControlled) {
        latestValueRef.current = newValue

        setUncontrolledValue(newValue)
      }

      if (setValue) {
        // Only advance the ref for function updaters - direct values have no
        // chaining intent, and a stale speculative ref would deduplicate a
        // legitimate second call whose computed value happens to match.
        if (typeof newValueOrUpdater === 'function') {
          latestValueRef.current = newValue
        }

        setValue(newValue)
      }
    },
    [isControlled, setValue]
  )

  return [thisValue, thisSetValue, thisInitialValue]
}
