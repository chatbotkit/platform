import { useEffect, useRef, useState } from 'react'

/**
 * Hook that increments an index after a delay until reaching a target value.
 */
export default function useIncrementIndexAfterDelay(
  to: number,
  delay: number = 1000,
  disabled: boolean = false
): number {
  const [index, setIndex] = useState<number>(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (to < 0 || (!Number.isFinite(to) && to !== Infinity)) {
      setIndex(0)

      return
    }

    if (Number.isFinite(to) && index > to) {
      setIndex(to)

      return
    }
  }, [to, index])

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)

      intervalRef.current = null
    }

    if (disabled) {
      return
    }

    if (to < 0) {
      return
    }

    if (!Number.isFinite(to) && to !== Infinity) {
      return
    }

    if (delay <= 0) {
      return
    }

    intervalRef.current = setInterval(() => {
      setIndex((current) => {
        if (Number.isFinite(to)) {
          if (current >= to) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current)

              intervalRef.current = null
            }

            return to
          }

          return current + 1
        }

        return current + 1
      })
    }, delay)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)

        intervalRef.current = null
      }
    }
  }, [to, delay, disabled])

  return index
}
