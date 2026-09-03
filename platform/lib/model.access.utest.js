import { parseAndRevealLanguageModel } from '@/lib/model.utils'
import { revealUserPlan } from '@/lib/user.plan'

import { canUseCustomModel, canUseModel } from './model.access'

// @note the plan catalogue is read from LIMITS_CONFIG, which the test
// environment does not carry, so the suite brings its own entitlement tables
jest.mock('@/config/limits', () => ({
  __esModule: true,

  hasPlans: true,

  default: {
    free: { models: { advanced: false, custom: true } },
    pro: { models: { advanced: true, custom: true } },
    locked: { models: { advanced: false, custom: false } },
  },
}))

jest.mock('@/lib/user.plan', () => ({
  revealUserPlan: jest.fn(),
}))

jest.mock('@/lib/model.utils', () => ({
  parseAndRevealLanguageModel: jest.fn(),
}))

const user = { id: 'test-user' }

beforeEach(() => {
  jest.resetAllMocks()
})

describe('canUseModel', () => {
  it('returns true if tokenRatio <= 1', async () => {
    parseAndRevealLanguageModel.mockReturnValue({
      config: { pricing: { tokenRatio: 1 } },
    })

    const result = await canUseModel(user, 'test-model')

    expect(result).toBe(true)
    expect(revealUserPlan).not.toHaveBeenCalled()
  })

  it('returns true if tokenRatio > 1 and the plan grants advanced models', async () => {
    parseAndRevealLanguageModel.mockReturnValue({
      config: { pricing: { tokenRatio: 2 } },
    })

    revealUserPlan.mockResolvedValue({ plan: 'pro' })

    const result = await canUseModel(user, 'test-model')

    expect(result).toBe(true)
    expect(revealUserPlan).toHaveBeenCalledWith(user)
  })

  it('returns false if tokenRatio > 1 and the plan does not grant advanced models', async () => {
    parseAndRevealLanguageModel.mockReturnValue({
      config: { pricing: { tokenRatio: 2 } },
    })

    revealUserPlan.mockResolvedValue({ plan: 'free' })

    const result = await canUseModel(user, 'test-model')

    expect(result).toBe(false)
  })

  it('returns false if the plan is missing from the catalogue', async () => {
    parseAndRevealLanguageModel.mockReturnValue({
      config: { pricing: { tokenRatio: 2 } },
    })

    revealUserPlan.mockResolvedValue({ plan: 'unknown' })

    const result = await canUseModel(user, 'test-model')

    expect(result).toBe(false)
  })
})

describe('canUseCustomModel', () => {
  it('returns true when the plan grants custom models', async () => {
    revealUserPlan.mockResolvedValue({ plan: 'free' })

    const result = await canUseCustomModel(user)

    expect(result).toBe(true)
    expect(revealUserPlan).toHaveBeenCalledWith(user)
  })

  it('returns false when the plan withholds custom models', async () => {
    revealUserPlan.mockResolvedValue({ plan: 'locked' })

    const result = await canUseCustomModel(user)

    expect(result).toBe(false)
  })
})
