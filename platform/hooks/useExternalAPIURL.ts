import { useCallback } from 'react'

import { getExternalAPIHostURL } from '@/lib/host'

import { useAPIHostname } from '@/hooks/useHostname'

/**
 * Returns a function that builds an external API URL using the API hostname
 * injected into the document by request-context setup.
 */
export default function useExternalAPIURL(): (path: string) => string {
  const hostname = useAPIHostname()

  return useCallback(
    (path: string) => getExternalAPIHostURL(path, hostname),
    [hostname]
  )
}
