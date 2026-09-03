import { useCallback } from 'react'

import { getExternalFrontendHostURL } from '@/lib/host'

import useHostname from '@/hooks/useHostname'

/**
 * Returns a function that builds an external frontend URL using the hostname
 * injected into the document by request-context setup.
 */
export default function useExternalFrontendURL(): (path: string) => string {
  const hostname = useHostname()

  return useCallback(
    (path: string) => getExternalFrontendHostURL(path, hostname),
    [hostname]
  )
}
