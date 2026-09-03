/* eslint-disable @typescript-eslint/no-require-imports */
// @note the planless deployment (no LIMITS_CONFIG) enforces no entitlements:
// the *LimitsOk checks pass through without reading a single counter. Partner
// users are the exception - their limits are set per account by the
// partner rather than derived from a plan, so for them the checks still run
// (and resolve against the unlimited table plus their own custom limits).
import {
  accountLimitsOk,
  databaseLimitsOk,
  rateLimitsOk,
  specialRateLimitsOk,
} from '@/lib/limit.core'

jest.mock('@/config/limits', () => ({
  ...jest.requireActual('@/config/limits'),

  __esModule: true,

  hasPlans: false,

  // @note an empty, valid overrides catalogue for this suite
  overrides: {},
}))

jest.mock('@/lib/user.type', () => ({
  isChildUser: jest.fn(() => false),
}))

jest.mock('@/lib/user.plan', () => ({
  revealUserPlan: jest.fn(async (user) => ({
    plan: 'free',
    effectiveUser: user,
  })),
}))

jest.mock('@/lib/memcache', () => {
  const exec = jest.fn(async () => [])

  const pipeline = jest.fn(() => {
    const chain = { exec }

    chain.get = jest.fn(() => chain)
    chain.del = jest.fn(() => chain)

    return chain
  })

  return { __esModule: true, default: { pipeline } }
})

jest.mock('@/lib/ratelimit', () => ({
  slidingWindow: jest.fn(async () => ({ success: true })),
}))

jest.mock('@/lib/limit.estimate', () => ({
  getApproximateTotalAbilities: jest.fn(async () => 0),
  getApproximateTotalBots: jest.fn(async () => 0),
  getApproximateTotalDatasets: jest.fn(async () => 0),
  getApproximateTotalFiles: jest.fn(async () => 0),
  getApproximateTotalPolicies: jest.fn(async () => 0),
  getApproximateTotalPortals: jest.fn(async () => 0),
  getApproximateTotalRecords: jest.fn(async () => 0),
  getApproximateTotalSkillsets: jest.fn(async () => 0),
  getApproximateTotalTeamMembers: jest.fn(async () => 0),
  getApproximateTotalTeams: jest.fn(async () => 0),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(async () => null),
}))

jest.mock('@/lib/session.context', () => ({
  getSafeSessionStore: jest.fn(async () => ({})),
}))

jest.mock('@/lib/notify', () => ({
  notifyExceededAccountLimits: jest.fn(),
  notifyExceededDatabaseLimits: jest.fn(),
  notifyExceededRateLimits: jest.fn(),
  notifyNearlyExceededAccountLimits: jest.fn(),
  notifyNearlyExceededDatabaseLimits: jest.fn(),
}))

const { isChildUser } = require('@/lib/user.type')
const { revealUserPlan } = require('@/lib/user.plan')
const { slidingWindow } = require('@/lib/ratelimit')
const { getApproximateTotalBots } = require('@/lib/limit.estimate')
const { getSafeSessionStore } = require('@/lib/session.context')
const memcache = require('@/lib/memcache').default

const user = { id: 'u1', email: 'user@example.com' }

beforeEach(() => {
  jest.clearAllMocks()

  isChildUser.mockReturnValue(false)
})

describe('the planless pass-through', () => {
  it('passes rate limits without resolving a plan or touching a counter', async () => {
    await expect(rateLimitsOk(user, ['rate/message'])).resolves.toBe(true)

    expect(revealUserPlan).not.toHaveBeenCalled()
    expect(slidingWindow).not.toHaveBeenCalled()
  })

  it('passes database limits without counting anything', async () => {
    await expect(databaseLimitsOk(user, ['database/bot'])).resolves.toBe(true)

    expect(revealUserPlan).not.toHaveBeenCalled()
    expect(getApproximateTotalBots).not.toHaveBeenCalled()
  })

  it('passes account limits without reading usage counters', async () => {
    await expect(accountLimitsOk(user, ['token'])).resolves.toBe(true)

    expect(revealUserPlan).not.toHaveBeenCalled()
    expect(memcache.pipeline).not.toHaveBeenCalled()
  })

  it('still runs the special rate limits - they are abuse protection, not entitlements', async () => {
    await expect(
      specialRateLimitsOk(user, ['special/rate/initiate'])
    ).resolves.toBe(true)

    expect(getSafeSessionStore).toHaveBeenCalled()
  })
})

describe('child users keep their per-user limits', () => {
  beforeEach(() => {
    isChildUser.mockReturnValue(true)
  })

  it('still evaluates the checks for a child user', async () => {
    await expect(accountLimitsOk(user, ['token'])).resolves.toBe(true)

    expect(revealUserPlan).toHaveBeenCalled()
    expect(memcache.pipeline).toHaveBeenCalled()
  })
})
