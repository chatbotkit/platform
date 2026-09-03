'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { getLocalStorage } from '@/lib/browserstorage'

export interface UseLocalStorageOptions<T> {
  /**
   * Function to serialize the value to a string. Defaults to JSON.stringify.
   */
  serialize?: (value: T) => string
  /**
   * Function to deserialize the stored string to a value. Defaults to JSON.parse.
   */
  deserialize?: (raw: string) => T
}

/**
 * A hook that syncs state with localStorage, persisting values across
 * page reloads and browser sessions.
 *
 * @template T - The type of the stored value
 * @param key - The localStorage key to use
 * @param initialValue - The initial value if no stored value exists
 * @param options - Optional serialization/deserialization options
 * @returns A tuple of [value, setValue] similar to useState
 *
 * @example
 * // Store a boolean preference
 * const [showTokens, setShowTokens] = useLocalStorage('trace:showTokens', true)
 *
 * @example
 * // Store an object
 * const [filters, setFilters] = useLocalStorage('app:filters', { status: 'all' })
 */
export default function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: UseLocalStorageOptions<T>
): [T, (value: T | ((prev: T) => T)) => void] {
  const { serialize = JSON.stringify, deserialize = JSON.parse } = options || {}

  // @note use refs so unstable references (deserialize, initialValue) don't
  // trigger the sync effect on every render

  const deserializeRef = useRef(deserialize)

  deserializeRef.current = deserialize

  const initialValueRef = useRef(initialValue)

  initialValueRef.current = initialValue

  // @note use a ref so the instance is stable and never captured from SSR

  const storageRef = useRef<Storage | null>(null)

  const getStorage = useCallback(() => {
    if (!storageRef.current) {
      storageRef.current = getLocalStorage()
    }

    return storageRef.current
  }, [])

  // @note always start with initialValue so SSR and first client render match,
  // avoiding hydration mismatches when localStorage holds a different value

  const [value, setValue] = useState<T>(initialValue)

  // @note read the real stored value after mount (client only) and whenever the
  // key changes - useEffect never runs on the server so this is safe from SSR
  // and avoids hydration mismatches when localStorage holds a different value

  useEffect(() => {
    try {
      const item = getStorage().getItem(key)

      if (item !== null) {
        setValue(deserializeRef.current(item))
      } else {
        setValue(initialValueRef.current)
      }
    } catch {
      // @note failed to read or parse stored value, reset to initial
      setValue(initialValueRef.current)
    }
  }, [key, getStorage])

  const setStoredValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolvedValue =
          typeof newValue === 'function'
            ? (newValue as (prev: T) => T)(prev)
            : newValue

        try {
          getStorage().setItem(key, serialize(resolvedValue))
        } catch {
          // @note storage might be full or blocked, but state still updates
        }

        return resolvedValue
      })
    },
    [key, serialize, getStorage]
  )

  return [value, setStoredValue]
}
