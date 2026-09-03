import useFetch from '@/hooks/useFetch'

import useExtractIntegrationSeries from './useExtractIntegrationSeries'

import { act, renderHook, waitFor } from '@testing-library/react'

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: jest.fn(),
}))

describe('useExtractIntegrationSeries', () => {
  const mockFetch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    useFetch.mockReturnValue({
      fetch: mockFetch,
    })
  })

  it('returns empty state and does not fetch without integration id', async () => {
    const schema = {
      revenue: { collect: true, display: 'currency' },
    }

    const { result } = renderHook(() =>
      useExtractIntegrationSeries(null, schema)
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual([])
    expect(result.current.formats).toEqual({ revenue: 'currency' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns empty state and does not fetch when schema has no collectable fields', async () => {
    const schema = {
      revenue: { collect: false, display: 'currency' },
      title: { display: 'text' },
    }

    const { result } = renderHook(() =>
      useExtractIntegrationSeries('int_1', schema)
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual([])
    expect(result.current.formats).toEqual({})
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches, combines, and sorts series data across collected fields', async () => {
    const schema = {
      revenue: { collect: true, display: 'currency' },
      sessions: { collect: true, display: 'number' },
      ignored: { collect: false, display: 'text' },
    }

    mockFetch
      .mockResolvedValueOnce({
        data: {
          values: [
            { date: 2, total: 20 },
            { date: 1, total: 10 },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          values: [{ date: 2, total: 3 }],
        },
      })

    const { result } = renderHook(() =>
      useExtractIntegrationSeries('int_123', schema)
    )

    await waitFor(() => {
      expect(result.current.data).toEqual([
        { date: 1, revenue: 10 },
        { date: 2, revenue: 20, sessions: 3 },
      ])
    })

    expect(result.current.formats).toEqual({
      revenue: 'currency',
      sessions: 'number',
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)

    const firstUrl = mockFetch.mock.calls[0][0]
    const secondUrl = mockFetch.mock.calls[1][0]

    expect(firstUrl.toString()).toContain(
      'type=integration.extract%5Bint_123%5D.revenue'
    )
    expect(secondUrl.toString()).toContain(
      'type=integration.extract%5Bint_123%5D.sessions'
    )
  })

  it('treats failed field fetches as empty series', async () => {
    const schema = {
      revenue: { collect: true },
      sessions: { collect: true },
    }

    mockFetch
      .mockResolvedValueOnce({
        error: 'failed',
      })
      .mockResolvedValueOnce({
        data: {
          values: [{ date: 3, total: 9 }],
        },
      })

    const { result } = renderHook(() =>
      useExtractIntegrationSeries('int_999', schema)
    )

    await waitFor(() => {
      expect(result.current.data).toEqual([{ date: 3, sessions: 9 }])
    })
  })

  it('supports manual reload calls', async () => {
    const schema = {
      revenue: { collect: true },
    }

    mockFetch.mockResolvedValue({
      data: {
        values: [{ date: 1, total: 1 }],
      },
    })

    const { result } = renderHook(() =>
      useExtractIntegrationSeries('int_manual', schema)
    )

    await waitFor(() => {
      expect(result.current.data).toEqual([{ date: 1, revenue: 1 }])
    })

    await act(async () => {
      await result.current.reload()
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
