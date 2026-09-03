import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

import UpgradePlans from './UpgradePlans'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// @note a controlled catalogue rather than the deployment's own - the
// assertions are about the wiring (which card gets which badge and CTA), not
// about any real deployment's business. The selling configuration reaches
// the component as props, exactly as the upgrade page serializes it: a null
// price marks a plan that is not self-serve.
const subscriptions = {
  trialDays: 7,
  pricing: { free: 0, basic: 25, pro: 65, ultimate: null },
}

const trialPlans = ['pro']

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/hooks/useRouter', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/components/Link', () => {
  return function Link({ href, children, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

const limits = {
  free: { tokens: 0, database: { bots: 3 } },
  basic: { tokens: 1000000, database: { bots: 5 } },
  pro: { tokens: 2000000, database: { bots: 25 } },
  ultimate: { tokens: Infinity, database: { bots: Infinity } },
}

describe('UpgradePlans', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    useFetch.mockReturnValue({ fetch: jest.fn() })

    useRouter.mockReturnValue({ push: jest.fn(), asPath: '/billing/upgrade' })
  })

  describe('recommended plan', () => {
    it('marks the primary trial plan as recommended', () => {
      render(<UpgradePlans subscriptions={subscriptions} trialPlans={trialPlans} currentPlan="free" limits={limits} />)

      const badge = screen.getByText('Recommended')

      // the badge sits on the pro card - the first configured trial plan
      expect(badge.closest('div[class*="border"]')).toHaveTextContent('Pro')
    })

    it('does not recommend the plan the user is already on', () => {
      render(<UpgradePlans subscriptions={subscriptions} trialPlans={trialPlans} currentPlan="pro" limits={limits} />)

      expect(screen.queryByText('Recommended')).not.toBeInTheDocument()
    })
  })

  describe('trial anchoring', () => {
    // @note a trialing user resolves to the structural `trial` plan, which is
    // not a rung on the pricing ladder - the component anchors it to the
    // primary trial plan, which then reads as the current one
    it('marks the primary trial plan as current for a trialing user', () => {
      render(<UpgradePlans subscriptions={subscriptions} trialPlans={trialPlans} currentPlan="trial" limits={limits} />)

      const badge = screen.getByText('Current plan')

      expect(badge.closest('div[class*="border"]')).toHaveTextContent('Pro')

      // the current rung gets no checkout and no recommendation
      expect(screen.queryByText('Start 7-day trial')).not.toBeInTheDocument()
      expect(screen.queryByText('Recommended')).not.toBeInTheDocument()
    })
  })

  describe('current plan', () => {
    it('marks the current rung and renders no checkout for it', () => {
      render(<UpgradePlans subscriptions={subscriptions} trialPlans={trialPlans} currentPlan="free" limits={limits} />)

      expect(screen.getByText('Current plan')).toBeInTheDocument()
      expect(screen.getByText('Your plan')).toBeInTheDocument()
      expect(screen.queryByText('Switch to Free')).not.toBeInTheDocument()
    })
  })

  describe('calls to action', () => {
    it('offers a trial on a trialable plan and a switch on the rest', () => {
      render(<UpgradePlans subscriptions={subscriptions} trialPlans={trialPlans} currentPlan="free" limits={limits} />)

      expect(screen.getByText('Start 7-day trial')).toBeInTheDocument()
      expect(screen.getByText('Switch to Basic')).toBeInTheDocument()
    })

    it('renders an unbounded plan as a conversation, not a checkout', () => {
      render(<UpgradePlans subscriptions={subscriptions} trialPlans={trialPlans} currentPlan="free" limits={limits} />)

      const contact = screen.getByText('Contact us')

      expect(contact.closest('a')).toHaveAttribute('href', '/support')
      expect(screen.getByText('Custom')).toBeInTheDocument()
      expect(screen.queryByText('Switch to Ultimate')).not.toBeInTheDocument()
    })

    it('sends checkout details as JSON data', async () => {
      const fetch = jest.fn().mockResolvedValue({
        data: { redirectUrl: 'https://checkout.example.com/session' },
      })

      useFetch.mockReturnValue({ fetch })

      render(<UpgradePlans subscriptions={subscriptions} trialPlans={trialPlans} currentPlan="free" limits={limits} />)

      fireEvent.click(screen.getByText('Start 7-day trial'))

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/billing/checkout', {
          data: {
            plan: 'pro',
            trial: true,
            returnTo: '/billing/upgrade',
          },
        })
      })
    })
  })

  describe('nothing to sell', () => {
    // @note a truly planless deployment never reaches the component - the
    // page 404s from getServerSideProps - so this covers the sellable
    // deployment with nothing left to offer this user

    it('says so instead of rendering an empty grid', () => {
      render(
        <UpgradePlans
          subscriptions={{ trialDays: 7, pricing: { solo: 10 } }}
          trialPlans={trialPlans}
          currentPlan="solo"
          limits={limits}
        />
      )

      expect(
        screen.getByText('There is nothing to upgrade to on this deployment.')
      ).toBeInTheDocument()

      expect(screen.queryByText('Compare plans')).not.toBeInTheDocument()
    })
  })
})
