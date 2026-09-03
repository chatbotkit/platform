import useFuzzySearch from '@/hooks/useFuzzySearch'

import { renderHook } from '@testing-library/react'

describe('useFuzzySearch', () => {
  const sampleList = [
    {
      id: '1',
      name: 'Apple',
      description: 'A red fruit',
      tags: ['fruit', 'red'],
    },
    {
      id: '2',
      name: 'Banana',
      description: 'A yellow fruit',
      tags: ['fruit', 'yellow'],
    },
    {
      id: '3',
      name: 'Orange',
      description: 'An orange citrus',
      tags: ['citrus', 'orange'],
    },
    {
      id: '4',
      name: 'Grape',
      description: 'Small purple fruit',
      tags: ['fruit', 'purple'],
    },
  ]

  describe('basic search functionality', () => {
    it('should return all items when query is empty', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleList, '', {
          keys: ['name', 'description', 'tags'],
          debounce: 0,
        })
      )

      expect(result.current).toHaveLength(4)
      expect(result.current).toEqual(sampleList)
    })

    it('should return all items when query is whitespace only', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleList, '   ', {
          keys: ['name', 'description', 'tags'],
          debounce: 0,
        })
      )

      expect(result.current).toHaveLength(4)
    })

    it('should find items by name with best match first', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleList, 'apple', {
          keys: ['name'],
          debounce: 0,
        })
      )

      // @note fuzzy search may return multiple results, but best match should be first
      expect(result.current.length).toBeGreaterThanOrEqual(1)
      expect(result.current[0].name).toBe('Apple')
    })

    it('should find items by description', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleList, 'citrus', {
          keys: ['description'],
          debounce: 0,
        })
      )

      expect(result.current).toHaveLength(1)
      expect(result.current[0].name).toBe('Orange')
    })

    it('should find items by tags', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleList, 'purple', {
          keys: ['tags'],
          debounce: 0,
        })
      )

      expect(result.current).toHaveLength(1)
      expect(result.current[0].name).toBe('Grape')
    })
  })

  describe('fuzzy matching', () => {
    it('should perform case-insensitive search', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleList, 'APPLE', {
          keys: ['name'],
          debounce: 0,
        })
      )

      // @note best match should be first
      expect(result.current.length).toBeGreaterThanOrEqual(1)
      expect(result.current[0].name).toBe('Apple')
    })

    it('should find fuzzy matches with typos', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleList, 'banan', {
          keys: ['name'],
          debounce: 0,
          threshold: 0.6,
        })
      )

      // @note best match should be first
      expect(result.current.length).toBeGreaterThanOrEqual(1)
      expect(result.current[0].name).toBe('Banana')
    })

    it('should search across multiple keys', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleList, 'fruit', {
          keys: ['name', 'description', 'tags'],
          debounce: 0,
        })
      )

      // @note should find apple, banana, and grape which have 'fruit' in description or tags
      expect(result.current.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('disabled option', () => {
    it('should return all items when disabled is true', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleList, 'apple', {
          keys: ['name'],
          debounce: 0,
          disabled: true,
        })
      )

      expect(result.current).toHaveLength(4)
      expect(result.current).toEqual(sampleList)
    })

    it('should not filter when disabled even with query', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleList, 'nonexistent', {
          keys: ['name'],
          debounce: 0,
          disabled: true,
        })
      )

      expect(result.current).toHaveLength(4)
    })
  })

  describe('includeScore option', () => {
    it('should return items with scores when includeScore is true', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleList, 'apple', {
          keys: ['name'],
          debounce: 0,
          includeScore: true,
        })
      )

      expect(result.current.length).toBeGreaterThanOrEqual(1)
      expect(result.current[0]).toHaveProperty('score')
      expect(result.current[0]).toHaveProperty('item')
      expect(result.current[0].item.name).toBe('Apple')
    })
  })

  describe('includeMatches option', () => {
    it('should return items with match indices when includeMatches is true', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(sampleList, 'apple', {
          keys: ['name'],
          debounce: 0,
          includeMatches: true,
        })
      )

      expect(result.current.length).toBeGreaterThanOrEqual(1)
      expect(result.current[0]).toHaveProperty('matches')
      expect(result.current[0]).toHaveProperty('item')
    })
  })

  describe('threshold option', () => {
    it('should return fewer results with stricter threshold', () => {
      // @note with threshold 0.1, very strict matching
      const { result: strictResult } = renderHook(() =>
        useFuzzySearch(sampleList, 'appl', {
          keys: ['name'],
          debounce: 0,
          threshold: 0.1,
        })
      )

      // @note with threshold 0.6, fuzzy matches allowed
      const { result: fuzzyResult } = renderHook(() =>
        useFuzzySearch(sampleList, 'appl', {
          keys: ['name'],
          debounce: 0,
          threshold: 0.6,
        })
      )

      // @note stricter threshold should return equal or fewer results
      expect(strictResult.current.length).toBeLessThanOrEqual(
        fuzzyResult.current.length
      )
    })
  })

  describe('empty list handling', () => {
    it('should handle empty list gracefully', () => {
      const { result } = renderHook(() =>
        useFuzzySearch([], 'apple', {
          keys: ['name'],
          debounce: 0,
        })
      )

      expect(result.current).toHaveLength(0)
    })

    it('should handle null/undefined list gracefully', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(null, 'apple', {
          keys: ['name'],
          debounce: 0,
        })
      )

      expect(result.current).toBeNull()
    })
  })

  describe('string array search', () => {
    const stringList = ['apple', 'banana', 'orange', 'grape']

    it('should search through string arrays with empty keys', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(stringList, 'apple', {
          keys: [],
          debounce: 0,
        })
      )

      expect(result.current.length).toBeGreaterThanOrEqual(1)
      expect(result.current[0]).toBe('apple')
    })

    it('should handle fuzzy search on string arrays', () => {
      const { result } = renderHook(() =>
        useFuzzySearch(stringList, 'banan', {
          keys: [],
          debounce: 0,
          threshold: 0.6,
        })
      )

      expect(result.current.length).toBeGreaterThanOrEqual(1)
      expect(result.current[0]).toBe('banana')
    })
  })
})
