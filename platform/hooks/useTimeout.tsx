import { useEffect, useRef } from 'react'
import type { DependencyList } from 'react'

/**
 * Hook that executes a callback after a specified delay.
 * The timeout is automatically cleared when the component unmounts or when dependencies change.
 */
export default function useTimeout(
  callback: () => void,
  delay: number | null,
  deps: DependencyList = []
): void {
  const savedCallback = useRef<(() => void) | undefined>(undefined)

  savedCallback.current = callback

  useEffect(() => {
    if (delay === null) {
      return undefined
    }

    const id = setTimeout(() => {
      if (savedCallback.current) {
        savedCallback.current()
      }
    }, delay)

    return () => clearTimeout(id)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, ...deps])
}
