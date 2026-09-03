import { useEffect, useState } from 'react'
import type React from 'react'

interface UseAutoRevertOptions {
  delay?: number
}

export default function useAutoRevert({
  delay = 1000,
}: UseAutoRevertOptions = {}): [
  boolean,
  React.Dispatch<React.SetStateAction<boolean>>,
] {
  const [reverted, setReverted] = useState<boolean>(false)

  useEffect(() => {
    if (reverted) {
      const timeout = setTimeout(() => {
        setReverted(false)
      }, delay)

      return () => {
        clearTimeout(timeout)
      }
    }
  }, [delay, reverted])

  return [reverted, setReverted]
}
