import { LogRow, Main } from './components'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('@/lib/event', () => [
  {
    type: 'conversation.create',
    name: 'Conversation Created',
    description: 'A new conversation was created',
  },
  { type: 'bot.update', name: 'Bot Updated', description: 'A bot was updated' },
  {
    type: 'conversation.error',
    name: 'Conversation Error',
    description: 'An error occurred',
  },
])

jest.mock('@/lib/object', () => ({
  revalue: jest.fn((obj) => obj),
}))

jest.mock('@/lib/toast', () => jest.fn())

jest.mock('@/components/GlobalRoot', () => ({
  GlobalRootPortal: ({ children }) => <>{children}</>,
}))

jest.mock('@/components/ObjectView', () => {
  return function ObjectView() {
    return <div data-testid="object-view" />
  }
})

jest.mock('@/components/TimeAgo', () => {
  return function TimeAgo({ time }) {
    return <span data-testid="time-ago">{String(time)}</span>
  }
})

jest.mock('@/hooks/usePopup', () => () => ({
  popup: null,
  openPopup: jest.fn(),
}))

jest.mock('./server', () => ({
  listLogs: jest.fn(),
  subscribeLogs: jest.fn(),
}))

let lastVListProps = null

jest.mock('virtua', () => ({
  VList: (props) => {
    lastVListProps = props

    return <div data-testid="vlist">{props.children}</div>
  },
}))

const mockItem = {
  id: 'log-1',
  type: 'conversation.create',
  createdAt: 1708300000000,
  updatedAt: 1708300000000,
}

describe('LogRow', () => {
  it('should render the formatted time string', () => {
    const { container } = render(<LogRow item={mockItem} />)

    const timeText = new Date(mockItem.createdAt).toLocaleTimeString()

    expect(container.textContent).toContain(timeText)
  })

  it('should render event name and status', () => {
    const { container } = render(<LogRow item={mockItem} />)

    expect(container.textContent).toContain('Conversation Created')
    expect(container.textContent).toContain('success')
  })

  it('should render error status for error events', () => {
    const errorItem = { ...mockItem, type: 'conversation.error' }

    const { container } = render(<LogRow item={errorItem} />)

    expect(container.textContent).toContain('error')
  })

  it('should render related resources', () => {
    const itemWithResources = {
      ...mockItem,
      botId: 'bot-123',
      conversationId: 'conv-456',
    }

    const { container } = render(<LogRow item={itemWithResources} />)

    expect(container.textContent).toContain('bot')
    expect(container.textContent).toContain('conversation')
  })

  it('should call onClick when clicked', () => {
    const onClick = jest.fn()

    const { container } = render(<LogRow item={mockItem} onClick={onClick} />)

    container.firstChild.click()

    expect(onClick).toHaveBeenCalledWith(mockItem)
  })
})

describe('Main', () => {
  beforeEach(() => {
    lastVListProps = null
  })

  it('should pass ssrCount to VList matching initial items count to prevent hydration mismatch', () => {
    const items = [
      {
        id: 'log-1',
        type: 'conversation.create',
        createdAt: 1708300000000,
        updatedAt: 1708300000000,
      },
      {
        id: 'log-2',
        type: 'bot.update',
        createdAt: 1708300000000,
        updatedAt: 1708300000000,
      },
      {
        id: 'log-3',
        type: 'conversation.error',
        createdAt: 1708300000000,
        updatedAt: 1708300000000,
      },
    ]

    render(<Main initialItems={items} />)

    // @note ssrCount must be set so virtua renders items server-side, preventing
    // the "Text content does not match server-rendered HTML" hydration error (Sentry #1 & #2)
    expect(lastVListProps?.ssrCount).toBe(items.length)
  })
})
