import { useEffect, useRef } from 'react'

export default function useIsMounted(): boolean {
  const isMountedRef = useRef<boolean>(false)

  useEffect(() => {
    isMountedRef.current = true
  }, [])

  return isMountedRef.current
}
