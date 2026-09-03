import { useEffect, useRef } from 'react'

export default function usePrevious<T>(
  value: T,
  defaultValue?: T
): T | undefined {
  const ref = useRef<T | undefined>(defaultValue)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current
}
