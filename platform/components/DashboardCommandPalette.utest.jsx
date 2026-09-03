import DashboardCommandPalette from './DashboardCommandPalette'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const pushMock = jest.fn()
const sendMock = jest.fn()

let widgetState

jest.mock('@/components/DynamicIcon', () => {
  return function MockDynamicIcon({ icon, className }) {
    return (
      <span className={className} data-testid="dynamic-icon">
        {icon}
      </span>
    )
  }
})

jest.mock('@/hooks/useRouter', () => {
  return jest.fn(() => ({ push: pushMock }))
})

jest.mock('@/hooks/useDashboardWidgetSend', () => {
  return jest.fn(() => widgetState)
})

describe('DashboardCommandPalette', () => {
  const items = [
    {
      id: 'bots',
      label: 'Bots',
      description: 'Manage bots',
      href: '/bots',
      icon: '@heroicons/chat-bubble-left-right',
      group: 'Resources',
      keywords: ['assistant'],
    },
    {
      id: 'blueprints',
      label: 'Blueprints',
      description: 'Design agent systems',
      href: '/blueprints',
      icon: '@heroicons/map',
      group: 'Projects',
      keywords: ['designer'],
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()

    widgetState = {
      instance: {
        open: false,
        sendMessage: jest.fn(),
      },
      send: sendMock,
    }
  })

  it('opens with Ctrl+P and navigates to the first matching page on Enter', async () => {
    const user = userEvent.setup()

    render(<DashboardCommandPalette items={items} />)

    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })

    const input = screen.getByRole('textbox')

    await user.type(input, 'bots{enter}')

    expect(pushMock).toHaveBeenCalledWith('/bots')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('sends the query to the assistant when no page matches', async () => {
    const user = userEvent.setup()

    render(<DashboardCommandPalette items={items} />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    const input = screen.getByRole('textbox')

    await user.type(input, 'help me fix this flow{enter}')

    expect(sendMock).toHaveBeenCalledWith('help me fix this flow', {
      respond: true,
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('queues assistant messages until the widget instance is available', async () => {
    const user = userEvent.setup()

    widgetState = {
      instance: null,
      send: sendMock,
    }

    const { rerender } = render(<DashboardCommandPalette items={items} />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    const input = screen.getByRole('textbox')

    await user.type(input, 'review my datasets{enter}')

    expect(sendMock).not.toHaveBeenCalled()

    widgetState = {
      instance: {
        open: false,
        sendMessage: jest.fn(),
      },
      send: sendMock,
    }

    rerender(<DashboardCommandPalette items={items} />)

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith('review my datasets', {
        respond: true,
      })
    })
  })

  it('does not open with Ctrl+F', () => {
    render(<DashboardCommandPalette items={items} />)

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true })

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
