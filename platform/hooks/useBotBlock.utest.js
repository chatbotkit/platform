import useBotBlock from './useBotBlock'

import { act, renderHook, waitFor } from '@testing-library/react'

const fetchMock = jest.fn()

let loadingMock = false

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: () => ({ fetch: fetchMock, loading: loadingMock }),
}))

describe('useBotBlock', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadingMock = false
  })

  it('reports not-blocked without fetching when botId is falsy', async () => {
    const { result } = renderHook(() => useBotBlock(null))

    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.block).toBe(null)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads the current block for a bot', async () => {
    fetchMock.mockResolvedValue({
      data: { block: { ttl: 60, reason: 'Policy limit exceeded' } },
    })

    const { result } = renderHook(() => useBotBlock('bot-1'))

    await waitFor(() => expect(result.current.block).not.toBe(null))

    expect(result.current.block).toEqual({
      ttl: 60,
      reason: 'Policy limit exceeded',
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/bot/bot-1/access/fetch')
  })

  it('unblocks and clears the block', async () => {
    let currentBlock = { ttl: 30, reason: 'Temporary block' }

    fetchMock.mockImplementation((url) => {
      if (url.endsWith('/access/unblock')) {
        currentBlock = null

        return Promise.resolve({ error: undefined })
      }

      return Promise.resolve({ data: { block: currentBlock } })
    })

    const { result } = renderHook(() => useBotBlock('bot-2'))

    await waitFor(() => expect(result.current.block).not.toBe(null))

    await act(async () => {
      await result.current.unblock()
    })

    await waitFor(() => expect(result.current.block).toBe(null))

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/bot/bot-2/access/unblock', {
      data: {},
      successMessage: 'Bot unblocked.',
      failureMessage: true,
    })
  })

  it('keeps the block when the unblock request fails', async () => {
    fetchMock.mockImplementation((url) => {
      if (url.endsWith('/access/unblock')) {
        return Promise.resolve({ error: 'request failed' })
      }

      return Promise.resolve({ data: { block: { reason: 'Still blocked' } } })
    })

    const { result } = renderHook(() => useBotBlock('bot-3'))

    await waitFor(() => expect(result.current.block).not.toBe(null))

    await act(async () => {
      await result.current.unblock()
    })

    expect(result.current.block).toEqual({ reason: 'Still blocked' })
  })

  it('syncs consumers of the same botId when one unblocks', async () => {
    let currentBlock = { ttl: 45, reason: 'Shared block' }

    fetchMock.mockImplementation((url) => {
      if (url.endsWith('/access/unblock')) {
        currentBlock = null

        return Promise.resolve({ error: undefined })
      }

      return Promise.resolve({ data: { block: currentBlock } })
    })

    const a = renderHook(() => useBotBlock('bot-4'))
    const b = renderHook(() => useBotBlock('bot-4'))

    await waitFor(() => expect(a.result.current.block).not.toBe(null))
    await waitFor(() => expect(b.result.current.block).not.toBe(null))

    // both consumers share a single fetch rather than each firing their own
    const fetchCalls = fetchMock.mock.calls.filter(([url]) =>
      url.endsWith('/access/fetch')
    )

    expect(fetchCalls).toHaveLength(1)

    await act(async () => {
      await a.result.current.unblock()
    })

    // the acting consumer clears immediately; the other re-loads via the
    // module-level pub/sub and clears too
    await waitFor(() => expect(a.result.current.block).toBe(null))
    await waitFor(() => expect(b.result.current.block).toBe(null))
  })
})
