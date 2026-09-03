import ConversationInsights from './ConversationInsights'

import { render, screen, waitFor } from '@testing-library/react'

const mockFetch = jest.fn()

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    fetch: mockFetch,
    loading: false,
  })),
}))

jest.mock('@/lib/number', () => ({
  shortFormat: (value) => `short:${value}`,
}))

describe('ConversationInsights', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows empty state when no usage data is returned', async () => {
    mockFetch.mockResolvedValue({ data: undefined, error: null })

    render(<ConversationInsights conversationId="conv-1" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(
      screen.getByText('No insights data available yet. Continue the conversation to see usage.')
    ).toBeTruthy()
  })

  it('shows empty state when fetch returns an error', async () => {
    mockFetch.mockResolvedValue({ data: undefined, error: { message: 'failed' } })

    render(<ConversationInsights conversationId="conv-2" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(
      screen.getByText('No insights data available yet. Continue the conversation to see usage.')
    ).toBeTruthy()
  })

  it('renders metrics when report data exists', async () => {
    mockFetch.mockResolvedValue({
      data: {
        cru3m5n8k001008jq7h9e5b2c: {
          totalConversations: 1,
          totalMessages: 22,
          totalTokens: 3300,
          period: 'last 90 days',
        },
      },
      error: null,
    })

    render(<ConversationInsights conversationId="conv-3" />)

    expect(await screen.findByText('Conversations')).toBeTruthy()
    expect(screen.getByText('Messages')).toBeTruthy()
    expect(screen.getByText('Tokens')).toBeTruthy()
    expect(screen.getByText('short:1')).toBeTruthy()
    expect(screen.getByText('short:22')).toBeTruthy()
    expect(screen.getByText('short:3300')).toBeTruthy()
    expect(screen.getByText('Usage calculated for last 90 days.')).toBeTruthy()
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/platform/report/generate', {
      data: {
        cru3m5n8k001008jq7h9e5b2c: {
          conversationIds: ['conv-3'],
          periodDays: 90,
        },
      },
      trackLoading: true,
    })
  })
})
