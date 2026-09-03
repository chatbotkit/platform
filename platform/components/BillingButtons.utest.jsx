// Import the mocked modules
import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

import BillingButtons from './BillingButtons'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    fetch: jest.fn(),
  })),
}))

jest.mock('@/hooks/useRouter', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    push: jest.fn(),
    asPath: '/current-path',
  })),
}))

const mockFetch = jest.fn()
const mockRouterPush = jest.fn()

describe('BillingButtons', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    useFetch.mockReturnValue({
      fetch: mockFetch,
    })

    useRouter.mockReturnValue({
      push: mockRouterPush,
      asPath: '/current-path',
    })

    global.confirm = jest.fn(() => true)
  })

  describe('basic functionality', () => {
    it('should render Manage Billing button for all plans', () => {
      render(<BillingButtons plan="basic" upgradable />)
      expect(screen.getByText('Manage Billing')).toBeInTheDocument()
    })

    it('should always show at least Manage Billing button', () => {
      render(<BillingButtons plan="unknown" />)

      const buttons = screen.getAllByRole('button')

      expect(buttons.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Manage Billing')).toBeInTheDocument()
    })
  })

  describe('trial plan buttons', () => {
    it('should show Skip Trial button for trial plan', () => {
      render(<BillingButtons plan="trial" />)
      expect(screen.getByText('Skip Trial')).toBeInTheDocument()
    })

    it('should show Upgrade button for trial plan', () => {
      // @note a trial resolves upgradable from its own limits bucket, the
      // same as any plan - the page passes it through
      render(<BillingButtons plan="trial" upgradable />)
      expect(screen.getByText('Upgrade')).toBeInTheDocument()
    })

    it('should not show Add Booster button for trial plan', () => {
      render(<BillingButtons plan="trial" />)
      expect(screen.queryByText('Add Booster')).not.toBeInTheDocument()
    })
  })

  describe('free plan buttons', () => {
    it('should show Upgrade button for free plan', () => {
      render(<BillingButtons plan="free" />)

      const upgradeButtons = screen.getAllByText('Upgrade')

      expect(upgradeButtons.length).toBeGreaterThan(0)
    })

    it('should not show Skip Trial button for free plan', () => {
      render(<BillingButtons plan="free" />)
      expect(screen.queryByText('Skip Trial')).not.toBeInTheDocument()
    })

    it('should not show Add Booster button for free plan', () => {
      render(<BillingButtons plan="free" />)
      expect(screen.queryByText('Add Booster')).not.toBeInTheDocument()
    })
  })

  describe('mid-ladder plan buttons (upgradable)', () => {
    it('should show Add Booster button for an upgradable paid plan', () => {
      render(<BillingButtons plan="basic" upgradable />)
      expect(screen.getByText('Add Booster')).toBeInTheDocument()
    })

    it('should show Upgrade button for an upgradable paid plan', () => {
      render(<BillingButtons plan="basic" upgradable />)
      expect(screen.getByText('Upgrade')).toBeInTheDocument()
    })

    it('should not show Skip Trial button for an upgradable paid plan', () => {
      render(<BillingButtons plan="basic" upgradable />)
      expect(screen.queryByText('Skip Trial')).not.toBeInTheDocument()
    })
  })

  describe('top-of-ladder plan buttons (not upgradable)', () => {
    // @note the top of the ladder is whatever plan sets `upgradable: false`
    // in its limit table - no tier name is special

    it('should not show Add Booster button at the top of the ladder', () => {
      render(<BillingButtons plan="ultimate" upgradable={false} />)
      expect(screen.queryByText('Add Booster')).not.toBeInTheDocument()
    })

    it('should not show Upgrade button at the top of the ladder', () => {
      render(<BillingButtons plan="ultimate" upgradable={false} />)
      expect(screen.queryByText('Upgrade')).not.toBeInTheDocument()
    })

    it('should only show Manage Billing button at the top of the ladder', () => {
      render(<BillingButtons plan="ultimate" upgradable={false} />)

      const buttons = screen.getAllByRole('button')

      expect(buttons).toHaveLength(1)
      expect(screen.getByText('Manage Billing')).toBeInTheDocument()
    })
  })

  describe('button interactions', () => {
    it('should navigate to upgrade page when Upgrade is clicked', async () => {
      render(<BillingButtons plan="free" />)

      const upgradeButton = screen.getByRole('button', { name: 'Upgrade' })

      fireEvent.click(upgradeButton)

      expect(mockRouterPush).toHaveBeenCalledWith('/billing/upgrade')
    })

    it('should show confirmation dialog when Skip Trial is clicked', async () => {
      render(<BillingButtons plan="trial" />)

      const skipButton = screen.getByText('Skip Trial')

      fireEvent.click(skipButton)

      expect(global.confirm).toHaveBeenCalledWith(
        expect.stringContaining('cancel your current trial')
      )
    })

    it('should not name a specific plan in the confirmation dialog', () => {
      // @note a trial can be billed on any plan in `trialPlans`, so the copy
      // must not promise the customer a particular subscription

      render(<BillingButtons plan="trial" />)

      fireEvent.click(screen.getByText('Skip Trial'))

      const [message] = global.confirm.mock.calls[0]

      for (const name of ['Basic', 'Pro', 'Scale', 'Enterprise']) {
        expect(message).not.toContain(name)
      }
    })

    it('should call skip API when Skip Trial is confirmed', async () => {
      mockFetch.mockResolvedValue({ data: {}, error: null })
      global.confirm.mockReturnValue(true)

      render(<BillingButtons plan="trial" />)

      const skipButton = screen.getByText('Skip Trial')

      fireEvent.click(skipButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/billing/skip', {
          data: {},
          successMessage: 'Your subscription was updated',
        })
      })
    })

    it('should not call skip API when Skip Trial is cancelled', async () => {
      global.confirm.mockReturnValue(false)

      render(<BillingButtons plan="trial" />)

      const skipButton = screen.getByText('Skip Trial')

      fireEvent.click(skipButton)

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should fetch billing session when Manage Billing is clicked', async () => {
      mockFetch.mockResolvedValue({
        data: { redirectUrl: 'https://billing.example.com/session' },
        error: null,
      })

      render(<BillingButtons plan="basic" upgradable returnTo="/dashboard" />)

      const manageButton = screen.getByText('Manage Billing')

      fireEvent.click(manageButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/billing/session', {
          data: { returnTo: '/dashboard' },
        })
      })
    })

    it('should use current path as returnTo when not provided', async () => {
      mockFetch.mockResolvedValue({
        data: { redirectUrl: 'https://billing.example.com/session' },
        error: null,
      })

      render(<BillingButtons plan="basic" upgradable />)

      const manageButton = screen.getByText('Manage Billing')

      fireEvent.click(manageButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/billing/session', {
          data: { returnTo: '/current-path' },
        })
      })
    })

    it('should navigate to billing session URL on success', async () => {
      mockFetch.mockResolvedValue({
        data: { redirectUrl: 'https://billing.example.com/session' },
        error: null,
      })

      render(<BillingButtons plan="basic" upgradable />)

      const manageButton = screen.getByText('Manage Billing')

      fireEvent.click(manageButton)

      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith(
          'https://billing.example.com/session'
        )
      })
    })

    it('should not navigate when billing session fetch fails', async () => {
      mockFetch.mockResolvedValue({
        data: null,
        error: 'Failed to create session',
      })

      render(<BillingButtons plan="basic" upgradable />)

      const manageButton = screen.getByText('Manage Billing')

      fireEvent.click(manageButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('should fetch checkout session when Add Booster is clicked', async () => {
      mockFetch.mockResolvedValue({
        data: { redirectUrl: 'https://checkout.example.com/session' },
        error: null,
      })

      render(<BillingButtons plan="basic" upgradable returnTo="/dashboard" />)

      const boosterButton = screen.getByText('Add Booster')

      fireEvent.click(boosterButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/billing/checkout', {
          data: {
            plan: 'booster',
            returnTo: '/dashboard',
          },
        })
      })
    })

    it('should navigate to checkout URL when Add Booster succeeds', async () => {
      mockFetch.mockResolvedValue({
        data: { redirectUrl: 'https://checkout.example.com/session' },
        error: null,
      })

      render(<BillingButtons plan="basic" upgradable />)

      const boosterButton = screen.getByText('Add Booster')

      fireEvent.click(boosterButton)

      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith(
          'https://checkout.example.com/session'
        )
      })
    })

    it('should not navigate when Add Booster checkout fails', async () => {
      mockFetch.mockResolvedValue({
        data: null,
        error: 'Failed to create checkout',
      })

      render(<BillingButtons plan="basic" upgradable />)

      const boosterButton = screen.getByText('Add Booster')

      fireEvent.click(boosterButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      expect(mockRouterPush).not.toHaveBeenCalled()
    })
  })

  describe('children rendering', () => {
    it('should render children when provided', () => {
      render(
        <BillingButtons plan="basic">
          <button type="button" data-testid="custom-button">
            Custom Button
          </button>
        </BillingButtons>
      )

      expect(screen.getByTestId('custom-button')).toBeInTheDocument()
    })

    it('should render children alongside standard buttons', () => {
      render(
        <BillingButtons plan="basic">
          <div data-testid="custom-content">Extra Content</div>
        </BillingButtons>
      )

      expect(screen.getByText('Manage Billing')).toBeInTheDocument()
      expect(screen.getByTestId('custom-content')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined plan', () => {
      render(<BillingButtons plan={undefined} />)
      expect(screen.getByText('Manage Billing')).toBeInTheDocument()
    })

    it('should handle null plan', () => {
      render(<BillingButtons plan={null} />)
      expect(screen.getByText('Manage Billing')).toBeInTheDocument()
    })

    it('should handle empty string plan', () => {
      render(<BillingButtons plan="" />)
      expect(screen.getByText('Manage Billing')).toBeInTheDocument()
    })

    it('should handle unknown plan value', () => {
      render(<BillingButtons plan="unknown-plan" />)
      expect(screen.getByText('Manage Billing')).toBeInTheDocument()
    })

    it('should handle empty returnTo prop', () => {
      render(<BillingButtons plan="basic" upgradable returnTo="" />)
      expect(screen.getByText('Manage Billing')).toBeInTheDocument()
    })
  })

  describe('button styling', () => {
    it('should apply correct classes to Manage Billing button', () => {
      render(<BillingButtons plan="basic" upgradable />)

      const manageButton = screen.getByText('Manage Billing')

      expect(manageButton).toHaveClass('default-button')
    })

    it('should apply correct classes to Skip Trial button', () => {
      render(<BillingButtons plan="trial" />)

      const skipButton = screen.getByText('Skip Trial')

      expect(skipButton).toHaveClass('default-button')
    })

    it('should apply correct classes to Upgrade button', () => {
      render(<BillingButtons plan="free" />)

      const upgradeButton = screen.getByRole('button', { name: 'Upgrade' })

      expect(upgradeButton).toHaveClass('primary-button')
    })

    it('should apply correct classes to Add Booster button', () => {
      render(<BillingButtons plan="basic" upgradable />)

      const boosterButton = screen.getByText('Add Booster').closest('button')

      expect(boosterButton).toHaveClass('default-button')
    })
  })
})
