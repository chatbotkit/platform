import { useMemo } from 'react'

import useDebounce from '@/hooks/useDebounce'
import useFuzzySearchFunction from '@/hooks/useFuzzySearchFunction'

import { type FuseOptionKey, type FuseResult } from 'fuse.js'

interface FuzzySearchOptions<T> {
  /** List of keys to search in (for object arrays) */
  keys?: FuseOptionKey<T>[]
  /** Match threshold (0.0 = perfect match, 1.0 = match anything) */
  threshold?: number
  /** Maximum distance for matches */
  distance?: number
  /** Debounce delay in milliseconds */
  debounce?: number
  /** Include match score in results */
  includeScore?: boolean
  /** Include match indices for highlighting */
  includeMatches?: boolean
  /** Minimum characters to match */
  minMatchCharLength?: number
  /** Maximum number of results to return (improves performance) */
  limit?: number
  /** Disable fuzzy search and return original list */
  disabled?: boolean
}

/**
 * A hook for performing fuzzy search on a list of items using Fuse.js.
 * This hook debounces the query and returns results automatically.
 * For synchronous search without debouncing, use useFuzzySearchFunction.
 */
export default function useFuzzySearch<T>(
  list: T[],
  query: string,
  options: FuzzySearchOptions<T> = {}
): T[] | FuseResult<T>[] {
  const {
    keys = [],
    threshold = 0.4,
    distance = 100,
    debounce = 300,
    includeScore = false,
    includeMatches = false,
    minMatchCharLength = 1,
    limit,
    disabled = false,
  } = options

  const debouncedQuery = useDebounce(query, debounce)

  // @note trim whitespace to ensure "hubspot" and "hubspot " return same results
  const trimmedQuery = debouncedQuery?.trim() || ''

  // @note use the base fuzzy search function hook
  const searchFunction = useFuzzySearchFunction(list, {
    keys,
    threshold,
    distance,
    includeScore,
    includeMatches,
    minMatchCharLength,
    limit,
    disabled,
  })

  const results = useMemo(() => {
    return searchFunction(trimmedQuery)
  }, [searchFunction, trimmedQuery])

  return results
}
