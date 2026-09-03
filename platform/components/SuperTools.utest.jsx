/* eslint-disable @typescript-eslint/no-require-imports */
import SuperTools, { useSuperTools } from './SuperTools'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'

const publishMock = jest.fn()
const enabledAppsStorageKey = 'super-tools:enabled-apps'

jest.mock('@/hooks/useBus', () => ({
  usePublish: jest.fn(() => publishMock),
}))

jest.mock('@/hooks/useRouter', () =>
  jest.fn(() => ({
    asPath: '/bots/bot_123?tab=settings',
  }))
)

jest.mock('@/hooks/usePopup', () => {
  const React = require('react')

  return function usePopup(options = {}) {
    const [content, setContent] = React.useState(null)

    return {
      popup: content ? (
        <div role="dialog" aria-label={options.title}>
          {content}
          <button type="button" onClick={() => setContent(null)}>
            {options.cancelButtonCaption || 'Close'}
          </button>
        </div>
      ) : null,
      openPopup: (content) => setContent(content),
    }
  }
})

jest.mock('@/hooks/usePlatformExperience', () => jest.fn(() => true))

jest.mock('@/hooks/useSearchParam', () => jest.fn(() => undefined))

jest.mock(
  '@/components/Pullout',
  () =>
    function MockPullout({ children, ...props }) {
      return (
        <div data-testid="pullout" data-open-channel={props.openChannel}>
          {children}
        </div>
      )
    }
)

jest.mock(
  '@/components/Portal',
  () =>
    function MockPortal({ children }) {
      return <div data-testid="portal">{children}</div>
    }
)

describe('SuperTools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()

    const usePlatformExperience = require('@/hooks/usePlatformExperience')

    usePlatformExperience.mockReturnValue(true)

    const useSearchParam = require('@/hooks/useSearchParam')

    useSearchParam.mockReturnValue(undefined)
  })

  it('exposes open function from useSuperTools', () => {
    const { result } = renderHook(() => useSuperTools())

    expect(result.current.open).toBe(publishMock)
  })

  it('does not render tools outside the platform experience', () => {
    const usePlatformExperience = require('@/hooks/usePlatformExperience')

    usePlatformExperience.mockReturnValue(false)

    render(<SuperTools />)

    expect(
      screen.queryByRole('button', { name: 'Agent Console' })
    ).not.toBeInTheDocument()
    expect(document.getElementById('console-chat')).not.toBeInTheDocument()
  })

  it('renders tools when force is set even outside the platform experience', () => {
    const usePlatformExperience = require('@/hooks/usePlatformExperience')

    usePlatformExperience.mockReturnValue(false)

    render(<SuperTools force />)

    expect(
      screen.getByRole('button', { name: 'Agent Console' })
    ).toBeInTheDocument()
    expect(document.getElementById('console-chat')).toBeInTheDocument()
  })

  it('keeps the _supertools=off opt-out even when force is set', () => {
    const usePlatformExperience = require('@/hooks/usePlatformExperience')
    const useSearchParam = require('@/hooks/useSearchParam')

    usePlatformExperience.mockReturnValue(false)
    useSearchParam.mockReturnValue('off')

    render(<SuperTools force />)

    expect(
      screen.queryByRole('button', { name: 'Agent Console' })
    ).not.toBeInTheDocument()
    expect(document.getElementById('console-chat')).not.toBeInTheDocument()
  })

  it('renders agent console with the default enabled tools visible', () => {
    render(<SuperTools blueprintId="bp-123" />)

    expect(
      screen.getByRole('button', { name: 'Agent Console' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Configure Super Tools' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Agent Trace' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Audit Logs' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Event Logs' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Usage Logs' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Live Conversations' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Inspector' })
    ).toBeInTheDocument()

    const chatFrame = document.getElementById('console-chat')

    expect(chatFrame).toHaveAttribute(
      'src',
      expect.stringContaining('/apps/chat?')
    )
    expect(chatFrame).toHaveAttribute(
      'src',
      expect.stringContaining('blueprintId=bp-123')
    )
    expect(document.getElementById('console-trace')).not.toBeInTheDocument()
    expect(document.getElementById('console-eventlog')).toHaveAttribute(
      'src',
      expect.stringContaining('/apps/eventlog?')
    )
    expect(document.getElementById('console-auditlog')).not.toBeInTheDocument()
    expect(document.getElementById('console-usagelog')).toHaveAttribute(
      'src',
      expect.stringContaining('/apps/usagelog?')
    )
    expect(
      document.getElementById('console-conversations')
    ).not.toBeInTheDocument()
    expect(document.getElementById('console-inspector')).toHaveAttribute(
      'src',
      expect.stringContaining('/apps/41f203dc?')
    )
  })

  it('shows optional tabs when they are enabled from settings', () => {
    render(<SuperTools />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Configure Super Tools' })
    )
    fireEvent.click(screen.getByRole('switch', { name: 'Agent Trace' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Audit Logs' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Live Conversations' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Analytics' }))
    fireEvent.click(screen.getByRole('switch', { name: 'API Docs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(
      screen.getByRole('button', { name: 'Agent Trace' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Event Logs' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Audit Logs' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Usage Logs' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Live Conversations' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Analytics' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'API Docs' })).toBeInTheDocument()

    expect(document.getElementById('console-trace')).toHaveAttribute(
      'src',
      '/apps/trace?_embed=dashboard&debug=true'
    )
    expect(document.getElementById('console-eventlog')).toHaveAttribute(
      'src',
      '/apps/eventlog?_embed=dashboard&debug=true'
    )
    expect(document.getElementById('console-auditlog')).toHaveAttribute(
      'src',
      '/apps/auditlog?_embed=dashboard&debug=true'
    )
    expect(document.getElementById('console-usagelog')).toHaveAttribute(
      'src',
      '/apps/usagelog?_embed=dashboard&debug=true'
    )
    expect(document.getElementById('console-conversations')).toHaveAttribute(
      'src',
      '/apps/5c0a7a11?_embed=dashboard&debug=true'
    )
    expect(document.getElementById('console-analytics')).toHaveAttribute(
      'src',
      '/apps/7cb29ccc?_embed=dashboard'
    )
    expect(document.getElementById('console-apidocs')).toHaveAttribute(
      'src',
      '/apps/b4d0c8f2?_embed=dashboard'
    )
  })

  it('restores optional tabs from local storage', async () => {
    window.localStorage.setItem(
      enabledAppsStorageKey,
      JSON.stringify({
        auditlog: true,
        eventlog: true,
        trace: true,
        usagelog: true,
      })
    )

    render(<SuperTools />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Agent Trace' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Event Logs' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Audit Logs' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Usage Logs' })
      ).toBeInTheDocument()
    })
  })

  it('switches active iframe visibility when selecting another visible tab', () => {
    render(<SuperTools />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Configure Super Tools' })
    )
    fireEvent.click(screen.getByRole('switch', { name: 'Agent Trace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    const chatFrame = document.getElementById('console-chat')
    const traceFrame = document.getElementById('console-trace')

    expect(chatFrame).not.toHaveClass('invisible')
    expect(traceFrame).toHaveClass('invisible')

    fireEvent.click(screen.getByRole('button', { name: 'Agent Trace' }))

    expect(chatFrame).toHaveClass('invisible')
    expect(traceFrame).not.toHaveClass('invisible')
  })

  it('renders tool tab labels with truncation styling and a small side inset', () => {
    render(<SuperTools />)

    const agentConsoleTab = screen.getByRole('button', {
      name: 'Agent Console',
    })
    const agentConsoleLabel = agentConsoleTab.querySelector('span')

    expect(agentConsoleTab).toHaveClass('min-w-0')
    expect(agentConsoleLabel).toHaveClass('block')
    expect(agentConsoleLabel).toHaveClass('max-w-full')
    expect(agentConsoleLabel).toHaveClass('truncate')
    expect(agentConsoleLabel).toHaveClass('px-0.5')
  })

  it('returns to agent console when the active optional tab is hidden', () => {
    render(<SuperTools />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Configure Super Tools' })
    )

    const traceToggle = screen.getByRole('switch', {
      name: 'Agent Trace',
    })

    fireEvent.click(traceToggle)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    fireEvent.click(screen.getByRole('button', { name: 'Agent Trace' }))

    expect(document.getElementById('console-chat')).toHaveClass('invisible')
    expect(document.getElementById('console-trace')).not.toHaveClass(
      'invisible'
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Configure Super Tools' })
    )
    fireEvent.click(screen.getByRole('switch', { name: 'Agent Trace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(
      screen.queryByRole('button', { name: 'Agent Trace' })
    ).not.toBeInTheDocument()
    expect(document.getElementById('console-chat')).not.toHaveClass('invisible')
  })
})
