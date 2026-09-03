import { useEffect, useRef, useState } from 'react'

export default function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)

  const lastRan = useRef<number>(Date.now())

  useEffect(() => {
    const handler = setTimeout(
      () => {
        const timeSinceLastRun = Date.now() - lastRan.current

        if (timeSinceLastRun >= delay) {
          setThrottledValue(value)

          lastRan.current = Date.now()
        }
      },
      delay - (Date.now() - lastRan.current)
    )

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return throttledValue
}
