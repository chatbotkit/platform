import { useCallback } from 'react'

import { getExternalAPIHostURL } from '@/lib/host'

import { useAPIHost } from '@/hooks/useHost'
import useHydrated from '@/hooks/useHydrated'

/**
 * Returns a function that builds an external API URL using the API hostname
 * injected into the document by request-context setup.
 */
export default function useExternalAPIURL(): (path: string) => string {
  const host = useAPIHost()
  const hydrated = useHydrated()

  // @note scheme changes must wait for hydration just like host changes
  return useCallback(
    (path: string) =>
      hydrated
        ? getExternalAPIHostURL(path, host)
        : getExternalAPIHostURL(path, host, { useRequestProtocol: false }),
    [host, hydrated]
  )
}
