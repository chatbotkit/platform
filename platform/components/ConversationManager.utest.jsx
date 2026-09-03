import ConversationManager from './ConversationManager'

import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/lib/string', () => ({
  getRandomId: jest.fn(() => 'new-conversation-key'),
}))

jest.mock(
  '@/components/Conversation',
  () =>
    function MockConversation({ onStart }) {
      return (
        <button onClick={() => onStart('conv_123', 'extra')} type="button">
          Start mocked conversation
        </button>
      )
    }
)

jest.mock(
  '@/components/Link',
  () =>
    function MockLink({ href, disabled, children }) {
      return (
        <a href={href} data-disabled={disabled ? 'true' : 'false'}>
          {children}
        </a>
      )
    }
)

describe('ConversationManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows action links after conversation starts and calls onStart', () => {
    const onStart = jest.fn()

    render(
      <ConversationManager
        conversationLink={true}
        situationLink={true}
        onStart={onStart}
      >
        <span>Child action</span>
      </ConversationManager>
    )

    fireEvent.click(screen.getByRole('button', { name: /start mocked/i }))

    expect(onStart).toHaveBeenCalledWith('conv_123', 'extra')
    expect(
      screen.queryByRole('button', { name: /restart conversation/i })
    ).not.toBeNull()
    expect(
      screen
        .getByRole('link', { name: /see full conversation/i })
        .getAttribute('href')
    ).toBe('/conversations/conv_123')
    expect(
      screen
        .getByRole('link', { name: /simulate situation/i })
        .getAttribute('href')
    ).toBe('/playground/situation?conversationId=conv_123')
    expect(screen.queryByText('Child action')).not.toBeNull()
  })

  it('restarts conversation and hides conversation-specific actions', () => {
    render(
      <ConversationManager conversationLink={true} situationLink={true}>
        <span>Child action</span>
      </ConversationManager>
    )

    fireEvent.click(screen.getByRole('button', { name: /start mocked/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /restart conversation/i })
    )

    expect(
      screen.queryByRole('button', { name: /restart conversation/i })
    ).toBeNull()
    expect(
      screen.queryByRole('link', { name: /see full conversation/i })
    ).toBeNull()
    expect(
      screen.queryByRole('link', { name: /simulate situation/i })
    ).toBeNull()
    expect(screen.queryByText('Child action')).not.toBeNull()
  })

  it('disables restart and links when disabled', () => {
    render(
      <ConversationManager
        conversationLink={true}
        situationLink={true}
        disabled={true}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /start mocked/i }))

    expect(
      screen
        .getByRole('button', { name: /restart conversation/i })
        .hasAttribute('disabled')
    ).toBe(true)
    expect(
      screen
        .getByRole('link', { name: /see full conversation/i })
        .getAttribute('data-disabled')
    ).toBe('true')
    expect(
      screen
        .getByRole('link', { name: /simulate situation/i })
        .getAttribute('data-disabled')
    ).toBe('true')
  })
})
