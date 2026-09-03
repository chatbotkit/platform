import PolicyBlockStatus from './PolicyBlockStatus'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const fetchMock = jest.fn()
const formatDurationMock = jest.fn((value) => `duration-${value}`)
const pluralizeMock = jest.fn((word, count, includeCount) =>
  includeCount ? `${count} ${word}${count === 1 ? '' : 's'}` : word
)

let loadingMock = false

jest.mock('@chatbotkit-dev/time', () => ({
  formatDuration: (...args) => formatDurationMock(...args),
}))

jest.mock(
  'pluralize',
  () =>
    (...args) =>
      pluralizeMock(...args)
)

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: () => ({ fetch: fetchMock, loading: loadingMock }),
}))

describe('PolicyBlockStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadingMock = false
  })

  it('shows no-block state when no blocked bot ids exist', async () => {
    fetchMock.mockResolvedValue({ data: { blockedBotIds: [] } })

    render(<PolicyBlockStatus policyId="policy-1" />)

    await waitFor(() => {
      expect(
        screen.getByText('No bots are currently blocked by this policy.')
      ).toBeInTheDocument()
    })
  })

  it('shows bot-scope blocked state with ttl and reason', async () => {
    fetchMock.mockResolvedValue({
      data: {
        scope: 'bot',
        blockedBotIds: ['bot-1'],
        block: { ttl: 45, reason: 'Policy cooldown active' },
      },
    })

    render(<PolicyBlockStatus policyId="policy-2" />)

    await waitFor(() => {
      expect(
        screen.getByText(/The targeted bot is blocked by this policy/)
      ).toBeInTheDocument()
      expect(screen.getByText(/duration-45000 remaining\./)).toBeInTheDocument()
    })

    expect(screen.getByText('Policy cooldown active')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Clear Block' })
    ).toBeInTheDocument()
    expect(formatDurationMock).toHaveBeenCalledWith(45000)
  })

  it('shows global-scope blocked count label and clear-all action', async () => {
    fetchMock.mockResolvedValue({
      data: { scope: 'global', blockedBotIds: ['bot-1', 'bot-2'] },
    })

    render(<PolicyBlockStatus policyId="policy-3" />)

    await waitFor(() => {
      expect(
        screen.getByText('2 bots currently blocked by this policy.')
      ).toBeInTheDocument()
    })

    expect(
      screen.getByRole('button', { name: 'Clear All Blocks' })
    ).toBeInTheDocument()
    expect(pluralizeMock).toHaveBeenCalledWith('bot', 2, true)
  })

  it('clears block and reloads status when clear succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce({
        data: {
          scope: 'bot',
          blockedBotIds: ['bot-1'],
          block: { reason: 'Blocked now' },
        },
      })
      .mockResolvedValueOnce({ error: undefined })
      .mockResolvedValueOnce({ data: { blockedBotIds: [] } })

    render(<PolicyBlockStatus policyId="policy-4" />)

    await screen.findByText('Blocked now')

    fireEvent.click(screen.getByRole('button', { name: 'Clear Block' }))

    await waitFor(() => {
      expect(
        screen.getByText('No bots are currently blocked by this policy.')
      ).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/policy/policy-4/block/clear',
      {
        data: {},
        successMessage: 'Block cleared.',
        failureMessage: true,
      }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/policy/policy-4/block/list'
    )
  })
})
