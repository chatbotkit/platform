import ResourceFilterButton, {
  ResourceFilterPopup,
} from './ResourceFilterButton'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

const openPopup = jest.fn()
const closePopup = jest.fn()

const mockRouter = {
  pathname: '/events',
  query: {},
}

jest.mock('@/hooks/useRouter', () => {
  return function useRouter() {
    return mockRouter
  }
})

jest.mock('@/hooks/usePopup', () => {
  return function usePopup() {
    return {
      popup: <div data-testid="popup" />,
      openPopup,
      closePopup,
    }
  }
})

jest.mock('@/components/Ping', () => {
  return function Ping() {
    return <span data-testid="ping" />
  }
})

jest.mock('@/components/List', () => {
  function List({ children }) {
    return <div>{children}</div>
  }

  List.Item = function ListItem({ title, body, onClick, children }) {
    return (
      <button type="button" onClick={onClick}>
        <span>{title}</span>
        {body}
        {children}
      </button>
    )
  }

  return List
})

describe('ResourceFilterPopup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRouter.pathname = '/events'
    mockRouter.query = {}
  })

  it('renders clear item and selected option marker', () => {
    render(
      <ResourceFilterPopup
        closePopup={closePopup}
        filterOptions={[
          {
            id: 'abuse',
            link: '/events?abuse=true',
            title: 'Abuse',
            description: 'Abuse events',
            isSelected: true,
            tag: 'moderation',
          },
        ]}
      />
    )

    expect(screen.getByText('Clear Filter')).toBeInTheDocument()
    expect(screen.getByText('Abuse')).toBeInTheDocument()
    expect(screen.getByText('selected')).toBeInTheDocument()
    expect(screen.getByText('moderation')).toBeInTheDocument()
  })

  it('calls closePopup when clear or option item is clicked', () => {
    render(
      <ResourceFilterPopup
        closePopup={closePopup}
        filterOptions={[
          {
            id: 'abuse',
            link: '/events?abuse=true',
            title: 'Abuse',
            description: 'Abuse events',
            isSelected: false,
            tag: 'moderation',
          },
        ]}
      />
    )

    fireEvent.click(screen.getByText('Clear Filter'))
    fireEvent.click(screen.getByText('Abuse'))

    expect(closePopup).toHaveBeenCalledTimes(2)
  })
})

describe('ResourceFilterButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRouter.pathname = '/events'
    mockRouter.query = {}
  })

  it('opens filter popup when clicked', () => {
    render(<ResourceFilterButton filterOptions={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /filter/i }))

    expect(openPopup).toHaveBeenCalledTimes(1)
  })

  it('shows selected query filters and selected filter option labels', () => {
    mockRouter.query = {
      abuse: 'true',
      type: 'error',
      botId: 'bot_1',
      contactId: 'contact_1',
      taskId: 'task_1',
      conversationId: 'conv_1',
      messageId: 'msg_1',
      widgetIntegrationId: 'wid_1',
      slackIntegrationId: 'sl_1',
      discordIntegrationId: 'dc_1',
      microsoftteamsIntegrationId: 'tm_1',
      googlechatIntegrationId: 'gc_1',
      messengerIntegrationId: 'ms_1',
      whatsappIntegrationId: 'wa_1',
      telegramIntegrationId: 'tg_1',
      twilioIntegrationId: 'tw_1',
      emailIntegrationId: 'em_1',
      anamIntegrationId: 'an_1',
      recallIntegrationId: 'rc_1',
      triggerIntegrationId: 'tr_1',
      instagramIntegrationId: 'ig_1',
    }

    render(
      <ResourceFilterButton
        filterOptions={[
          {
            id: 'flagged',
            isSelected: true,
            displayName: 'Flagged',
          },
        ]}
      />
    )

    const button = screen.getByRole('button')

    expect(button).toHaveTextContent('Filter')
    expect(button).toHaveTextContent('(abuse)')
    expect(button).toHaveTextContent('(error)')
    expect(button).toHaveTextContent('(bot)')
    expect(button).toHaveTextContent('(contact)')
    expect(button).toHaveTextContent('(task)')
    expect(button).toHaveTextContent('(conversation)')
    expect(button).toHaveTextContent('(message)')
    expect(button).toHaveTextContent('(widget)')
    expect(button).toHaveTextContent('(slack)')
    expect(button).toHaveTextContent('(discord)')
    expect(button).toHaveTextContent('(teams)')
    expect(button).toHaveTextContent('(googlechat)')
    expect(button).toHaveTextContent('(messenger)')
    expect(button).toHaveTextContent('(whatsapp)')
    expect(button).toHaveTextContent('(telegram)')
    expect(button).toHaveTextContent('(twilio)')
    expect(button).toHaveTextContent('(email)')
    expect(button).toHaveTextContent('(trigger)')
    expect(button).toHaveTextContent('(instagram)')
    expect(button).toHaveTextContent('(Flagged)')
  })

  it('disables button and prevents popup open when disabled', () => {
    render(<ResourceFilterButton filterOptions={[]} disabled />)

    const button = screen.getByRole('button', { name: /filter/i })

    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled')

    fireEvent.click(button)

    expect(openPopup).not.toHaveBeenCalled()
  })
})
