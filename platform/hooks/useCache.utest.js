import { getLocalStorage } from '@/lib/browserstorage'
import { captureException } from '@/lib/error'

import useCache from './useCache'
import useDeps from './useDeps'

import { act, renderHook, waitFor } from '@testing-library/react'

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('./useDeps', () => ({
  __esModule: true,
  default: jest.fn((deps) => JSON.stringify(deps)),
}))

// @note mock getLocalStorage to return a controllable storage object
jest.mock('@/lib/browserstorage', () => ({
  getLocalStorage: jest.fn(),
}))

describe('useCache', () => {
  const mockQueryFn = jest.fn()
  const localStorageMock = {}

  // @note create a mock storage that behaves like the real one
  const createMockStorage = () => ({
    getItem: jest.fn((key) => localStorageMock[key] || null),
    setItem: jest.fn((key, value) => {
      localStorageMock[key] = value
    }),
    removeItem: jest.fn((key) => {
      delete localStorageMock[key]
    }),
    clear: jest.fn(() => {
      Object.keys(localStorageMock).forEach(
        (key) => delete localStorageMock[key]
      )
    }),
    key: jest.fn((index) => Object.keys(localStorageMock)[index] || null),
    get length() {
      return Object.keys(localStorageMock).length
    },
  })

  let mockStorage

  beforeEach(() => {
    jest.clearAllMocks()

    // Clear localStorage mock
    Object.keys(localStorageMock).forEach((key) => delete localStorageMock[key])

    // Create fresh mock storage for each test
    mockStorage = createMockStorage()
    getLocalStorage.mockReturnValue(mockStorage)

    // Reset useDeps mock
    useDeps.mockImplementation((deps) => JSON.stringify(deps))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      mockQueryFn.mockResolvedValue({ test: 'data' })

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, undefined, [])
      )

      expect(result.current.data).toBe(null)
      expect(result.current.loading).toBe(true)
      expect(result.current.error).toBe(null)
      expect(typeof result.current.refresh).toBe('function')
      expect(typeof result.current.clearCache).toBe('function')
    })

    it('should execute query function on mount', async () => {
      const testData = { test: 'data' }

      mockQueryFn.mockResolvedValue(testData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, undefined, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(mockQueryFn).toHaveBeenCalledTimes(1)
      expect(result.current.data).toEqual(testData)
      expect(result.current.error).toBe(null)
    })

    it('should execute query but bypass cache when disabled is true', async () => {
      // @note disabled: true means cache is bypassed, not that query is skipped
      const testData = { test: 'data' }

      mockQueryFn.mockResolvedValue(testData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { disabled: true }, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(mockQueryFn).toHaveBeenCalledTimes(1)
      expect(result.current.data).toEqual(testData)
      expect(result.current.error).toBe(null)
    })
  })

  describe('caching behavior', () => {
    it('should cache data in localStorage', async () => {
      const testData = { test: 'data', nested: { value: 42 } }

      mockQueryFn.mockResolvedValue(testData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { ttl: 60000 }, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'cache:test-key',
        JSON.stringify(testData)
      )
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'cache:test-key:timestamp',
        expect.any(String)
      )
    })

    it('should use cached data on subsequent mounts if still valid', async () => {
      const testData = { test: 'cached' }
      const now = Date.now()

      localStorageMock['cache:test-key'] = JSON.stringify(testData)
      localStorageMock['cache:test-key:timestamp'] = now.toString()

      mockQueryFn.mockResolvedValue({ test: 'fresh' })

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { ttl: 60000 }, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      // Should use cached data, not call queryFn
      expect(mockQueryFn).not.toHaveBeenCalled()
      expect(result.current.data).toEqual(testData)
    })

    it('should fetch fresh data when cache is expired', async () => {
      const cachedData = { test: 'cached' }
      const freshData = { test: 'fresh' }
      const expiredTime = Date.now() - 120000 // 2 minutes ago

      localStorageMock['cache:test-key'] = JSON.stringify(cachedData)
      localStorageMock['cache:test-key:timestamp'] = expiredTime.toString()

      mockQueryFn.mockResolvedValue(freshData)

      const { result } = renderHook(
        () => useCache('test-key', mockQueryFn, { ttl: 60000 }, []) // 1 minute TTL
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(mockQueryFn).toHaveBeenCalledTimes(1)
      expect(result.current.data).toEqual(freshData)
    })

    it('should fetch fresh data when no cache exists', async () => {
      const freshData = { test: 'fresh' }

      mockQueryFn.mockResolvedValue(freshData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { ttl: 60000 }, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(mockQueryFn).toHaveBeenCalledTimes(1)
      expect(result.current.data).toEqual(freshData)
    })

    it('should use custom TTL when provided', async () => {
      const testData = { test: 'data' }
      const customTTL = 5 * 60 * 1000 // 5 minutes
      const now = Date.now()

      localStorageMock['cache:test-key'] = JSON.stringify(testData)
      localStorageMock['cache:test-key:timestamp'] = (
        now -
        4 * 60 * 1000
      ).toString() // 4 minutes ago

      mockQueryFn.mockResolvedValue({ test: 'fresh' })

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { ttl: customTTL }, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      // Should use cached data as it's within 5 minute TTL
      expect(mockQueryFn).not.toHaveBeenCalled()
      expect(result.current.data).toEqual(testData)
    })
  })

  describe('error handling', () => {
    it('should set error state when query fails', async () => {
      const error = new Error('Query failed')

      mockQueryFn.mockRejectedValue(error)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, undefined, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.error).toEqual(error)
      expect(result.current.data).toBe(null)
      expect(captureException).toHaveBeenCalledWith(error)
    })

    it('should keep cached data when query fails', async () => {
      const cachedData = { test: 'cached' }
      const expiredTime = Date.now() - 120000

      localStorageMock['cache:test-key'] = JSON.stringify(cachedData)
      localStorageMock['cache:test-key:timestamp'] = expiredTime.toString()

      const error = new Error('Query failed')

      mockQueryFn.mockRejectedValue(error)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { ttl: 60000 }, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.error).toEqual(error)
      expect(result.current.data).toEqual(cachedData)
    })

    it('should handle localStorage errors gracefully', async () => {
      const testData = { test: 'data' }

      mockQueryFn.mockResolvedValue(testData)

      // @note mock storage.setItem to throw - but note that with the safe
      // storage wrapper, errors are caught internally, so captureException
      // won't be called since the error is handled silently
      mockStorage.setItem = jest.fn(() => {
        throw new Error('QuotaExceededError')
      })

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, undefined, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      // @note data should still be returned even when caching fails
      expect(result.current.data).toEqual(testData)
    })

    it('should handle JSON parse errors gracefully', async () => {
      localStorageMock['cache:test-key'] = 'invalid json'
      localStorageMock['cache:test-key:timestamp'] = Date.now().toString()

      const freshData = { test: 'fresh' }

      mockQueryFn.mockResolvedValue(freshData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, undefined, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      // Should fetch fresh data when cached data is corrupted
      expect(mockQueryFn).toHaveBeenCalledTimes(1)
      expect(result.current.data).toEqual(freshData)
    })
  })

  describe('refresh function', () => {
    it('should force fetch fresh data bypassing cache', async () => {
      const cachedData = { test: 'cached' }
      const freshData = { test: 'fresh' }
      const now = Date.now()

      localStorageMock['cache:test-key'] = JSON.stringify(cachedData)
      localStorageMock['cache:test-key:timestamp'] = now.toString()

      mockQueryFn.mockResolvedValue(freshData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { ttl: 60000 }, [])
      )

      // Wait for initial load (should use cache)
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.data).toEqual(cachedData)

      // Call refresh
      await act(async () => {
        await result.current.refresh()
      })

      expect(mockQueryFn).toHaveBeenCalledTimes(1)
      expect(result.current.data).toEqual(freshData)
    })

    it('should update loading state during refresh', async () => {
      const testData = { test: 'data' }

      mockQueryFn.mockResolvedValue(testData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, undefined, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => {
        void result.current.refresh()
      })

      // Check loading state during refresh
      await waitFor(() => expect(result.current.loading).toBe(true))

      await waitFor(() => expect(result.current.loading).toBe(false))
    })
  })

  describe('clearCache function', () => {
    it('should remove cached data from localStorage', async () => {
      const testData = { test: 'data' }

      mockQueryFn.mockResolvedValue(testData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, undefined, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => {
        result.current.clearCache()
      })

      expect(mockStorage.removeItem).toHaveBeenCalledWith('cache:test-key')
      expect(mockStorage.removeItem).toHaveBeenCalledWith(
        'cache:test-key:timestamp'
      )
    })

    it('should handle localStorage errors during clear', () => {
      // @note with safe storage wrapper, errors are caught internally
      mockStorage.removeItem = jest.fn(() => {
        throw new Error('Storage error')
      })

      mockQueryFn.mockResolvedValue({ test: 'data' })

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, undefined, [])
      )

      // @note should not throw even when storage throws
      act(() => {
        expect(() => result.current.clearCache()).not.toThrow()
      })
    })
  })

  describe('dependency tracking', () => {
    it('should not re-fetch when deps are unchanged', async () => {
      const testData = { test: 'data' }

      mockQueryFn.mockResolvedValue(testData)

      const { result, rerender } = renderHook(
        ({ deps }) => useCache('test-key', mockQueryFn, undefined, deps),
        { initialProps: { deps: ['dep1'] } }
      )

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(mockQueryFn).toHaveBeenCalledTimes(1)

      // Rerender with same deps
      rerender({ deps: ['dep1'] })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      expect(mockQueryFn).toHaveBeenCalledTimes(1)
    })

    it('should re-fetch when disabled changes from true to false and use cache', async () => {
      // @note when disabled changes, the query re-executes due to deps change
      // when disabled: true, cache is bypassed; when disabled: false, cache is used
      const testData = { test: 'data' }

      mockQueryFn.mockResolvedValue(testData)

      const { result, rerender } = renderHook(
        ({ disabled }) => useCache('test-key', mockQueryFn, { disabled }, []),
        { initialProps: { disabled: true } }
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      // query should have been called (disabled bypasses cache, not query)
      expect(mockQueryFn).toHaveBeenCalledTimes(1)
      expect(result.current.data).toEqual(testData)

      // Enable caching by setting disabled to false
      rerender({ disabled: false })

      await waitFor(() => expect(result.current.loading).toBe(false))

      // query should be called again due to disabled change
      expect(mockQueryFn).toHaveBeenCalledTimes(2)
      expect(result.current.data).toEqual(testData)
    })
  })

  describe('multiple cache keys', () => {
    it('should maintain separate cache for different keys', async () => {
      const data1 = { test: 'data1' }
      const data2 = { test: 'data2' }

      const queryFn1 = jest.fn().mockResolvedValue(data1)
      const queryFn2 = jest.fn().mockResolvedValue(data2)

      const { result: result1 } = renderHook(() =>
        useCache('key1', queryFn1, undefined, [])
      )
      const { result: result2 } = renderHook(() =>
        useCache('key2', queryFn2, undefined, [])
      )

      await waitFor(() => expect(result1.current.loading).toBe(false))
      await waitFor(() => expect(result2.current.loading).toBe(false))

      expect(result1.current.data).toEqual(data1)
      expect(result2.current.data).toEqual(data2)
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'cache:key1',
        JSON.stringify(data1)
      )
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'cache:key2',
        JSON.stringify(data2)
      )
    })
  })

  describe('type safety', () => {
    it('should correctly type the data', async () => {
      const testData = { id: 1, name: 'Test' }
      const typedQueryFn = jest.fn().mockResolvedValue(testData)

      const { result } = renderHook(() =>
        useCache('test-key', typedQueryFn, undefined, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      // Data should be accessible
      expect(result.current.data?.id).toBe(1)
      expect(result.current.data?.name).toBe('Test')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string as cache key', async () => {
      const testData = { test: 'data' }

      mockQueryFn.mockResolvedValue(testData)

      const { result } = renderHook(() =>
        useCache('', mockQueryFn, undefined, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toEqual(testData)
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'cache:',
        expect.any(String)
      )
    })

    it('should handle null as query result', async () => {
      mockQueryFn.mockResolvedValue(null)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, undefined, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toBe(null)
      expect(result.current.error).toBe(null)
    })

    it('should handle undefined in query result', async () => {
      mockQueryFn.mockResolvedValue(undefined)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, undefined, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toBe(undefined)
    })

    it('should handle very large data objects', async () => {
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          data: Array(100).fill('x').join(''),
        })),
      }

      mockQueryFn.mockResolvedValue(largeData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, undefined, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toEqual(largeData)
    })

    it('should handle concurrent refresh calls', async () => {
      const testData = { test: 'data' }

      mockQueryFn.mockResolvedValue(testData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, undefined, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      // Call refresh multiple times concurrently
      await act(async () => {
        await Promise.all([
          result.current.refresh(),
          result.current.refresh(),
          result.current.refresh(),
        ])
      })

      // queryFn should be called for each refresh
      // Initial load + 3 refreshes = 4 calls
      expect(mockQueryFn).toHaveBeenCalledTimes(4)
    })
  })

  describe('stale-while-revalidate behavior', () => {
    it('should return stale data immediately and fetch in background', async () => {
      const staleData = { test: 'stale' }
      const freshData = { test: 'fresh' }
      const expiredTime = Date.now() - 120000 // 2 minutes ago

      localStorageMock['cache:test-key'] = JSON.stringify(staleData)
      localStorageMock['cache:test-key:timestamp'] = expiredTime.toString()

      mockQueryFn.mockResolvedValue(freshData)

      const { result } = renderHook(() =>
        useCache(
          'test-key',
          mockQueryFn,
          { ttl: 60000, staleWhileRevalidate: true },
          []
        )
      )

      // should immediately have stale data without loading
      expect(result.current.data).toEqual(staleData)
      expect(result.current.loading).toBe(false)

      // wait for background fetch to complete
      await waitFor(() => expect(mockQueryFn).toHaveBeenCalledTimes(1))

      // should now have fresh data
      await waitFor(() => expect(result.current.data).toEqual(freshData))
      expect(result.current.loading).toBe(false)
    })

    it('should show loading when no cached data exists with staleWhileRevalidate', async () => {
      const freshData = { test: 'fresh' }

      mockQueryFn.mockResolvedValue(freshData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { staleWhileRevalidate: true }, [])
      )

      // no cached data, so should show loading
      expect(result.current.data).toBe(null)
      expect(result.current.loading).toBe(true)

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toEqual(freshData)
      expect(mockQueryFn).toHaveBeenCalledTimes(1)
    })

    it('should not show loading with valid cache and staleWhileRevalidate', async () => {
      const cachedData = { test: 'cached' }
      const now = Date.now()

      localStorageMock['cache:test-key'] = JSON.stringify(cachedData)
      localStorageMock['cache:test-key:timestamp'] = now.toString()

      mockQueryFn.mockResolvedValue({ test: 'fresh' })

      const { result } = renderHook(() =>
        useCache(
          'test-key',
          mockQueryFn,
          { ttl: 60000, staleWhileRevalidate: true },
          []
        )
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      // should use cached data without calling queryFn since cache is still valid
      expect(mockQueryFn).not.toHaveBeenCalled()
      expect(result.current.data).toEqual(cachedData)
      expect(result.current.loading).toBe(false)
    })

    it('should show loading on force refresh even with staleWhileRevalidate', async () => {
      const staleData = { test: 'stale' }
      const freshData = { test: 'fresh' }
      const now = Date.now()

      localStorageMock['cache:test-key'] = JSON.stringify(staleData)
      localStorageMock['cache:test-key:timestamp'] = now.toString()

      mockQueryFn.mockResolvedValue(freshData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { staleWhileRevalidate: true }, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      // force refresh should show loading even with staleWhileRevalidate
      act(() => {
        result.current.refresh()
      })

      expect(result.current.loading).toBe(true)

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toEqual(freshData)
    })

    it('should keep stale data on error with staleWhileRevalidate', async () => {
      const staleData = { test: 'stale' }
      const expiredTime = Date.now() - 120000

      localStorageMock['cache:test-key'] = JSON.stringify(staleData)
      localStorageMock['cache:test-key:timestamp'] = expiredTime.toString()

      const error = new Error('Network error')

      mockQueryFn.mockRejectedValue(error)

      const { result } = renderHook(() =>
        useCache(
          'test-key',
          mockQueryFn,
          { ttl: 60000, staleWhileRevalidate: true },
          []
        )
      )

      // should immediately show stale data
      expect(result.current.data).toEqual(staleData)

      // wait for background fetch to fail
      await waitFor(() => expect(mockQueryFn).toHaveBeenCalledTimes(1))

      // should still show stale data and set error
      await waitFor(() => expect(result.current.error).toEqual(error))
      expect(result.current.data).toEqual(staleData)
      expect(result.current.loading).toBe(false)
    })
  })

  describe('disabled option behavior (cache bypass)', () => {
    it('should execute query but bypass cache when disabled is true', async () => {
      // @note this test isolates the bug where disabled: true prevents query execution entirely
      const testData = { test: 'fresh-data' }

      mockQueryFn.mockResolvedValue(testData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { disabled: true }, [])
      )

      // should show loading state while fetching
      expect(result.current.loading).toBe(true)

      await waitFor(() => expect(result.current.loading).toBe(false))

      // query should have been called
      expect(mockQueryFn).toHaveBeenCalledTimes(1)

      // data should be returned
      expect(result.current.data).toEqual(testData)
      expect(result.current.error).toBe(null)
    })

    it('should not read from cache when disabled is true', async () => {
      // @note pre-populate cache with stale data
      const cachedData = { test: 'cached' }
      const freshData = { test: 'fresh' }
      const now = Date.now()

      localStorageMock['cache:test-key'] = JSON.stringify(cachedData)
      localStorageMock['cache:test-key:timestamp'] = now.toString()

      mockQueryFn.mockResolvedValue(freshData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { disabled: true }, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      // should fetch fresh data, ignoring cache
      expect(mockQueryFn).toHaveBeenCalledTimes(1)
      expect(result.current.data).toEqual(freshData)
    })

    it('should not write to cache when disabled is true', async () => {
      const testData = { test: 'data' }

      mockQueryFn.mockResolvedValue(testData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { disabled: true }, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      // data should be returned
      expect(result.current.data).toEqual(testData)

      // but cache should not be written
      expect(mockStorage.setItem).not.toHaveBeenCalledWith(
        'cache:test-key',
        expect.any(String)
      )
      expect(mockStorage.setItem).not.toHaveBeenCalledWith(
        'cache:test-key:timestamp',
        expect.any(String)
      )
    })

    it('should always fetch fresh data on each render when disabled is true', async () => {
      const data1 = { test: 'data1' }
      const data2 = { test: 'data2' }

      mockQueryFn.mockResolvedValueOnce(data1).mockResolvedValueOnce(data2)

      const { result, rerender } = renderHook(
        ({ dep }) =>
          useCache('test-key', mockQueryFn, { disabled: true }, [dep]),
        { initialProps: { dep: 1 } }
      )

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.data).toEqual(data1)
      expect(mockQueryFn).toHaveBeenCalledTimes(1)

      // change dependency to trigger re-fetch
      rerender({ dep: 2 })

      await waitFor(() => expect(mockQueryFn).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(result.current.data).toEqual(data2))
    })
  })

  describe('localStorage access blocked (cross-origin iframe / private mode)', () => {
    it('should not throw SecurityError when localStorage access throws', async () => {
      // @note simulate cross-origin iframe or private browsing mode where
      // localStorage access throws SecurityError
      const securityError = new DOMException(
        "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
        'SecurityError'
      )

      // @note mock the storage to throw on all operations
      mockStorage.getItem = jest.fn(() => {
        throw securityError
      })
      mockStorage.setItem = jest.fn(() => {
        throw securityError
      })
      mockStorage.removeItem = jest.fn(() => {
        throw securityError
      })

      const testData = { test: 'data' }

      mockQueryFn.mockResolvedValue(testData)

      // @note should not throw - must handle localStorage access gracefully
      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { ttl: 60000 }, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toEqual(testData)
      expect(result.current.error).toBe(null)
    })

    it('should work correctly when localStorage is completely inaccessible', async () => {
      // @note simulate environment where localStorage throws on any access
      const securityError = new DOMException(
        "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
        'SecurityError'
      )

      // @note mock the storage to throw on all operations
      mockStorage.getItem = jest.fn(() => {
        throw securityError
      })
      mockStorage.setItem = jest.fn(() => {
        throw securityError
      })
      mockStorage.removeItem = jest.fn(() => {
        throw securityError
      })

      const data1 = { test: 'data1' }
      const data2 = { test: 'data2' }

      mockQueryFn.mockResolvedValueOnce(data1).mockResolvedValueOnce(data2)

      const { result, rerender } = renderHook(
        ({ dep }) => useCache('test-key', mockQueryFn, { ttl: 60000 }, [dep]),
        { initialProps: { dep: 1 } }
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.data).toEqual(data1)

      // @note trigger re-fetch - should still work without localStorage
      rerender({ dep: 2 })

      await waitFor(() => expect(mockQueryFn).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(result.current.data).toEqual(data2))
    })

    it('should clear cache gracefully when localStorage throws', async () => {
      const securityError = new DOMException(
        "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
        'SecurityError'
      )

      // @note mock the storage to throw on all operations
      mockStorage.getItem = jest.fn(() => {
        throw securityError
      })
      mockStorage.setItem = jest.fn(() => {
        throw securityError
      })
      mockStorage.removeItem = jest.fn(() => {
        throw securityError
      })

      const testData = { test: 'data' }

      mockQueryFn.mockResolvedValue(testData)

      const { result } = renderHook(() =>
        useCache('test-key', mockQueryFn, { ttl: 60000 }, [])
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      // @note clearCache should not throw even when localStorage is blocked
      expect(() => result.current.clearCache()).not.toThrow()
    })
  })
})
