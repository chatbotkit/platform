/* eslint-disable @typescript-eslint/no-require-imports */
import SwitchBar from './SwitchBar'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

jest.mock('@/components/SessionContext', () => ({
  TeamSwitchButton: function TeamSwitchButton({ children, className }) {
    return (
      <button type="button" className={className}>
        {children}
      </button>
    )
  },
  UserSwitchButton: function UserSwitchButton({ children, className }) {
    return (
      <button type="button" className={className}>
        {children}
      </button>
    )
  },
  useSessionContext: jest.fn(),
}))

const { useSessionContext } = require('@/components/SessionContext')

describe('SwitchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders collapsed when not switched', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: false,
      teamId: null,
      teamName: null,
      teams: [],
      isUserSwitched: false,
      userId: null,
      userName: null,
      users: [],
    })

    const { container } = render(<SwitchBar />)
    const collapsible = container.firstChild

    expect(collapsible).toHaveStyle({ height: '0px' })
  })

  it('renders expanded when team is switched', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: true,
      teamId: 'team-123',
      teamName: 'Test Team',
      teams: [{ id: 'team-123', name: 'Test Team' }],
      isUserSwitched: false,
      userId: null,
      userName: null,
      users: [],
    })

    const { container } = render(<SwitchBar />)
    const collapsible = container.firstChild

    // @note in test environment, scrollHeight is 0 so we check for transition classes
    expect(collapsible).toHaveClass('overflow-hidden')
    expect(collapsible).toHaveClass('transition-all')
    expect(screen.getByText('Test Team')).toBeInTheDocument()
  })

  it('renders expanded when user is switched', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: false,
      teamId: null,
      teamName: null,
      teams: [],
      isUserSwitched: true,
      userId: 'user-456',
      userName: 'Test User',
      users: [{ id: 'user-456', name: 'Test User' }],
    })

    const { container } = render(<SwitchBar />)
    const collapsible = container.firstChild

    // @note in test environment, scrollHeight is 0 so we check for transition classes
    expect(collapsible).toHaveClass('overflow-hidden')
    expect(collapsible).toHaveClass('transition-all')
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('displays team name when team is switched', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: true,
      teamId: 'team-123',
      teamName: 'Test Team',
      teams: [],
      isUserSwitched: false,
      userId: null,
      userName: null,
      users: [],
    })

    render(<SwitchBar />)
    expect(screen.getByText('Test Team')).toBeInTheDocument()
  })

  it('displays team ID when team name is not available', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: true,
      teamId: 'team-123',
      teamName: null,
      teams: [],
      isUserSwitched: false,
      userId: null,
      userName: null,
      users: [],
    })

    render(<SwitchBar />)
    expect(screen.getByText('team-123')).toBeInTheDocument()
  })

  it('displays user name when user is switched', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: false,
      teamId: null,
      teamName: null,
      teams: [],
      isUserSwitched: true,
      userId: 'user-456',
      userName: 'Test User',
      users: [],
    })

    render(<SwitchBar />)
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('displays user ID when user name is not available', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: false,
      teamId: null,
      teamName: null,
      teams: [],
      isUserSwitched: true,
      userId: 'user-456',
      userName: null,
      users: [],
    })

    render(<SwitchBar />)
    expect(screen.getByText('user-456')).toBeInTheDocument()
  })

  it('displays both team and user with bullet separator', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: true,
      teamId: 'team-123',
      teamName: 'Test Team',
      teams: [],
      isUserSwitched: true,
      userId: 'user-456',
      userName: 'Test User',
      users: [],
    })

    const { container } = render(<SwitchBar />)

    expect(screen.getByText('Test Team')).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()

    // Check for bullet separator
    const bullet = container.querySelector('div:has(+ div)').nextSibling

    expect(bullet?.textContent).toContain('•')
  })

  it('shows TeamSwitchButton when switched and teams available', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: true,
      teamId: 'team-123',
      teamName: 'Test Team',
      teams: [{ id: 'team-123' }, { id: 'team-456' }],
      isUserSwitched: false,
      userId: null,
      userName: null,
      users: [],
    })

    render(<SwitchBar />)
    expect(screen.getByText('Switch Team')).toBeInTheDocument()
  })

  it('shows UserSwitchButton when switched and users available', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: false,
      teamId: null,
      teamName: null,
      teams: [],
      isUserSwitched: true,
      userId: 'user-456',
      userName: 'Test User',
      users: [{ id: 'user-456' }, { id: 'user-789' }],
    })

    render(<SwitchBar />)
    expect(screen.getByText('Switch User')).toBeInTheDocument()
  })

  it('does not show TeamSwitchButton when no teams available', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: true,
      teamId: 'team-123',
      teamName: 'Test Team',
      teams: [],
      isUserSwitched: false,
      userId: null,
      userName: null,
      users: [],
    })

    render(<SwitchBar />)
    expect(screen.queryByText('Switch Team')).not.toBeInTheDocument()
  })

  it('does not show UserSwitchButton when no users available', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: false,
      teamId: null,
      teamName: null,
      teams: [],
      isUserSwitched: true,
      userId: 'user-456',
      userName: 'Test User',
      users: [],
    })

    render(<SwitchBar />)
    expect(screen.queryByText('Switch User')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: true,
      teamId: 'team-123',
      teamName: 'Test Team',
      teams: [],
      isUserSwitched: false,
      userId: null,
      userName: null,
      users: [],
    })

    const { container } = render(<SwitchBar className="custom-class" />)
    const div = container.firstChild

    expect(div).toHaveClass('custom-class')
  })

  it('renders children when provided', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: true,
      teamId: 'team-123',
      teamName: 'Test Team',
      teams: [],
      isUserSwitched: false,
      userId: null,
      userName: null,
      users: [],
    })

    render(
      <SwitchBar>
        <div data-testid="child">Child content</div>
      </SwitchBar>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('passes through additional props', () => {
    useSessionContext.mockReturnValue({
      isTeamSwitched: true,
      teamId: 'team-123',
      teamName: 'Test Team',
      teams: [],
      isUserSwitched: false,
      userId: null,
      userName: null,
      users: [],
    })

    render(<SwitchBar data-testid="custom-bar" />)
    expect(screen.getByTestId('custom-bar')).toBeInTheDocument()
  })
})
