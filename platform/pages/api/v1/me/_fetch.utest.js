/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './fetch'

import { createMocks } from 'node-mocks-http'

// @note the plan catalogue is read from LIMITS_CONFIG, which the test
// environment does not carry; the plan field is served only when plans exist
jest.mock('@/config/limits', () => ({
  ...jest.requireActual('@/config/limits'),

  hasPlans: true,
}))

jest.mock('@/lib/user.plan', () => ({
  revealUserPlan: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => async (req, session) => {
    const result = await fn(req, session)

    return result
  },
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => data,
}))

describe('GET /api/v1/me/fetch', () => {
  const { revealUserPlan } = require('@/lib/user.plan')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return user name, email, and plan', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      })

      const mockSession = {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      }

      revealUserPlan.mockResolvedValue({
        plan: 'pro',
      })

      const result = await handler(req, mockSession)

      expect(result).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        plan: 'pro',
      })
    })

    it('should call revealUserPlan with session user', async () => {
      const { req } = createMocks({
        method: 'GET',
      })

      const mockSession = {
        user: {
          id: 'user-123',
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
      }

      revealUserPlan.mockResolvedValue({
        plan: 'free',
      })

      await handler(req, mockSession)

      expect(revealUserPlan).toHaveBeenCalledWith(mockSession.user)
      expect(revealUserPlan).toHaveBeenCalledTimes(1)
    })
  })

  describe('different plans', () => {
    it('should return free plan', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      })

      const mockSession = {
        user: {
          name: 'Free User',
          email: 'free@example.com',
        },
      }

      revealUserPlan.mockResolvedValue({
        plan: 'free',
      })

      const result = await handler(req, mockSession)

      expect(result.plan).toBe('free')
    })

    it('should return pro plan', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      })

      const mockSession = {
        user: {
          name: 'Pro User',
          email: 'pro@example.com',
        },
      }

      revealUserPlan.mockResolvedValue({
        plan: 'pro',
      })

      const result = await handler(req, mockSession)

      expect(result.plan).toBe('pro')
    })

    it('should return enterprise plan', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      })

      const mockSession = {
        user: {
          name: 'Enterprise User',
          email: 'enterprise@example.com',
        },
      }

      revealUserPlan.mockResolvedValue({
        plan: 'enterprise',
      })

      const result = await handler(req, mockSession)

      expect(result.plan).toBe('enterprise')
    })
  })

  describe('edge cases', () => {
    it('should handle empty user name', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      })

      const mockSession = {
        user: {
          name: '',
          email: 'user@example.com',
        },
      }

      revealUserPlan.mockResolvedValue({
        plan: 'free',
      })

      const result = await handler(req, mockSession)

      expect(result.name).toBe('')
      expect(result.email).toBe('user@example.com')
    })

    it('should handle null plan result', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      })

      const mockSession = {
        user: {
          name: 'Test User',
          email: 'test@example.com',
        },
      }

      revealUserPlan.mockResolvedValue({
        plan: null,
      })

      const result = await handler(req, mockSession)

      expect(result.plan).toBeNull()
    })

    it('should handle special characters in name and email', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      })

      const mockSession = {
        user: {
          name: "O'Connor-Smith",
          email: 'user+test@example.co.uk',
        },
      }

      revealUserPlan.mockResolvedValue({
        plan: 'pro',
      })

      const result = await handler(req, mockSession)

      expect(result.name).toBe("O'Connor-Smith")
      expect(result.email).toBe('user+test@example.co.uk')
    })
  })

  describe('error handling', () => {
    it('should propagate errors from revealUserPlan', async () => {
      const { req } = createMocks({
        method: 'GET',
      })

      const mockSession = {
        user: {
          name: 'Test User',
          email: 'test@example.com',
        },
      }

      revealUserPlan.mockRejectedValue(new Error('Database error'))

      await expect(handler(req, mockSession)).rejects.toThrow('Database error')
    })
  })
})
