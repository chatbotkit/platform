import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getLocalStorage } from '@/lib/browserstorage'
import { captureException } from '@/lib/error'

import useDeps from '@/hooks/useDeps'

export interface UseCacheOptions {
  /**
   * Time-to-live in milliseconds. Defaults to 30 minutes.
   */
  ttl?: number
  /**
   * Whether the cache is disabled. When true, the query will still execute
   * but caching is bypassed (no reading from or writing to localStorage).
   * Useful for development environments where fresh data is always needed.
   */
  disabled?: boolean
  /**
   * When true, returns stale cached data immediately while fetching fresh data
   * in the background. This prevents the loading state from appearing when
   * cached data exists, providing a better user experience. The data will be
   * automatically updated once the fresh data is fetched.
   *
   * @default false
   *
   * @example
   * // returns cached data instantly, fetches fresh data in background
   * const { data, loading } = useCache(
   *   'key',
   *   fetchData,
   *   { staleWhileRevalidate: true },
   *   []
   * )
   */
  staleWhileRevalidate?: boolean
}

export interface UseCacheResult<T> {
  /**
   * The cached or fetched data
   */
  data: T | null
  /**
   * Loading state
   */
  loading: boolean
  /**
   * Error from the query function
   */
  error: Error | null
  /**
   * Force refresh the data, bypassing cache
   */
  refresh: () => Promise<void>
  /**
   * Clear the cache for this key
   */
  clearCache: () => void
}

/**
 * A hook that caches the result of an async function in localStorage
 * with a configurable TTL (time-to-live).
 *
 * Cache Behavior:
 * - By default, when the cache is expired, loading is set to true while fetching fresh data
 * - With `staleWhileRevalidate: true`, stale cached data is returned immediately without
 *   showing a loading state, while fresh data is fetched in the background
 * - On error, cached data (if available) is retained and displayed
 *
 * @template T - The type of data returned by the query function
 * @param key - The cache key for localStorage
 * @param queryFn - The async function to execute
 * @param options - Configuration options
 * @param deps - Dependency array to track when to re-execute the query
 * @returns Object containing data, loading state, error, and control functions
 *
 * @example
 * // standard caching - shows loading when cache expires
 * const { data, loading, error, refresh } = useCache(
 *   'platformTemplates',
 *   () => client.platformTemplates(),
 *   { ttl: 30 * 60 * 1000 }, // 30 minutes
 *   []
 * )
 *
 * @example
 * // stale-while-revalidate - returns stale data instantly, fetches in background
 * const { data, loading, error, refresh } = useCache(
 *   'platformTemplates',
 *   () => client.platformTemplates(),
 *   { ttl: 5 * 60 * 1000, staleWhileRevalidate: true },
 *   []
 * )
 */
export default function useCache<T = unknown>(
  key: string,
  queryFn: () => Promise<T>,
  options?: UseCacheOptions,
  deps: React.DependencyList = []
): UseCacheResult<T> {
  const {
    ttl = 30 * 60 * 1000,
    disabled = false,
    staleWhileRevalidate = false,
  } = options || {}

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const thisDeps = useDeps(deps as unknown[])

  // @note track in-flight fetch to prevent double-fetching in React Strict Mode

  const fetchInFlightRef = useRef(false)

  // @note use safe storage wrapper to avoid SecurityError in cross-origin
  // iframes or private mode

  const storage = useMemo(() => getLocalStorage(), [])

  const getCacheKey = useCallback(() => {
    return `cache:${key}`
  }, [key])

  const getTimestampKey = useCallback(() => {
    return `cache:${key}:timestamp`
  }, [key])

  const isCacheValid = useCallback(() => {
    try {
      const timestamp = storage.getItem(getTimestampKey())

      if (!timestamp) {
        return false
      }

      const age = Date.now() - parseInt(timestamp, 10)

      return age < ttl
    } catch {
      // localStorage might be disabled or full

      return false
    }
  }, [storage, getTimestampKey, ttl])

  const getCachedData = useCallback((): T | null => {
    try {
      const cached = storage.getItem(getCacheKey())

      if (!cached) {
        return null
      }

      return JSON.parse(cached) as T
    } catch {
      // Failed to parse cached data

      return null
    }
  }, [storage, getCacheKey])

  const setCachedData = useCallback(
    (data: T) => {
      try {
        storage.setItem(getCacheKey(), JSON.stringify(data))
        storage.setItem(getTimestampKey(), Date.now().toString())
      } catch (e) {
        // localStorage might be disabled or full

        void captureException(e)
      }
    },
    [storage, getCacheKey, getTimestampKey]
  )

  const clearCache = useCallback(() => {
    try {
      storage.removeItem(getCacheKey())
      storage.removeItem(getTimestampKey())
    } catch (e) {
      void captureException(e)
    }
  }, [storage, getCacheKey, getTimestampKey])

  const fetchData = useCallback(
    async (force = false, skipInflightCheck = false) => {
      // @note prevent double-fetching in React Strict Mode - skipInflightCheck
      // allows refresh() to bypass this guard

      if (!skipInflightCheck && fetchInFlightRef.current) {
        return
      }

      // @note when disabled is true, we bypass cache entirely but still execute
      // the query

      // Check cache first unless forcing refresh or cache is disabled

      if (!disabled && !force && isCacheValid()) {
        const cached = getCachedData()

        if (cached) {
          setData(cached)
          setError(null)

          return
        }
      }

      // With staleWhileRevalidate, if we have stale cached data, use it
      // immediately and fetch fresh data in the background
      // @note only applies when cache is not disabled

      const cachedData = !disabled ? getCachedData() : null

      if (staleWhileRevalidate && cachedData && !force) {
        setData(cachedData)
        setError(null)

        // fetch in background without showing loading state
      } else {
        setLoading(true)
      }

      fetchInFlightRef.current = true

      setError(null)

      try {
        const result = await queryFn()

        setData(result)

        // @note only write to cache when not disabled

        if (!disabled) {
          setCachedData(result)
        }

        setError(null)
      } catch (e) {
        void captureException(e)

        setError(e as Error)

        // If we have cached data, keep showing it even on error

        if (cachedData) {
          setData(cachedData)
        }
      } finally {
        fetchInFlightRef.current = false

        setLoading(false)
      }
    },
    [
      disabled,
      isCacheValid,
      getCachedData,
      setCachedData,
      queryFn,
      staleWhileRevalidate,
    ]
  )

  const refresh = useCallback(async () => {
    await fetchData(true, true)
  }, [fetchData])

  useEffect(() => {
    void fetchData()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thisDeps, disabled])

  return {
    data,
    loading,
    error,
    refresh,
    clearCache,
  }
}
