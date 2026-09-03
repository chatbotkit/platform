/**
 * @jest-environment node
 */
import { startCheckout } from '@chatbotkit-dev/billing/provider'

import prisma from '@/prisma/client'

import { canDoBilling } from '@/lib/billing.core'

import handler, { bodySchema } from '@/pages/api/billing/checkout'

// @note the billing provider is mocked at the module boundary - the route
// only loads the account, applies the per-user gate, shapes the intent and
// maps outcomes to responses, so that is all this suite asserts. What may be
// bought, and by whom, is the provider's vocabulary and is covered in the
// billing module's own suite.

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

jest.mock('@chatbotkit-dev/billing/provider', () => ({
  __esModule: true,
  startCheckout: jest.fn(),
}))

// @note the handler is wrapped in withPost(withSession(withSchema(...))). only
// the two outer wrappers are stubbed out, so `bodySchema` below is still the
// schema the handler actually validates against

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/billing.handler', () => ({
  withBilling: (fn) => fn,
}))

jest.mock('@/lib/billing.core', () => ({
  canDoBilling: jest.fn(() => true),
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/host', () => ({
  getExternalHostURL: () => 'https://chatbotkit.com',
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(),
  log: jest.fn(),
  createSpan: () => ({ finish: jest.fn() }),
}))

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const SESSION = { user: { id: 'user-1', email: 'test@example.com', name: 'T' } }

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    billingCustomerId: 'cus_test',
    billingSubscriptionId: 'pro',
    billingSubscriptionStatus: null,
    billingSubscriptionTrialedAt: null,
    parentId: null,
    ...overrides,
  }
}

function makeRequest(body = { plan: 'pro', returnTo: '/billing/upgrade' }) {
  return new Request('https://chatbotkit.com/api/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('checkout bodySchema', () => {
  // @note the schema validates shape only - which plans exist and which may
  // be trialed is the billing module's vocabulary, resolved inside
  // `startCheckout`

  it('must require a plan', () => {
    expect(bodySchema.validate({}).error).toBeDefined()
  })

  it('must default the trial to false', () => {
    const { error, value } = bodySchema.validate({ plan: 'pro' })

    expect(error).toBeUndefined()
    expect(value.trial).toEqual(false)
  })

  it('must stay oblivious to the catalogue', () => {
    expect(bodySchema.validate({ plan: 'nonsense' }).error).toBeUndefined()
  })

  it('must accept the optional fields', () => {
    const { error } = bodySchema.validate({
      plan: 'pro',
      returnTo: '/billing/upgrade',
      coupon: 'SUMMER',
      referral: 'abc',
    })

    expect(error).toBeUndefined()
  })
})

describe('checkout route', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    prisma.user.findUnique.mockResolvedValue(makeUser())

    canDoBilling.mockReturnValue(true)

    startCheckout.mockResolvedValue({
      outcome: 'redirect',
      url: 'https://checkout.example/session',
    })
  })

  describe('account loading and gating', () => {
    it('reads the account row rather than the session snapshot', async () => {
      await handler(makeRequest(), SESSION)

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      })
      expect(startCheckout).toHaveBeenCalledWith(
        prisma,
        makeUser(),
        expect.anything()
      )
    })

    it('404s when the account is gone', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      const res = await handler(makeRequest(), SESSION)

      expect(res.status).toBe(404)
      expect(startCheckout).not.toHaveBeenCalled()
    })

    it('403s an account the per-user gate refuses', async () => {
      canDoBilling.mockReturnValue(false)

      const res = await handler(makeRequest(), SESSION)

      expect(res.status).toBe(403)
      expect(canDoBilling).toHaveBeenCalledWith(makeUser())
      expect(startCheckout).not.toHaveBeenCalled()
    })
  })

  describe('intent', () => {
    it('hands the body through as the checkout intent', async () => {
      await handler(
        makeRequest({
          plan: 'pro',
          trial: true,
          coupon: 'SUMMER',
          referral: 'abc',
          returnTo: '/billing/upgrade',
        }),
        SESSION
      )

      expect(startCheckout).toHaveBeenCalledWith(prisma, makeUser(), {
        plan: 'pro',
        trial: true,
        coupon: 'SUMMER',
        referral: 'abc',
        returnUrl: 'https://chatbotkit.com/billing/upgrade',
      })
    })

    it('resolves the return url against the external host', async () => {
      await handler(makeRequest({ plan: 'pro', returnTo: '' }), SESSION)

      expect(startCheckout).toHaveBeenLastCalledWith(
        prisma,
        makeUser(),
        expect.objectContaining({ returnUrl: 'https://chatbotkit.com/' })
      )

      await handler(
        makeRequest({ plan: 'pro', returnTo: '//billing/upgrade?x=1#top' }),
        SESSION
      )

      expect(startCheckout).toHaveBeenLastCalledWith(
        prisma,
        makeUser(),
        expect.objectContaining({
          returnUrl: 'https://chatbotkit.com/billing/upgrade',
        })
      )
    })
  })

  describe('outcome mapping', () => {
    it('returns the redirect url', async () => {
      const res = await handler(makeRequest(), SESSION)

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        redirectUrl: 'https://checkout.example/session',
      })
    })

    it.each([
      ['unknown_plan', 400],
      ['trial_unavailable', 400],
      ['possibly_fraudulent', 409],
      ['already_subscribed', 409],
      ['customer_gone', 404],
      ['delinquent', 409],
      ['failed', 500],
    ])('maps %s to %i', async (outcome, status) => {
      startCheckout.mockResolvedValue({ outcome })

      const res = await handler(makeRequest(), SESSION)

      expect(res.status).toBe(status)
    })
  })
})
