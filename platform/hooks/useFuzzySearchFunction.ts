import { useMemo } from 'react'

import Fuse, { type FuseOptionKey, type FuseResult } from 'fuse.js'

interface FuzzySearchFunctionOptions<T> {
  /** List of keys to search in (for object arrays) */
  keys?: FuseOptionKey<T>[]
  /** Match threshold (0.0 = perfect match, 1.0 = match anything) */
  threshold?: number
  /** Maximum distance for matches */
  distance?: number
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
 * A hook that returns a fuzzy search function for a given list.
 * Unlike useFuzzySearch, this returns a function that can be called
 * synchronously without debouncing, making it suitable for use in
 * event handlers and function packs.
 */
export default function useFuzzySearchFunction<T>(
  list: T[],
  options: FuzzySearchFunctionOptions<T> = {}
): (query: string) => T[] | FuseResult<T>[] {
  const {
    keys = [],
    threshold = 0.4,
    distance = 100,
    includeScore = false,
    includeMatches = false,
    minMatchCharLength = 1,
    limit,
    disabled = false,
  } = options

  const fuse = useMemo(() => {
    if (disabled || !list || list.length === 0) {
      return null
    }

    return new Fuse(list, {
      keys,
      threshold,
      distance,
      includeScore,
      includeMatches,
      minMatchCharLength,
      // @note case insensitive by default for better user satisfaction
      isCaseSensitive: false,
      // @note ignore location so matches anywhere in the string are found
      ignoreLocation: true,
      // @note find all matches for better fuzzy results
      findAllMatches: true,
    })
  }, [
    list,
    keys,
    threshold,
    distance,
    includeScore,
    includeMatches,
    minMatchCharLength,
    disabled,
  ])

  const searchFunction = useMemo(() => {
    return (query: string): T[] | FuseResult<T>[] => {
      if (disabled || !fuse) {
        return list
      }

      if (!query || query.trim() === '') {
        return list
      }

      // @note pass limit to fuse.search() for early termination which improves
      // performance by stopping the search once enough results are found

      const searchResults = fuse.search(query, limit ? { limit } : undefined)

      // @note return just the items if score/matches not requested

      if (!includeScore && !includeMatches) {
        return searchResults.map((result) => result.item)
      }

      return searchResults
    }
  }, [list, disabled, fuse, includeScore, includeMatches, limit])

  return searchFunction
}
