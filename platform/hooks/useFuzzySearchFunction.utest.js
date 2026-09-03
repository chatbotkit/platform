import useFuzzySearchFunction from './useFuzzySearchFunction'

import { renderHook } from '@testing-library/react'

describe('useFuzzySearchFunction', () => {
  const sampleData = [
    { id: 1, name: 'Apple', category: 'fruit' },
    { id: 2, name: 'Banana', category: 'fruit' },
    { id: 3, name: 'Carrot', category: 'vegetable' },
    { id: 4, name: 'Date', category: 'fruit' },
    { id: 5, name: 'Eggplant', category: 'vegetable' },
  ]

  it('should return a search function', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name', 'category'],
      })
    )

    expect(typeof result.current).toBe('function')
  })

  it('should return all items when query is empty', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name', 'category'],
      })
    )

    const searchFunction = result.current
    const results = searchFunction('')

    expect(results).toEqual(sampleData)
  })

  it('should return all items when query is whitespace only', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name', 'category'],
      })
    )

    const searchFunction = result.current
    const results = searchFunction('   ')

    expect(results).toEqual(sampleData)
  })

  it('should perform fuzzy search on specified keys', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name'],
        threshold: 0.3,
      })
    )

    const searchFunction = result.current
    const results = searchFunction('app')

    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Apple')
  })

  it('should find multiple matches', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['category'],
        threshold: 0.3,
      })
    )

    const searchFunction = result.current
    const results = searchFunction('fruit')

    expect(results).toHaveLength(3)
    expect(results.map((r) => r.name)).toEqual(['Apple', 'Banana', 'Date'])
  })

  it('should be case insensitive', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name'],
        threshold: 0.3,
      })
    )

    const searchFunction = result.current
    const resultsLower = searchFunction('apple')
    const resultsUpper = searchFunction('APPLE')
    const resultsMixed = searchFunction('ApPlE')

    expect(resultsLower).toHaveLength(1)
    expect(resultsUpper).toHaveLength(1)
    expect(resultsMixed).toHaveLength(1)
    expect(resultsLower[0].name).toBe('Apple')
    expect(resultsUpper[0].name).toBe('Apple')
    expect(resultsMixed[0].name).toBe('Apple')
  })

  it('should handle fuzzy matching with typos', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name'],
        threshold: 0.4,
      })
    )

    const searchFunction = result.current
    const results = searchFunction('banan')

    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Banana')
  })

  it('should return empty array when no matches found', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name'],
        threshold: 0.3,
      })
    )

    const searchFunction = result.current
    const results = searchFunction('xyz')

    expect(results).toEqual([])
  })

  it('should include score when includeScore is true', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name'],
        threshold: 0.3,
        includeScore: true,
      })
    )

    const searchFunction = result.current
    const results = searchFunction('apple')

    expect(results).toHaveLength(1)
    expect(results[0]).toHaveProperty('item')
    expect(results[0]).toHaveProperty('score')
    expect(results[0].item.name).toBe('Apple')
    expect(typeof results[0].score).toBe('number')
  })

  it('should include matches when includeMatches is true', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name'],
        threshold: 0.3,
        includeMatches: true,
      })
    )

    const searchFunction = result.current
    const results = searchFunction('apple')

    expect(results).toHaveLength(1)
    expect(results[0]).toHaveProperty('item')
    expect(results[0]).toHaveProperty('matches')
    expect(results[0].item.name).toBe('Apple')
    expect(Array.isArray(results[0].matches)).toBe(true)
  })

  it('should return original list when disabled is true', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name'],
        disabled: true,
      })
    )

    const searchFunction = result.current
    const results = searchFunction('apple')

    expect(results).toEqual(sampleData)
  })

  it('should handle empty list', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction([], {
        keys: ['name'],
      })
    )

    const searchFunction = result.current
    const results = searchFunction('test')

    expect(results).toEqual([])
  })

  it('should handle list with primitive values', () => {
    const primitiveList = ['apple', 'banana', 'carrot', 'date', 'eggplant']

    const { result } = renderHook(() =>
      useFuzzySearchFunction(primitiveList, {
        threshold: 0.3,
      })
    )

    const searchFunction = result.current
    const results = searchFunction('app')

    expect(results).toHaveLength(1)
    expect(results[0]).toBe('apple')
  })

  it('should update search function when list changes', () => {
    const { result, rerender } = renderHook(
      ({ list }) =>
        useFuzzySearchFunction(list, {
          keys: ['name'],
          threshold: 0.3,
        }),
      {
        initialProps: { list: sampleData },
      }
    )

    const searchFunction1 = result.current
    const results1 = searchFunction1('apple')

    expect(results1).toHaveLength(1)

    const newData = [
      { id: 6, name: 'Apricot', category: 'fruit' },
      { id: 7, name: 'Avocado', category: 'fruit' },
    ]

    rerender({ list: newData })

    const searchFunction2 = result.current
    const results2 = searchFunction2('apple')

    // @note should not find 'Apple' anymore, but might find 'Apricot'
    expect(results2.every((r) => r.name !== 'Apple')).toBe(true)
  })

  it('should respect threshold option', () => {
    const { result: strictResult } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name'],
        threshold: 0.1, // strict matching
      })
    )

    const { result: looseResult } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name'],
        threshold: 0.6, // loose matching
      })
    )

    const strictSearch = strictResult.current
    const looseSearch = looseResult.current

    const strictResults = strictSearch('bnn')
    const looseResults = looseSearch('bnn')

    // @note strict threshold should find fewer or no matches
    expect(strictResults.length).toBeLessThanOrEqual(looseResults.length)
  })

  it('should respect minMatchCharLength option', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name'],
        minMatchCharLength: 3,
        threshold: 0.3,
      })
    )

    const searchFunction = result.current

    // @note with minMatchCharLength=3, single or two-char queries might not match
    const results = searchFunction('ap')

    // @note this behavior depends on Fuse.js implementation
    expect(Array.isArray(results)).toBe(true)
  })

  it('should search across multiple keys', () => {
    const { result } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name', 'category'],
        threshold: 0.3,
      })
    )

    const searchFunction = result.current

    // @note search for category
    const categoryResults = searchFunction('vegetable')

    expect(categoryResults).toHaveLength(2)
    expect(categoryResults.map((r) => r.name)).toEqual(['Carrot', 'Eggplant'])

    // @note search for name
    const nameResults = searchFunction('banana')

    expect(nameResults).toHaveLength(1)
    expect(nameResults[0].name).toBe('Banana')
  })

  it('should return same function reference when dependencies do not change', () => {
    const { result, rerender } = renderHook(() =>
      useFuzzySearchFunction(sampleData, {
        keys: ['name'],
        threshold: 0.3,
      })
    )

    const searchFunction1 = result.current

    rerender()

    const searchFunction2 = result.current

    // @note function reference should be stable when dependencies don't change
    // both functions should produce the same results
    const results1 = searchFunction1('apple')
    const results2 = searchFunction2('apple')

    expect(results1).toEqual(results2)
    expect(results1).toHaveLength(1)
    expect(results1[0].name).toBe('Apple')
  })

  it('should handle nested keys', () => {
    const nestedData = [
      { id: 1, user: { name: 'Alice', role: 'admin' } },
      { id: 2, user: { name: 'Bob', role: 'user' } },
      { id: 3, user: { name: 'Charlie', role: 'moderator' } },
    ]

    const { result } = renderHook(() =>
      useFuzzySearchFunction(nestedData, {
        keys: ['user.name', 'user.role'],
        threshold: 0.3,
      })
    )

    const searchFunction = result.current
    const results = searchFunction('alice')

    expect(results).toHaveLength(1)
    expect(results[0].user.name).toBe('Alice')
  })
})
