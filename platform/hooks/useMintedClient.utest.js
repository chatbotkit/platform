/* eslint-disable @typescript-eslint/no-require-imports */
import { useMintedClient } from './useMintedClient'

import { act, renderHook, waitFor } from '@testing-library/react'

jest.mock('@chatbotkit/sdk', () => ({
  ChatBotKit: jest.fn(),
}))

const { ChatBotKit } = require('@chatbotkit/sdk')

describe('useMintedClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns null client and does not mint when key is missing', () => {
    const mint = jest.fn()

    const { result } = renderHook(() => useMintedClient(mint, null))

    expect(result.current.client).toBeNull()
    expect(result.current.error).toBeNull()
    expect(mint).not.toHaveBeenCalled()
  })

  it('creates a ChatBotKit client from a minted token', async () => {
    const mint = jest.fn().mockResolvedValue({ token: 'token-123' })
    const mockClient = { id: 'client-1' }

    ChatBotKit.mockImplementation(() => mockClient)

    const { result } = renderHook(() => useMintedClient(mint, 'resource-1'))

    await waitFor(() => {
      expect(result.current.client).toBe(mockClient)
    })

    expect(ChatBotKit).toHaveBeenCalledWith({
      secret: 'token-123',
      host: window.location.host,
      protocol: window.location.protocol,
    })
    expect(result.current.error).toBeNull()
  })

  it('stores a mint error and retries on refresh interval', async () => {
    const mint = jest
      .fn()
      .mockResolvedValueOnce({ error: { message: 'mint failed' } })
      .mockResolvedValueOnce({ token: 'token-retry' })
    const mockClient = { id: 'client-retry' }

    ChatBotKit.mockImplementation(() => mockClient)

    const { result } = renderHook(() => useMintedClient(mint, 'resource-1'))

    await waitFor(() => {
      expect(result.current.error).toEqual(new Error('mint failed'))
    })

    await act(async () => {
      jest.advanceTimersByTime(10 * 60 * 1000)
    })

    await waitFor(() => {
      expect(result.current.client).toBe(mockClient)
    })

    expect(mint).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBeNull()
  })

  it('uses the latest mint function without needing a key change', async () => {
    const mintA = jest.fn().mockResolvedValue({ token: 'token-a' })
    const mintB = jest.fn().mockResolvedValue({ token: 'token-b' })

    ChatBotKit.mockImplementation((config) => ({ secret: config.secret }))

    const { rerender, result } = renderHook(
      ({ mint }) => useMintedClient(mint, 'resource-1'),
      {
        initialProps: { mint: mintA },
      }
    )

    await waitFor(() => {
      expect(result.current.client).toEqual({ secret: 'token-a' })
    })

    rerender({ mint: mintB })

    await act(async () => {
      jest.advanceTimersByTime(10 * 60 * 1000)
    })

    await waitFor(() => {
      expect(result.current.client).toEqual({ secret: 'token-b' })
    })

    expect(mintA).toHaveBeenCalledTimes(1)
    expect(mintB).toHaveBeenCalledTimes(1)
  })
})
