import { merge } from '@/lib/object'
import { getUserDisplayLimits } from '@/lib/limit.core'
import { revealUserPlan } from '@/lib/user.plan'

jest.mock('@/config/limits', () => ({
  __esModule: true,

  PLAN_KEYS: ['free', 'pro', 'enterprise'],

  default: {
    free: {
      maxBots: 1,
      maxConversations: 10,
      maxMessages: 100,
    },
    pro: {
      maxBots: 10,
      maxConversations: 100,
      maxMessages: 1000,
    },
    enterprise: {
      maxBots: -1,
      maxConversations: -1,
      maxMessages: -1,
    },
  },

  overrides: {
    'user-override-123': {
      limits: {
        maxBots: 5,
        maxMessages: 500,
      },
    },
    'override@example.com': {
      limits: {
        maxConversations: 50,
      },
    },
    'effective-user-456': {
      limits: {
        maxBots: 20,
      },
    },
  },
}))

jest.mock('@/lib/user.plan', () => ({
  revealUserPlan: jest.fn(),
}))

jest.mock('@/lib/object', () => ({
  merge: jest.fn((...args) => Object.assign({}, ...args)),
}))

describe('getUserDisplayLimits', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return plan limits for free plan without overrides', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
      }

      revealUserPlan.mockResolvedValue({
        plan: 'free',
        effectiveUser: user,
      })

      const result = await getUserDisplayLimits(user)

      expect(result).toEqual({
        maxBots: 1,
        maxConversations: 10,
        maxMessages: 100,
      })
      expect(merge).toHaveBeenCalledWith(
        { maxBots: 1, maxConversations: 10, maxMessages: 100 },
        {},
        {}
      )
    })

    it('should return plan limits for pro plan without overrides', async () => {
      const user = {
        id: 'user-456',
        email: 'pro@example.com',
      }

      revealUserPlan.mockResolvedValue({
        plan: 'pro',
        effectiveUser: user,
      })

      const result = await getUserDisplayLimits(user)

      expect(result).toEqual({
        maxBots: 10,
        maxConversations: 100,
        maxMessages: 1000,
      })
    })

    it('should return plan limits for enterprise plan', async () => {
      const user = {
        id: 'user-789',
        email: 'enterprise@example.com',
      }

      revealUserPlan.mockResolvedValue({
        plan: 'enterprise',
        effectiveUser: user,
      })

      const result = await getUserDisplayLimits(user)

      expect(result).toEqual({
        maxBots: -1,
        maxConversations: -1,
        maxMessages: -1,
      })
    })
  })

  describe('user override by ID', () => {
    it('should apply user overrides when user ID matches', async () => {
      const user = {
        id: 'user-override-123',
        email: 'normal@example.com',
      }

      revealUserPlan.mockResolvedValue({
        plan: 'free',
        effectiveUser: user,
      })

      const result = await getUserDisplayLimits(user)

      // When user and effectiveUser are the same, both user and effectiveUser overrides will be the same
      expect(merge).toHaveBeenCalledWith(
        { maxBots: 1, maxConversations: 10, maxMessages: 100 },
        { maxBots: 5, maxMessages: 500 },
        { maxBots: 5, maxMessages: 500 }
      )
      expect(result).toEqual({
        maxBots: 5,
        maxConversations: 10,
        maxMessages: 500,
      })
    })
  })

  describe('user override by email', () => {
    it('should apply user overrides when email matches', async () => {
      const user = {
        id: 'user-999',
        email: 'override@example.com',
      }

      revealUserPlan.mockResolvedValue({
        plan: 'free',
        effectiveUser: user,
      })

      const result = await getUserDisplayLimits(user)

      // When user and effectiveUser are the same, both user and effectiveUser overrides will be the same
      expect(merge).toHaveBeenCalledWith(
        { maxBots: 1, maxConversations: 10, maxMessages: 100 },
        { maxConversations: 50 },
        { maxConversations: 50 }
      )
      expect(result).toEqual({
        maxBots: 1,
        maxConversations: 50,
        maxMessages: 100,
      })
    })
  })

  describe('effective user overrides', () => {
    it('should apply effective user overrides when effective user differs', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
      }

      const effectiveUser = {
        id: 'effective-user-456',
        email: 'effective@example.com',
      }

      revealUserPlan.mockResolvedValue({
        plan: 'free',
        effectiveUser: effectiveUser,
      })

      const result = await getUserDisplayLimits(user)

      expect(merge).toHaveBeenCalledWith(
        { maxBots: 1, maxConversations: 10, maxMessages: 100 },
        {},
        { maxBots: 20 }
      )
      expect(result).toEqual({
        maxBots: 20,
        maxConversations: 10,
        maxMessages: 100,
      })
    })

    it('should merge both user and effective user overrides', async () => {
      const user = {
        id: 'user-override-123',
        email: 'test@example.com',
      }

      const effectiveUser = {
        id: 'effective-user-456',
        email: 'effective@example.com',
      }

      revealUserPlan.mockResolvedValue({
        plan: 'free',
        effectiveUser: effectiveUser,
      })

      const result = await getUserDisplayLimits(user)

      expect(merge).toHaveBeenCalledWith(
        { maxBots: 1, maxConversations: 10, maxMessages: 100 },
        { maxBots: 5, maxMessages: 500 },
        { maxBots: 20 }
      )
    })
  })

  describe('override priority', () => {
    it('should prioritize ID overrides over email overrides for user', async () => {
      const user = {
        id: 'user-override-123',
        email: 'override@example.com',
      }

      revealUserPlan.mockResolvedValue({
        plan: 'free',
        effectiveUser: user,
      })

      await getUserDisplayLimits(user)

      // ID override takes priority, and same for effectiveUser since they're the same
      expect(merge).toHaveBeenCalledWith(
        { maxBots: 1, maxConversations: 10, maxMessages: 100 },
        { maxBots: 5, maxMessages: 500 },
        { maxBots: 5, maxMessages: 500 }
      )
    })

    it('should use email overrides when ID override does not exist', async () => {
      const user = {
        id: 'user-no-id-override',
        email: 'override@example.com',
      }

      revealUserPlan.mockResolvedValue({
        plan: 'free',
        effectiveUser: user,
      })

      await getUserDisplayLimits(user)

      // Email override applies, and same for effectiveUser since they're the same
      expect(merge).toHaveBeenCalledWith(
        { maxBots: 1, maxConversations: 10, maxMessages: 100 },
        { maxConversations: 50 },
        { maxConversations: 50 }
      )
    })
  })

  describe('no overrides scenario', () => {
    it('should return base plan limits when no overrides exist', async () => {
      const user = {
        id: 'user-no-overrides',
        email: 'nooverrides@example.com',
      }

      revealUserPlan.mockResolvedValue({
        plan: 'pro',
        effectiveUser: user,
      })

      const result = await getUserDisplayLimits(user)

      expect(merge).toHaveBeenCalledWith(
        { maxBots: 10, maxConversations: 100, maxMessages: 1000 },
        {},
        {}
      )
      expect(result).toEqual({
        maxBots: 10,
        maxConversations: 100,
        maxMessages: 1000,
      })
    })
  })

  describe('function dependencies', () => {
    it('should call revealUserPlan with correct user', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
      }

      revealUserPlan.mockResolvedValue({
        plan: 'free',
        effectiveUser: user,
      })

      await getUserDisplayLimits(user)

      expect(revealUserPlan).toHaveBeenCalledWith(user)
      expect(revealUserPlan).toHaveBeenCalledTimes(1)
    })

    it('should call merge with correct number of arguments', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
      }

      revealUserPlan.mockResolvedValue({
        plan: 'free',
        effectiveUser: user,
      })

      await getUserDisplayLimits(user)

      expect(merge).toHaveBeenCalledTimes(1)
      expect(merge.mock.calls[0]).toHaveLength(3)
    })
  })
})
