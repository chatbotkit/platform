import React from 'react'

import useFetch from '@/hooks/useFetch'

import useSecretTemplates from './useSecretTemplates'

import { renderHook, waitFor } from '@testing-library/react'

jest.mock('@/lib/env', () => ({
  isDevelopment: false,
}))

jest.mock('@/hooks/useCache', () => {
  return jest.fn((key, fetchFn, options, deps) => {
    const [data, setData] = React.useState(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
      let isMounted = true

      const load = async () => {
        try {
          const result = await fetchFn()

          if (isMounted) {
            setData(result)
            setLoading(false)
          }
        } catch (error) {
          if (isMounted) {
            setLoading(false)
          }
        }
      }

      load()

      return () => {
        isMounted = false
      }
    }, deps)

    return { data, loading }
  })
})

jest.mock('@/hooks/useFetch', () => {
  return jest.fn(() => ({
    fetch: jest.fn(),
  }))
})

describe('useSecretTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return empty array initially', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      data: { items: [] },
    })

    useFetch.mockReturnValue({ fetch: mockFetch })

    const { result } = renderHook(() => useSecretTemplates())

    expect(result.current.secretTemplates).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it('should load secret templates and set loading to false', async () => {
    const mockTemplates = [
      { id: '1', name: 'Secret 1', type: 'bearer' },
      { id: '2', name: 'Secret 2', type: 'oauth' },
    ]
    const mockFetch = jest.fn().mockResolvedValue({
      data: { items: mockTemplates },
    })

    useFetch.mockReturnValue({ fetch: mockFetch })

    const { result } = renderHook(() => useSecretTemplates())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.secretTemplates).toEqual(mockTemplates)
  })

  it('should handle fetch error gracefully', async () => {
    const mockError = new Error('Fetch failed')
    const mockFetch = jest.fn().mockResolvedValue({
      error: mockError,
      data: null,
    })

    useFetch.mockReturnValue({ fetch: mockFetch })

    const { result } = renderHook(() => useSecretTemplates())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.secretTemplates).toEqual([])
  })

  it('should return empty array when data.items is undefined', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      data: { items: undefined },
    })

    useFetch.mockReturnValue({ fetch: mockFetch })

    const { result } = renderHook(() => useSecretTemplates())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.secretTemplates).toEqual([])
  })

  it('should call fetch with correct endpoint', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      data: { items: [] },
    })

    useFetch.mockReturnValue({ fetch: mockFetch })

    renderHook(() => useSecretTemplates())

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/platform/secret/list')
    })
  })

  it('should handle empty data object', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      data: {},
    })

    useFetch.mockReturnValue({ fetch: mockFetch })

    const { result } = renderHook(() => useSecretTemplates())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.secretTemplates).toEqual([])
  })
})
