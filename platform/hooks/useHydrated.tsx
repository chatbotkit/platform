import { useState } from 'react'

import useHydrationSafeLayoutEffect from '@/hooks/useHydrationSafeLayoutEffect'

/**
 * Reports whether the client has taken over from the server-rendered HTML.
 */
export default function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)

  useHydrationSafeLayoutEffect(() => {
    setHydrated(true)
  }, [])

  return hydrated
}
