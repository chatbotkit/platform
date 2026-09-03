import BotBlockStatus from './BotBlockStatus'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const fetchMock = jest.fn()
const formatDurationMock = jest.fn((value) => `duration-${value}`)

let loadingMock = false

jest.mock('@chatbotkit-dev/time', () => ({
  formatDuration: (...args) => formatDurationMock(...args),
}))

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: () => ({ fetch: fetchMock, loading: loadingMock }),
}))

describe('BotBlockStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadingMock = false
  })

  it('shows active state when block is not present', async () => {
    fetchMock.mockResolvedValue({ data: { block: null } })

    render(<BotBlockStatus botId="bot-1" />)

    expect(screen.getByText('Checking block status…')).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByText('This bot is active and not blocked.')
      ).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/bot/bot-1/access/fetch')
  })

  it('shows blocked state with ttl and reason', async () => {
    fetchMock.mockResolvedValue({
      data: { block: { ttl: 60, reason: 'Policy limit exceeded' } },
    })

    render(<BotBlockStatus botId="bot-2" />)

    await waitFor(() => {
      expect(screen.getByText(/This bot is blocked/)).toBeInTheDocument()
      expect(screen.getByText(/duration-60000 remaining\./)).toBeInTheDocument()
    })

    expect(screen.getByText('Policy limit exceeded')).toBeInTheDocument()
    expect(formatDurationMock).toHaveBeenCalledWith(60000)
    expect(
      screen.getByRole('button', { name: 'Unblock Bot' })
    ).toBeInTheDocument()
  })

  it('unblocks successfully and returns to active state', async () => {
    fetchMock
      .mockResolvedValueOnce({
        data: { block: { ttl: 30, reason: 'Temporary block' } },
      })
      .mockResolvedValueOnce({ error: undefined })

    render(<BotBlockStatus botId="bot-3" />)

    await screen.findByText('Temporary block')

    fireEvent.click(screen.getByRole('button', { name: 'Unblock Bot' }))

    await waitFor(() => {
      expect(
        screen.getByText('This bot is active and not blocked.')
      ).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/bot/bot-3/access/unblock',
      {
        data: {},
        successMessage: 'Bot unblocked.',
        failureMessage: true,
      }
    )
  })

  it('does not clear block when unblock request fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ data: { block: { reason: 'Still blocked' } } })
      .mockResolvedValueOnce({ error: 'request failed' })

    render(<BotBlockStatus botId="bot-4" />)

    await screen.findByText('Still blocked')

    fireEvent.click(screen.getByRole('button', { name: 'Unblock Bot' }))

    await waitFor(() => {
      expect(screen.getByText('Still blocked')).toBeInTheDocument()
    })
    expect(
      screen.queryByText('This bot is active and not blocked.')
    ).not.toBeInTheDocument()
  })
})
