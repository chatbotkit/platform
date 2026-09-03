'use client'

import { isDevelopment } from '@/lib/env'

import useCache from '@/hooks/useCache'
import useFetch from '@/hooks/useFetch'

// @note keep a stable identity so consumers can use the list as an effect dep
const NO_TEMPLATES = []

/**
 * Load the platform secret template catalogue.
 *
 * Ability templates point at these by key, and each one carries the name, type,
 * kind and config a secret needs to be created with.
 */
export default function useSecretTemplates() {
  const { fetch } = useFetch({
    failureMessage: true,
  })

  const { data, loading } = useCache(
    'platform:secret:list',
    async () => {
      const { error, data } = await fetch('/api/v1/platform/secret/list')

      if (error) {
        throw error
      }

      return data
    },
    {
      ttl: 30 * 60 * 1000, // cache for 30 minutes
      disabled: isDevelopment,
      staleWhileRevalidate: true,
    },
    []
  )

  return {
    secretTemplates: data?.items || NO_TEMPLATES,
    loading,
  }
}
