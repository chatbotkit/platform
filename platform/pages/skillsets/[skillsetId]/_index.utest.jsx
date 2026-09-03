import { Bots } from './index'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

const mockFetch = jest.fn()
const mockConfirm = jest.fn()
const mockOpenPopup = jest.fn()
const mockClosePopup = jest.fn()
const mockSetDisabled = jest.fn()

jest.mock('@/prisma/client', () => ({}))
jest.mock('@/prisma/enums', () => ({
  ResourceState: {
    enabled: 'Enabled',
    disabled: 'Disabled',
  },
  SkillsetVisibility: {
    private: 'Private',
    protected: 'Protected',
    public: 'Public',
  },
}))

jest.mock('@/lib/form', () => ({ formToData: jest.fn(() => ({})) }))
jest.mock('@/lib/session.get', () => ({ getSoftSession: jest.fn() }))
jest.mock('@/lib/solution', () => ({
  withSkillsetResources: jest.fn(() => ({})),
}))
jest.mock('@/lib/struct', () => ({ makeJsonSafe: jest.fn((value) => value) }))

jest.mock(
  '@/layouts/Dashboard',
  () =>
    function Dashboard({ children }) {
      return <div>{children}</div>
    }
)

jest.mock('@/components/BotList', () => {
  return function BotList({ items, trailingActions }) {
    return (
      <div data-testid="bot-list" data-items={JSON.stringify(items)}>
        {trailingActions}
      </div>
    )
  }
})

jest.mock('@/components/BotSelect', () => {
  return function BotSelect(props) {
    return <input data-testid="bot-select" {...props} readOnly />
  }
})

jest.mock(
  '@/components/CodeAction',
  () =>
    function CodeAction() {
      return null
    }
)
jest.mock('@/components/Confirm', () => ({
  useConfirm: () => mockConfirm,
  useConfirmDelete: () => jest.fn(),
}))
jest.mock(
  '@/components/ConversationManager',
  () =>
    function ConversationManager() {
      return null
    }
)
jest.mock(
  '@/components/EventLog',
  () =>
    function EventLog() {
      return null
    }
)
jest.mock(
  '@/components/FAQ',
  () =>
    function FAQ() {
      return null
    }
)
jest.mock(
  '@/components/HubOptions',
  () =>
    function HubOptions() {
      return null
    }
)
jest.mock(
  '@/components/IntegrationList',
  () =>
    function IntegrationList() {
      return null
    }
)
jest.mock(
  '@/components/SkillsetAbilityList',
  () =>
    function SkillsetAbilityList() {
      return null
    }
)
jest.mock(
  '@/components/ThisSolution',
  () =>
    function ThisSolution() {
      return null
    }
)
jest.mock('@/components/WebhookSetupSection', () => ({
  Multi: function WebhookSetupSectionMulti() {
    return null
  },
}))

jest.mock('@/hooks/useExternalAPIURL', () => jest.fn(() => (path) => path))
jest.mock('@/hooks/useFetch', () =>
  jest.fn(() => ({
    code: null,
    fetch: mockFetch,
  }))
)
jest.mock('@/hooks/usePopup', () =>
  jest.fn(() => ({
    popup: null,
    openPopup: mockOpenPopup,
    closePopup: mockClosePopup,
    setDisabled: mockSetDisabled,
  }))
)
jest.mock('@/hooks/useRouter', () => jest.fn(() => ({ push: jest.fn() })))

async function link(data) {
  const [, options] = mockOpenPopup.mock.calls[0]

  await act(async () => {
    await options.actions.Link.fn(data)
  })
}

function getItems() {
  return JSON.parse(screen.getByTestId('bot-list').getAttribute('data-items'))
}

describe('Skillset Bots', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockFetch.mockResolvedValue({ error: null, data: { id: 'bot_123' } })
  })

  it('offers to link a bot when the skillset has none', () => {
    render(<Bots skillset={{ id: 'skillset_123', bots: [] }} />)

    expect(getItems()).toEqual([])

    expect(screen.getByRole('button', { name: 'Link bot' })).toBeInTheDocument()
  })

  it('opens the bot select popup when linking', () => {
    render(<Bots skillset={{ id: 'skillset_123', bots: [] }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Link bot' }))

    expect(mockOpenPopup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: 'Link Bot' })
    )
  })

  it('links the selected bot to the skillset', async () => {
    mockFetch
      .mockResolvedValueOnce({ error: null, data: {} })
      .mockResolvedValueOnce({
        error: null,
        data: { id: 'bot_123', name: 'Support Bot' },
      })

    render(<Bots skillset={{ id: 'skillset_123', bots: [] }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Link bot' }))

    await link({ botId: 'bot_123' })

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/bot/bot_123/update', {
      data: {
        skillsetId: 'skillset_123',
      },

      successMessage: 'Bot linked to skillset.',
    })

    expect(mockClosePopup).toHaveBeenCalled()

    expect(getItems()).toEqual([{ id: 'bot_123', name: 'Support Bot' }])
  })

  it('does not link when no bot is selected', async () => {
    render(<Bots skillset={{ id: 'skillset_123', bots: [] }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Link bot' }))

    await link({})

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('keeps the skillset unlinked when the update fails', async () => {
    mockFetch.mockResolvedValueOnce({ error: new Error('failed'), data: null })

    render(<Bots skillset={{ id: 'skillset_123', bots: [] }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Link bot' }))

    await link({ botId: 'bot_123' })

    expect(mockFetch).toHaveBeenCalledTimes(1)

    expect(mockClosePopup).not.toHaveBeenCalled()

    expect(getItems()).toEqual([])
  })

  it('offers to unlink the bot which already uses the skillset', () => {
    render(
      <Bots
        skillset={{
          id: 'skillset_123',
          bots: [{ id: 'bot_123', name: 'Support Bot' }],
        }}
      />
    )

    expect(getItems()).toEqual([{ id: 'bot_123', name: 'Support Bot' }])

    expect(
      screen.queryByRole('button', { name: 'Link bot' })
    ).not.toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Unlink bot' })
    ).toBeInTheDocument()
  })

  it('unlinks the bot from the skillset', async () => {
    mockConfirm.mockResolvedValue(true)

    render(
      <Bots
        skillset={{
          id: 'skillset_123',
          bots: [{ id: 'bot_123', name: 'Support Bot' }],
        }}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlink bot' }))
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/bot/bot_123/update', {
      data: {
        skillsetId: null,
      },

      successMessage: 'Bot unlinked from skillset.',
    })

    expect(getItems()).toEqual([])

    expect(screen.getByRole('button', { name: 'Link bot' })).toBeInTheDocument()
  })

  it('keeps the bot linked when the unlink is not confirmed', async () => {
    mockConfirm.mockResolvedValue(false)

    render(
      <Bots
        skillset={{
          id: 'skillset_123',
          bots: [{ id: 'bot_123', name: 'Support Bot' }],
        }}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlink bot' }))
    })

    expect(mockFetch).not.toHaveBeenCalled()

    expect(getItems()).toEqual([{ id: 'bot_123', name: 'Support Bot' }])
  })

  it('keeps the bot linked when the unlink fails', async () => {
    mockConfirm.mockResolvedValue(true)

    mockFetch.mockResolvedValueOnce({ error: new Error('failed'), data: null })

    render(
      <Bots
        skillset={{
          id: 'skillset_123',
          bots: [{ id: 'bot_123', name: 'Support Bot' }],
        }}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlink bot' }))
    })

    expect(getItems()).toEqual([{ id: 'bot_123', name: 'Support Bot' }])
  })
})
