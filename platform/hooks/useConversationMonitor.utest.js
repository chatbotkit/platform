/* eslint-disable @typescript-eslint/no-require-imports */
import useConversationMonitor from './useConversationMonitor'

import { act, renderHook, waitFor } from '@testing-library/react'

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  jsonl: jest.fn(),
}))

const getMockFetch = () => require('@/lib/fetch').default
const getMockJsonl = () => require('@/lib/fetch').jsonl

async function* makeJsonlStream(items) {
  for (const item of items) {
    yield item
  }
}

describe('useConversationMonitor', () => {
  let mockFetch
  let mockJsonl

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
    mockFetch = getMockFetch()
    mockJsonl = getMockJsonl()
  })

  it('does not connect when conversationId is missing', async () => {
    const { result } = renderHook(() => useConversationMonitor(undefined))

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.connected).toBe(false)
    expect(result.current.connecting).toBe(false)
  })

  it('sends subscription request with history length and bearer token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: {},
    })
    mockJsonl.mockImplementation(() => makeJsonlStream([]))

    const getToken = jest.fn().mockResolvedValue('token-123')

    renderHook(() =>
      useConversationMonitor('conv_1', { historyLength: 25, getToken })
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    expect(getToken).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/conversation/conv_1/channel/subscribe',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/jsonl',
          'X-Requested-With': 'XMLHttpRequest',
          Authorization: 'Bearer token-123',
        }),
        body: JSON.stringify({ historyLength: 25 }),
      })
    )
  })

  it('accumulates only message events, enforces max, and supports clear()', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: {},
    })
    mockJsonl.mockImplementation(() =>
      makeJsonlStream([
        { type: 'ignored', data: { createdAt: 0, type: 'noop', data: {} } },
        { type: 'message', data: { createdAt: 1, type: 'event-1', data: {} } },
        { type: 'message', data: { createdAt: 2, type: 'event-2', data: {} } },
        { type: 'message', data: { createdAt: 3, type: 'event-3', data: {} } },
      ])
    )

    const { result } = renderHook(() =>
      useConversationMonitor('conv_1', { max: 2 })
    )

    await waitFor(() => {
      expect(result.current.events).toHaveLength(2)
    })

    expect(result.current.events.map((event) => event.type)).toEqual([
      'event-2',
      'event-3',
    ])

    act(() => {
      result.current.clear()
    })

    expect(result.current.events).toEqual([])
  })

  it('surfaces API errors using parsed response message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ message: 'forbidden for plan' })),
    })

    const { result } = renderHook(() => useConversationMonitor('conv_1'))

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error?.message).toBe('forbidden for plan')
  })

  it('surfaces missing response body as an error', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: null,
    })

    const { result } = renderHook(() => useConversationMonitor('conv_1'))

    await waitFor(() => {
      expect(result.current.error?.message).toBe('Response body is empty')
    })
  })

  it('reconnects after stream closes', async () => {
    jest.useFakeTimers()

    mockFetch.mockResolvedValue({
      ok: true,
      body: {},
    })
    mockJsonl.mockImplementation(() => makeJsonlStream([]))

    renderHook(() =>
      useConversationMonitor('conv_1', {
        reconnectDelay: 100,
      })
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      jest.advanceTimersByTime(100)
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
