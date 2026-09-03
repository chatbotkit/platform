import { Message } from './Conversation'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/AutoTextarea', () => {
  return function AutoTextarea(props) {
    return <textarea {...props} />
  }
})

jest.mock('@/components/BackstoryInput', () => {
  return function BackstoryInput(props) {
    return <textarea {...props} />
  }
})

jest.mock('@/components/BotSelect', () => {
  return function BotSelect(props) {
    return <select {...props} />
  }
})

jest.mock('@/components/ChatInput', () => {
  return function ChatInput({ children, ...props }) {
    return (
      <div>
        <textarea {...props} />
        {children}
      </div>
    )
  }
})

jest.mock('@/components/CodeAction', () => {
  return function CodeAction() {
    return null
  }
})

jest.mock('@/components/CopyButton', () => {
  return function CopyButton({ children, ...props }) {
    return (
      <button type="button" {...props}>
        {children}
      </button>
    )
  }
})

jest.mock('@/components/DatasetSelect', () => {
  return function DatasetSelect(props) {
    return <select {...props} />
  }
})

jest.mock('@/components/Emoji', () => {
  return function Emoji({ children, ...props }) {
    return <span {...props}>{children}</span>
  }
})

jest.mock('@/components/Expando', () => {
  return function Expando({ children }) {
    return <div>{children}</div>
  }
})

jest.mock('@/components/LanguageModelSelect', () => {
  return function LanguageModelSelect(props) {
    return <select {...props} />
  }
})

jest.mock('@/components/Link', () => {
  return function Link({ children, href, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

jest.mock('@/components/ObjectView', () => {
  return function ObjectView({ children }) {
    return <div>{children}</div>
  }
})

jest.mock('@/components/Safedown', () => {
  return function Safedown({ children, ...props }) {
    return <div {...props}>{children}</div>
  }
})

jest.mock('@/components/SkillsetSelect', () => {
  return function SkillsetSelect(props) {
    return <select {...props} />
  }
})

jest.mock('@/components/TimeAgo', () => {
  return function TimeAgo() {
    return <span>just now</span>
  }
})

jest.mock('@/hooks/useConversationManager', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/hooks/usePopup', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    popup: null,
    openPopup: jest.fn(),
  })),
}))

jest.mock('@/hooks/useTokenCount', () => ({
  __esModule: true,
  default: jest.fn(() => 0),
}))

describe('Conversation Message', () => {
  it('renders checkpoint messages', () => {
    render(
      <Message
        conversationId="conv-1"
        message={{
          id: 'checkpoint-1',
          type: 'checkpoint',
          text: 'Compacted conversation summary',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          meta: null,
        }}
        isLast={true}
      />
    )

    expect(screen.getByText('Checkpointed')).toBeInTheDocument()
    expect(
      screen.getByText('Compacted conversation summary')
    ).toBeInTheDocument()
  })

  it('renders the latest bot action from message actions', () => {
    render(
      <Message
        conversationId="conv-1"
        message={{
          id: 'bot-1',
          type: 'bot',
          text: 'Final answer',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          actions: [
            {
              id: 'action-1',
              name: 'searchDataset',
              input: '{"query":"pricing"}',
              working: false,
            },
            {
              id: 'action-2',
              name: 'lookupCustomer',
              justification: 'Looking up the customer profile',
              working: true,
            },
          ],
          meta: null,
        }}
        isLast={true}
      />
    )

    expect(
      screen.getByText('Looking up the customer profile')
    ).toBeInTheDocument()
    expect(screen.getByText('Final answer')).toBeInTheDocument()
  })
})
