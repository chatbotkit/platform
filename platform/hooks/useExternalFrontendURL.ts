import { useCallback } from 'react'

import { getExternalFrontendHostURL } from '@/lib/host'

import useHost from '@/hooks/useHost'
import useHydrated from '@/hooks/useHydrated'

/**
 * Returns a function that builds an external frontend URL using the hostname
 * injected into the document by request-context setup.
 */
export default function useExternalFrontendURL(): (path: string) => string {
  const host = useHost()
  const hydrated = useHydrated()

  // @note the first render must use the server's scheme even when the page
  // has the same hostname on another scheme; a host change alone cannot
  // trigger React to repair that hydration mismatch
  return useCallback(
    (path: string) =>
      hydrated
        ? getExternalFrontendHostURL(path, host)
        : getExternalFrontendHostURL(path, host, { useRequestProtocol: false }),
    [host, hydrated]
  )
}
