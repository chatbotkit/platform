import { useEffect, useState } from 'react'
import type { DependencyList } from 'react'

import useDeps from '@/hooks/useDeps'

export default function useDebounce<T>(
  value: T,
  delay: number,
  deps?: DependencyList
): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  const thisDeps = useDeps(deps)

  useEffect(() => {
    if (delay < 1) {
      setDebouncedValue(value)

      return
    }

    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay, thisDeps])

  return debouncedValue
}
