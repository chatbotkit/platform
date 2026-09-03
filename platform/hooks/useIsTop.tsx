import { useEffect, useState } from 'react'

export default function useIsTop(
  defaultValue: boolean | null = null
): boolean | null {
  const [isTop, setIsTop] = useState<boolean | null>(defaultValue)

  useEffect(() => {
    setIsTop(window.top === window.self)
  }, [])

  return isTop
}
