import NotificationsButton from './NotificationsButton'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// @note mock ResizeObserver for headlessui/react
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// @note mock useFetch to control the fetch behavior in tests
const mockFetch = jest.fn()

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: () => ({ fetch: mockFetch }),
}))

// @note mock useRouter
jest.mock('@/hooks/useRouter', () => ({
  __esModule: true,
  default: () => ({
    basePath: '',
    resolveHref: (href) => href,
    normalizeHref: (href) => href,
  }),
}))

// @note mock GlobalRootPortal to render children directly
jest.mock('@/components/GlobalRoot', () => ({
  GlobalRootPortal: ({ children }) => <div>{children}</div>,
}))

describe('NotificationsButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render bell icon button', async () => {
    mockFetch.mockResolvedValue({
      data: { clr3m5n8k000f08jqcs1u2v6p: { alerts: [] } },
      error: null,
    })

    render(<NotificationsButton />)

    const button = screen.getByRole('button', { name: 'Notifications' })

    expect(button).toBeInTheDocument()
  })

  it('should show notification dot when there are alerts', async () => {
    mockFetch.mockResolvedValue({
      data: {
        clr3m5n8k000f08jqcs1u2v6p: {
          alerts: [
            {
              severity: 'warning',
              title: 'Usage Warning',
              message: 'You are approaching your limit',
            },
          ],
        },
      },
      error: null,
    })

    render(<NotificationsButton />)

    await waitFor(() => {
      const dot = document.querySelector('.bg-blue-500')

      expect(dot).toBeInTheDocument()
    })
  })

  it('should show red dot when there are critical alerts', async () => {
    mockFetch.mockResolvedValue({
      data: {
        clr3m5n8k000f08jqcs1u2v6p: {
          alerts: [
            {
              severity: 'critical',
              title: 'Critical Alert',
              message: 'Critical issue detected',
            },
          ],
        },
      },
      error: null,
    })

    render(<NotificationsButton />)

    await waitFor(() => {
      const dot = document.querySelector('.bg-red-500')

      expect(dot).toBeInTheDocument()
    })
  })

  it('should not show notification dot when there are no alerts', async () => {
    mockFetch.mockResolvedValue({
      data: {
        clr3m5n8k000f08jqcs1u2v6p: {
          alerts: [],
        },
      },
      error: null,
    })

    render(<NotificationsButton />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const redDot = document.querySelector('.bg-red-500')
    const blueDot = document.querySelector('.bg-blue-500')

    expect(redDot).not.toBeInTheDocument()
    expect(blueDot).not.toBeInTheDocument()
  })

  it('should open popup when clicked', async () => {
    mockFetch.mockResolvedValue({
      data: {
        clr3m5n8k000f08jqcs1u2v6p: {
          alerts: [
            {
              severity: 'warning',
              title: 'Usage Warning',
              message: 'You are approaching your limit',
            },
          ],
        },
      },
      error: null,
    })

    render(<NotificationsButton />)

    // @note wait for the notification dot to appear (indicates alerts are loaded)
    await waitFor(() => {
      const dot = document.querySelector('.bg-blue-500')

      expect(dot).toBeInTheDocument()
    })

    const button = screen.getByRole('button', { name: 'Notifications' })

    fireEvent.click(button)

    // @note the popup should be visible after clicking with link to alerts page
    await waitFor(() => {
      expect(screen.getByText('View all alerts')).toBeInTheDocument()
    })
  })

  it('should handle fetch errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      data: null,
      error: 'Failed to fetch',
    })

    render(<NotificationsButton />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // @note should still render without crashing
    const button = screen.getByRole('button', { name: 'Notifications' })

    expect(button).toBeInTheDocument()

    const dot = document.querySelector('.bg-red-500')

    expect(dot).not.toBeInTheDocument()
  })

  it('should fetch alerts report on mount', async () => {
    mockFetch.mockResolvedValue({
      data: { clr3m5n8k000f08jqcs1u2v6p: { alerts: [] } },
      error: null,
    })

    render(<NotificationsButton />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/platform/report/generate',
        expect.objectContaining({
          method: 'POST',
          data: {
            clr3m5n8k000f08jqcs1u2v6p: { periodDays: 7 },
          },
          trackLoading: false,
        })
      )
    })
  })

  it('should display alert details in popup', async () => {
    mockFetch.mockResolvedValue({
      data: {
        clr3m5n8k000f08jqcs1u2v6p: {
          alerts: [
            {
              severity: 'critical',
              title: 'Rate Limit Exceeded',
              message: 'You have exceeded your API rate limit',
            },
          ],
        },
      },
      error: null,
    })

    render(<NotificationsButton />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const button = screen.getByRole('button', { name: 'Notifications' })

    fireEvent.click(button)

    // @note wait for popup to open and display alert details
    await waitFor(() => {
      expect(screen.getByText('Rate Limit Exceeded')).toBeInTheDocument()
      expect(
        screen.getByText('You have exceeded your API rate limit')
      ).toBeInTheDocument()
    })
  })

  it('should show empty state when no alerts', async () => {
    mockFetch.mockResolvedValue({
      data: {
        clr3m5n8k000f08jqcs1u2v6p: {
          alerts: [],
        },
      },
      error: null,
    })

    render(<NotificationsButton />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const button = screen.getByRole('button', { name: 'Notifications' })

    fireEvent.click(button)

    // @note should show empty state message
    await waitFor(() => {
      expect(screen.getByText('No recent usage alerts.')).toBeInTheDocument()
    })
  })
})
