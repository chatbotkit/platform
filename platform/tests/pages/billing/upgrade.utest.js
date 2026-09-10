import { getServerSideProps } from '@/pages/billing/upgrade'

import {
  canDoBilling,
  hasOpenSubscription,
  hasSubscription,
} from '@/lib/billing.core'
import { getSoftSession } from '@/lib/session.get'
import { revealUserPlan } from '@/lib/user.plan'

jest.mock('@/config/limits', () => ({
  __esModule: true,
  default: { free: {}, basic: {}, pro: {} },
}))

jest.mock('@/lib/billing.core', () => ({
  isSellable: true,
  isBillingConfigured: jest.fn(() => true),
  canDoBilling: jest.fn(() => true),
  hasSubscription: jest.fn(() => false),
  hasOpenSubscription: jest.fn(() => false),
  subscriptionsConfig: { trialDays: 7, pricing: { basic: 25, pro: 65 } },
  trialPlans: ['pro'],
}))

jest.mock('@/lib/session.get', () => ({
  getSoftSession: jest.fn(),
}))

jest.mock('@/lib/user.plan', () => ({
  revealUserPlan: jest.fn(),
}))

jest.mock('@/layouts/Dashboard', () => () => null)
jest.mock('@/components/Link', () => () => null)
jest.mock('@/components/UpgradePlans', () => () => null)

// @note the page decides server-side whether the cards may check out at
// all: the account row that holds the subscription is the parent's for a
// child account, so the billing facts must be read off the effective user,
// while the child gate reads the session user itself.

describe('/billing/upgrade getServerSideProps', () => {
  const context = { req: {}, res: {}, resolvedUrl: '/billing/upgrade' }

  const sessionUser = { id: 'child', email: 'member@example.com', parentId: 'owner' }

  const effectiveUser = {
    id: 'owner',
    email: 'owner@example.com',
    billingSubscriptionId: 'price_pro',
    billingSubscriptionStatus: 'past_due',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    canDoBilling.mockReturnValue(true)
    hasSubscription.mockReturnValue(false)
    hasOpenSubscription.mockReturnValue(false)

    getSoftSession.mockResolvedValue({ user: sessionUser })

    revealUserPlan.mockResolvedValue({ plan: 'free', effectiveUser })
  })

  it('reads the subscription facts off the effective user', async () => {
    hasOpenSubscription.mockReturnValue(true)
    hasSubscription.mockReturnValue(false)

    const { props } = await getServerSideProps(context)

    expect(hasOpenSubscription).toHaveBeenCalledWith(effectiveUser)
    expect(hasSubscription).toHaveBeenCalledWith(effectiveUser)

    expect(props).toMatchObject({
      plan: 'free',
      openSubscription: true,
      lapsed: true,
    })
  })

  it('marks a live subscription as open but not lapsed', async () => {
    hasOpenSubscription.mockReturnValue(true)
    hasSubscription.mockReturnValue(true)

    revealUserPlan.mockResolvedValue({
      plan: 'pro',
      effectiveUser: { ...effectiveUser, billingSubscriptionStatus: 'active' },
    })

    const { props } = await getServerSideProps(context)

    expect(props).toMatchObject({ plan: 'pro', openSubscription: true, lapsed: false })
  })

  it('gates billing on the session user, not the effective one', async () => {
    canDoBilling.mockReturnValue(false)

    const { props } = await getServerSideProps(context)

    expect(canDoBilling).toHaveBeenCalledWith(sessionUser)

    expect(props).toMatchObject({ billable: false })
  })

  it('leaves an account without a subscription free to check out', async () => {
    const { props } = await getServerSideProps(context)

    expect(props).toMatchObject({
      billable: true,
      openSubscription: false,
      lapsed: false,
    })
  })
})
