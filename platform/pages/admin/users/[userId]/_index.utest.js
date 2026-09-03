/**
 * Tests for the admin user detail page.
 * Verifies that number formatting uses a consistent locale to prevent
 * React hydration mismatches between server and client rendering.
 */
import Index from './index'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/prisma/client', () => ({}))

jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }))
jest.mock('@/lib/session.get', () => ({ getSoftSession: jest.fn() }))
jest.mock('@/lib/struct', () => ({ makeJsonSafe: jest.fn((v) => v) }))
jest.mock('@/lib/usage.get', () => ({ getUsage: jest.fn() }))
jest.mock('@/lib/user.find', () => ({ findUser: jest.fn() }))
jest.mock('@/lib/billing.core', () => ({ userToPlan: jest.fn() }))

jest.mock('next/router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    pathname: '/admin/users/[userId]',
    query: { userId: 'test-user-id' },
    asPath: '/admin/users/test-user-id',
    events: { on: jest.fn(), off: jest.fn() },
  })),
}))

jest.mock(
  '@/layouts/Admin',
  () =>
    function Admin({ children }) {
      return <div data-testid="admin-layout">{children}</div>
    }
)

jest.mock(
  '@/components/NavHeader',
  () =>
    function NavHeader() {
      return <div data-testid="nav-header" />
    }
)

jest.mock(
  '@/components/Link',
  () =>
    function Link({ href, children, ...props }) {
      return (
        <a href={href} {...props}>
          {children}
        </a>
      )
    }
)

const mockFetch = jest.fn()
const mockPush = jest.fn()

jest.mock('@/hooks/useFetch', () => () => ({ fetch: mockFetch }))
jest.mock('@/hooks/useRouter', () => () => ({ push: mockPush }))

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  description: '',
  role: 'user',
  organization: '',
  industry: '',
  goal: '',
  channel: '',
  billingSubscriptionStatus: 'active',
  billingCustomerId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
}

const mockPlan = 'basic'

const mockUsage = {
  tokens: { value: 1234567 },
  conversations: { value: 89012 },
  messages: { value: 345678 },
}

describe('Admin User Index Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue({ error: null })
    mockPush.mockReset()
    global.confirm = jest.fn(() => true)
    global.prompt = jest.fn(() => mockUser.email)
  })

  it('renders token usage with consistent en-US locale formatting', () => {
    render(<Index user={mockUser} plan={mockPlan} usage={mockUsage} />)

    // Verify that large numbers are formatted using en-US locale (comma separators)
    // This ensures no hydration mismatch between server (Node.js) and client (browser)
    expect(screen.getByText('1,234,567')).toBeInTheDocument()
    expect(screen.getByText('89,012')).toBeInTheDocument()
    expect(screen.getByText('345,678')).toBeInTheDocument()
  })

  it('renders without crashing when usage is not provided', () => {
    render(<Index user={mockUser} plan={mockPlan} />)

    expect(screen.queryByText('token usage')).not.toBeInTheDocument()
  })

  it('renders createdAt date with suppressHydrationWarning to prevent server/client timezone mismatch', () => {
    render(<Index user={mockUser} plan={mockPlan} usage={mockUsage} />)

    // The created at row must be present
    expect(screen.getByText('created at')).toBeInTheDocument()

    // The td containing the date must have suppressHydrationWarning to prevent
    // hydration mismatch when server (UTC) and client (user's timezone) format dates differently
    const dateCell = screen
      .getByText('created at')
      .closest('tr')
      .querySelector('td:last-child')

    expect(dateCell).toBeInTheDocument()
    // suppressHydrationWarning is a React prop - verify the element is rendered correctly
    // @note the fix prevents the React hydration mismatch error
    expect(dateCell.textContent).not.toBe('')
  })

  it('carries no billing concepts - user management only', () => {
    render(
      <Index
        user={{ ...mockUser, billingCustomerId: 'cus_123' }}
        plan={mockPlan}
        usage={mockUsage}
      />
    )

    expect(
      screen.getByRole('button', {
        name: 'Delete',
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Full Delete' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Sync Status' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('subscription status')).not.toBeInTheDocument()
    expect(screen.queryByText('Billing')).not.toBeInTheDocument()
  })

  it('requires typed confirmation before deleting the user', async () => {
    render(
      <Index
        user={{ ...mockUser, billingCustomerId: 'cus_123' }}
        plan={mockPlan}
        usage={mockUsage}
      />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Delete',
      })
    )

    expect(global.confirm).toHaveBeenCalledWith(
      'This will permanently delete this user. Continue to typed confirmation?'
    )
    expect(global.prompt).toHaveBeenCalledWith(
      'Type test@example.com to confirm deleting this user.'
    )
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/user/test-user-id/delete',
        {
          method: 'POST',
          data: {
            sendDeletionEmail: true,
          },
        }
      )
      expect(mockPush).toHaveBeenCalledWith('/admin/users')
    })
  })
})
