import { useEffect, useState } from 'react'

export default function useWindowFocus(): boolean {
  const isClient = typeof window === 'object' && window !== null

  const [isFocused, setIsFocused] = useState<boolean>(
    isClient ? document.hasFocus() : false
  )

  useEffect(() => {
    if (isClient) {
      const handleFocus = (): void => setIsFocused(true)
      const handleBlur = (): void => setIsFocused(false)

      window.addEventListener('focus', handleFocus)
      window.addEventListener('blur', handleBlur)

      return () => {
        window.removeEventListener('focus', handleFocus)
        window.removeEventListener('blur', handleBlur)
      }
    }
  }, [isClient])

  return isFocused
}
