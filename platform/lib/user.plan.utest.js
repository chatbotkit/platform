/* eslint-disable @typescript-eslint/no-require-imports */
import { userToPlan } from '@/lib/billing.core'
import { revealUserPlan } from '@/lib/user.plan'

// @note plan names are deployment data - a fixture catalogue and selling
// configuration keep every assertion deterministic

jest.mock('@/config/limits', () => ({
  // @note keep the real fullLimitSchema - the overrides section derives its
  // schema from it at import
  ...jest.requireActual('@/config/limits'),

  __esModule: true,

  hasPlans: true,

  PLAN_KEYS: [
    'free',
    'trial',
    'basic',
    'pro',
    'proPlus',
    'scale',
    'scalePlus',
    'ultimate',
  ],

  default: {
    free: {},
    trial: {},
    basic: {},
    pro: {},
    proPlus: {},
    scale: {},
    scalePlus: {},
    ultimate: {},
  },
}))

jest.mock('@chatbotkit-dev/billing', () => {
  // @note hoisted above the imports, so the module's own configuration seam
  // sees the fixture catalogue when it evaluates - the model reads its own
  // facts internally, where a mock override cannot reach
  process.env.SUBSCRIPTIONS_CONFIG = JSON.stringify({
    plans: {
      basic: { price: 25, priceIds: ['price_basic_1'] },
      pro: { price: 65, priceIds: ['price_pro_1'] },
      scale: { price: 125, priceIds: ['price_scale_1'] },
    },
  })

  return {
    ...jest.requireActual('@chatbotkit-dev/billing'),

    __esModule: true,
  }
})

jest.mock('@/lib/user.get', () => ({
  fastGetUserByEmail: jest.fn(),
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/cache', () => ({
  swrCache: jest.fn((_key, _ttl, fn) => fn()),
}))

const { fastGetUserById } = require('@/lib/user.get')

// @note resolving a sold plan from a price id needs the installed billing
// module to sell - the stub module sells nothing and resolves every row free
const { isConfigured } = require('@chatbotkit-dev/billing')

const itIfConfigured = isConfigured ? it : it.skip

describe('userToPlan', () => {
  itIfConfigured('must correctly return the plan', () => {
    expect(userToPlan({})).toEqual('free')
    expect(
      userToPlan({ billingSubscriptionId: Math.random().toString(32).slice(2) })
    ).toEqual('free')
    expect(
      userToPlan({
        billingSubscriptionId: 'price_basic_1',
        billingSubscriptionStatus: 'active',
      })
    ).toEqual('basic')
    expect(
      userToPlan({
        billingSubscriptionId: 'price_pro_1',
        billingSubscriptionStatus: 'active',
      })
    ).toEqual('pro')
    expect(
      userToPlan({
        billingSubscriptionId: 'price_basic_1',
        billingSubscriptionStatus: 'trialing',
      })
    ).toEqual('trial')
    expect(
      userToPlan({
        billingSubscriptionId: 'price_pro_1',
        billingSubscriptionStatus: 'trialing',
      })
    ).toEqual('trial')
    expect(
      userToPlan({
        billingSubscriptionId: 'price_basic_1',
        billingSubscriptionStatus: 'past_due',
      })
    ).toEqual('free')
    expect(
      userToPlan({
        billingSubscriptionId: 'price_pro_1',
        billingSubscriptionStatus: 'past_due',
      })
    ).toEqual('free')
  })

  it('returns free when billingSubscriptionId is present but billingSubscriptionStatus is missing', () => {
    expect(
      userToPlan({
        billingSubscriptionId: 'price_pro_1',
        billingSubscriptionStatus: null,
      })
    ).toEqual('free')
    expect(
      userToPlan({
        billingSubscriptionId: 'price_basic_1',
        billingSubscriptionStatus: undefined,
      })
    ).toEqual('free')
  })

  itIfConfigured('returns trial for trialing status regardless of subscription tier', () => {
    const trialing = 'trialing'

    expect(
      userToPlan({
        billingSubscriptionId: 'price_basic_1',
        billingSubscriptionStatus: trialing,
      })
    ).toEqual('trial')
    expect(
      userToPlan({
        billingSubscriptionId: 'price_pro_1',
        billingSubscriptionStatus: trialing,
      })
    ).toEqual('trial')
  })

  itIfConfigured('returns proPlus for pro plus subscription with active status', () => {
    expect(
      userToPlan({
        billingSubscriptionId: 'proPlus',
        billingSubscriptionStatus: 'active',
      })
    ).toEqual('proPlus')
  })

  itIfConfigured('returns scale for scale subscription with active status', () => {
    expect(
      userToPlan({
        billingSubscriptionId: 'scale',
        billingSubscriptionStatus: 'active',
      })
    ).toEqual('scale')
  })

  itIfConfigured('returns scalePlus for scalePlus subscription with active status', () => {
    expect(
      userToPlan({
        billingSubscriptionId: 'scalePlus',
        billingSubscriptionStatus: 'active',
      })
    ).toEqual('scalePlus')
  })

  itIfConfigured('returns ultimate for ultimate subscription with active status', () => {
    expect(
      userToPlan({
        billingSubscriptionId: 'ultimate',
        billingSubscriptionStatus: 'active',
      })
    ).toEqual('ultimate')
  })

  it('returns free for unrecognised subscription id with active status', () => {
    expect(
      userToPlan({
        billingSubscriptionId: 'price_unknown_xyz',
        billingSubscriptionStatus: 'active',
      })
    ).toEqual('free')
  })
})

describe('revealUserPlan', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // @note resolution always reads the account row by id - the caller's shape
  // contributes nothing beyond the id (sessions carry no billing facts)

  itIfConfigured('resolves the plan from the fetched row, not the caller shape', async () => {
    const sessionUser = {
      id: 'user_123',
      email: 'user@example.com',
    }

    fastGetUserById.mockResolvedValue({
      id: 'user_123',
      email: 'user@example.com',
      billingSubscriptionId: 'price_pro_1',
      billingSubscriptionStatus: 'active',
      parentId: null,
    })

    const result = await revealUserPlan(sessionUser)

    expect(result.plan).toEqual('pro')
    expect(fastGetUserById).toHaveBeenCalledWith('user_123')
  })

  it('returns free plan when the row has no subscription', async () => {
    const row = {
      id: 'user_456',
      email: 'user@example.com',
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: null,
    }

    fastGetUserById.mockResolvedValue(row)

    const result = await revealUserPlan({
      id: 'user_456',
      email: 'user@example.com',
    })

    expect(result.plan).toEqual('free')
    expect(result.effectiveUser).toBe(row)
  })

  itIfConfigured('resolves the parent plan for a child - the parent holds the subscription', async () => {
    // @note the child's identity email is synthetic and non-routable, so
    // resolution must never depend on it
    const childRow = {
      id: 'child_user_1',
      email: '',
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: 'parent_user_1',
    }

    const parentRow = {
      id: 'parent_user_1',
      email: 'parent@example.com',
      billingSubscriptionId: 'price_pro_1',
      billingSubscriptionStatus: 'active',
      parentId: null,
    }

    fastGetUserById.mockImplementation(async (id) =>
      id === 'child_user_1' ? childRow : parentRow
    )

    const result = await revealUserPlan({ id: 'child_user_1', email: '' })

    expect(result.plan).toEqual('pro')
    expect(result.effectiveUser).toBe(parentRow)
    expect(fastGetUserById).toHaveBeenCalledWith('parent_user_1')
  })

  itIfConfigured('hops straight to the parent when the caller provides parentId', async () => {
    // @note parentId is structural and sessions carry it - a child session
    // shape resolves with a single lookup, the parent row
    const parentRow = {
      id: 'parent_direct',
      email: 'parent@example.com',
      billingSubscriptionId: 'price_scale_1',
      billingSubscriptionStatus: 'active',
      parentId: null,
    }

    fastGetUserById.mockResolvedValue(parentRow)

    const result = await revealUserPlan({
      id: 'child_direct',
      email: '',
      parentId: 'parent_direct',
    })

    expect(result.plan).toEqual('scale')
    expect(result.effectiveUser).toBe(parentRow)
    expect(fastGetUserById).toHaveBeenCalledTimes(1)
    expect(fastGetUserById).toHaveBeenCalledWith('parent_direct')
  })

  it('falls back to the caller shape when the row does not exist', async () => {
    const user = {
      id: 'user_orphan',
      email: 'orphan@example.com',
    }

    fastGetUserById.mockResolvedValue(null)

    const result = await revealUserPlan(user)

    expect(result.plan).toEqual('free')
    expect(result.effectiveUser).toBe(user)
  })

  it('returns free plan when the parent row cannot be found', async () => {
    const childRow = {
      id: 'child_2',
      email: '',
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: 'missing_parent',
    }

    fastGetUserById.mockImplementation(async (id) =>
      id === 'child_2' ? childRow : null
    )

    const result = await revealUserPlan({ id: 'child_2', email: '' })

    expect(result.plan).toEqual('free')
    expect(result.effectiveUser).toBe(childRow)
  })

  itIfConfigured('uses the parent row as effectiveUser for limit calculations', async () => {
    const childRow = {
      id: 'child_999',
      email: '',
      billingSubscriptionId: null,
      billingSubscriptionStatus: null,
      parentId: 'parent_999',
    }

    const parentRow = {
      id: 'parent_999',
      email: 'parent@example.com',
      billingSubscriptionId: 'price_basic_1',
      billingSubscriptionStatus: 'active',
      parentId: null,
    }

    fastGetUserById.mockImplementation(async (id) =>
      id === 'child_999' ? childRow : parentRow
    )

    const result = await revealUserPlan({ id: 'child_999', email: '' })

    // The effectiveUser must be the parent so rate-limit keys and usage
    // records are scoped to the parent User, not the child User.
    expect(result.effectiveUser.id).toEqual('parent_999')
    expect(result.plan).toEqual('basic')
  })
})
