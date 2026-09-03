import { callbacks } from '@/lib/auth.callbacks'
import { canDoBilling } from '@/lib/billing.core'
import {
  getContextNextApiRequest,
  getContextRequest,
  getContextRequestIpAddress,
  getContextRequestUserAgent,
} from '@/lib/context.store'
import { isAllowedEmail } from '@/lib/email.validation'
import { logAudit } from '@/lib/log'
import { isChildUser } from '@/lib/user.type'

// @note the plan catalogue is read from LIMITS_CONFIG, which the test
// environment does not carry; the billing branch under test requires plans
jest.mock('@/config/limits', () => ({
  __esModule: true,

  hasPlans: true,

  PLAN_KEYS: [],

  overrides: {},

  default: {},
}))

jest.mock('@/lib/context.store', () => ({
  getContextRequest: jest.fn(),
  getContextNextApiRequest: jest.fn(),
  getContextRequestIpAddress: jest.fn(),
  getContextRequestUserAgent: jest.fn(),
}))

jest.mock('@/lib/email.validation', () => ({
  isAllowedEmail: jest.fn(),
  normalizeEmail: jest.fn((email) => email?.toLowerCase()),
}))

jest.mock('@/lib/log', () => ({
  logAudit: jest.fn(),
}))

jest.mock('@/lib/billing.core', () => ({
  canDoBilling: jest.fn(() => true),
  hasTrialed: jest.fn((user) => Boolean(user.billingSubscriptionTrialedAt)),
  userToPlan: jest.fn(() => 'free'),
  isSellable: true,
  primaryTrialPlan: 'pro',
}))

jest.mock('@/lib/user.type', () => ({
  isChildUser: jest.fn(() => false),
}))

const mockUser = {
  id: 'user-123',
  email: 'user@example.com',
  name: 'Test User',
}

const mockRequest = {
  headers: {
    'x-forwarded-for': '192.168.1.100',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  },
}

describe('Authentication Callbacks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mocks to default successful states
    isAllowedEmail.mockResolvedValue(true)
    getContextRequest.mockReturnValue(mockRequest)
    getContextNextApiRequest.mockReturnValue(null)
    getContextRequestIpAddress.mockReturnValue('192.168.1.100')
    getContextRequestUserAgent.mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    )
    logAudit.mockResolvedValue(undefined)
  })

  describe('signIn callback', () => {
    it('should return true for successful login and log audit event', async () => {
      const result = await callbacks.signIn({ user: mockUser })

      expect(result).toBe(true)
      expect(isAllowedEmail).toHaveBeenCalledWith('user@example.com')
      expect(logAudit).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        action: 'LOGIN',
        oldValues: undefined,
        newValues: {
          email: 'user@example.com',
        },
        relations: {},
        meta: {
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })
    })

    it('should return error URL for disallowed email', async () => {
      isAllowedEmail.mockResolvedValue(false)

      const result = await callbacks.signIn({ user: mockUser })

      expect(result).toBe('/signin?error=InvalidEmail')
      expect(isAllowedEmail).toHaveBeenCalledWith('user@example.com')

      // should not log audit event for failed login

      expect(logAudit).not.toHaveBeenCalled()
    })

    it('should handle user without email', async () => {
      const userWithoutEmail = { id: 'user-123', name: 'Test User' }

      const result = await callbacks.signIn({ user: userWithoutEmail })

      expect(result).toBe(true)
      expect(isAllowedEmail).not.toHaveBeenCalled()
      expect(logAudit).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        action: 'LOGIN',
        oldValues: undefined,
        newValues: {
          email: undefined,
        },
        relations: {},
        meta: {
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })
    })

    it('should handle user without ID gracefully', async () => {
      const userWithoutId = { email: 'user@example.com', name: 'Test User' }

      const result = await callbacks.signIn({ user: userWithoutId })

      expect(result).toBe(true)
      expect(isAllowedEmail).toHaveBeenCalledWith('user@example.com')

      // should not log audit event when user ID is missing
      expect(logAudit).not.toHaveBeenCalled()
    })

    it('should log audit event with NextAPI request when context request is not available', async () => {
      getContextRequest.mockReturnValue(null)
      getContextNextApiRequest.mockReturnValue(mockRequest)

      const result = await callbacks.signIn({ user: mockUser })

      expect(result).toBe(true)
      expect(logAudit).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        action: 'LOGIN',
        oldValues: undefined,
        newValues: {
          email: 'user@example.com',
        },
        relations: {},
        meta: {
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })
    })

    it('should handle missing IP address gracefully', async () => {
      getContextRequestIpAddress.mockReturnValue(null)

      const result = await callbacks.signIn({ user: mockUser })

      expect(result).toBe(true)
      expect(logAudit).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        action: 'LOGIN',
        oldValues: undefined,
        newValues: {
          email: 'user@example.com',
        },
        relations: {},
        meta: {
          ipAddress: null,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })
    })

    it('should handle missing user agent gracefully', async () => {
      getContextRequestUserAgent.mockReturnValue(null)

      const result = await callbacks.signIn({ user: mockUser })

      expect(result).toBe(true)
      expect(logAudit).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        action: 'LOGIN',
        oldValues: undefined,
        newValues: {
          email: 'user@example.com',
        },
        relations: {},
        meta: {
          ipAddress: '192.168.1.100',
          userAgent: null,
        },
      })
    })

    it('should continue with login if audit logging fails', async () => {
      logAudit.mockRejectedValue(new Error('Audit logging failed'))

      const result = await callbacks.signIn({ user: mockUser })

      expect(result).toBe(true)
      expect(logAudit).toHaveBeenCalled()
    })

    it('should handle IPv6 addresses', async () => {
      getContextRequestIpAddress.mockReturnValue(
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      )

      const result = await callbacks.signIn({ user: mockUser })

      expect(result).toBe(true)
      expect(logAudit).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        action: 'LOGIN',
        oldValues: undefined,
        newValues: {
          email: 'user@example.com',
        },
        relations: {},
        meta: {
          ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })
    })

    it('should handle mobile user agents', async () => {
      getContextRequestUserAgent.mockReturnValue(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
      )

      const result = await callbacks.signIn({ user: mockUser })

      expect(result).toBe(true)
      expect(logAudit).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        action: 'LOGIN',
        oldValues: undefined,
        newValues: {
          email: 'user@example.com',
        },
        relations: {},
        meta: {
          ipAddress: '192.168.1.100',
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
        },
      })
    })
  })

  describe('redirect callback', () => {
    it('should return relative URL path', () => {
      const result = callbacks.redirect({
        url: 'https://example.com/dashboard?tab=bots',
        baseUrl: 'https://example.com',
      })

      expect(result).toBe('/dashboard?tab=bots')
    })

    it('should handle different base URLs', () => {
      const result = callbacks.redirect({
        url: 'https://api.example.com/admin',
        baseUrl: 'https://api.example.com',
      })

      expect(result).toBe('/admin')
    })
  })

  describe('jwt callback', () => {
    it('should throw error as it is not used', async () => {
      await expect(
        callbacks.jwt({ user: mockUser, token: {} })
      ).rejects.toThrow('This method is not used')
    })
  })

  describe('session callback', () => {
    it('should not include partner object and should preserve parent context display fields', async () => {
      isChildUser.mockReturnValue(true)

      const user = {
        id: 'user-123',
        email: 'parent+child@example.com',
        image: 'https://example.com/image.png',
        parentId: 'acme',
        parentContextName: 'QSBX User',
        parentContextEmail: 'alias@acme.dev',
        meta: {},
      }

      const result = await callbacks.session({
        user,
        token: {},
        session: {},
      })

      expect(result.partner).toBeUndefined()
      expect(result.user.displayName).toBe('QSBX User')
      expect(result.user.displayEmail).toBe('alias@acme.dev')
    })

    it('should offer a trial to a user who has never trialed', async () => {
      // @note one field does two things: presence means a trial is available
      // to this user, and the value is the plan the trial runs on
      const result = await callbacks.session({
        user: mockUser,
        token: {},
        session: {},
      })

      expect(result.billing.trialPlan).toBe('pro')
    })

    it('should not offer a trial to a user who has already trialed', async () => {
      // @note a trial is a once per account offer - checkout silently drops it
      // for a repeat trialer, so the pitch must not promise one

      const user = {
        ...mockUser,
        billingSubscriptionTrialedAt: new Date('2026-01-01'),
      }

      const result = await callbacks.session({ user, token: {}, session: {} })

      expect(result.billing.trialPlan).toBeUndefined()
    })

    it('should not offer a trial to a user who cannot do billing', async () => {
      canDoBilling.mockReturnValue(false)

      const result = await callbacks.session({
        user: mockUser,
        token: {},
        session: {},
      })

      expect(result.billing.trialPlan).toBeUndefined()
    })

    it('should set parentId on session.user when user has a parentId', async () => {
      const user = {
        ...mockUser,
        parentId: 'parent-456',
      }

      const result = await callbacks.session({ user, token: {}, session: {} })

      expect(result.user.parentId).toBe('parent-456')
    })

    it('should set parentId to null on session.user when user has no parentId', async () => {
      // @note null, never undefined - the session user is a loaded row, and
      // plan resolution reads undefined parentId as "not loaded, re-fetch"
      const result = await callbacks.session({
        user: mockUser,
        token: {},
        session: {},
      })

      expect(result.user.parentId).toBeNull()
    })

    it('should set parentId to null on session.user when user.parentId is null', async () => {
      const user = { ...mockUser, parentId: null }

      const result = await callbacks.session({ user, token: {}, session: {} })

      expect(result.user.parentId).toBeNull()
    })
  })
})
