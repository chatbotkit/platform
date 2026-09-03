'use client'

import { isDevelopment } from '@/lib/env'

import useCache from '@/hooks/useCache'
import useFetch from '@/hooks/useFetch'

// @note keep a stable identity so consumers can use the list as an effect dep
const NO_TEMPLATES = []

/**
 * Load the platform ability template catalogue.
 *
 * The result is cached under a single key, so every dialog which browses the
 * catalogue shares one fetch.
 */
export default function useAbilityTemplates() {
  const { fetch } = useFetch({
    failureMessage: true,
  })

  const { data, loading } = useCache(
    'platform:ability:list',
    async () => {
      const { error, data } = await fetch('/api/v1/platform/ability/list')

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
    templates: data?.items || NO_TEMPLATES,
    loading,
  }
}
