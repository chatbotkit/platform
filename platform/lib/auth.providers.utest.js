/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { TRUSTED_SIGNIN_PROVIDER_ID } from '@/lib/auth.trusted.consts'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/notify', () => ({
  notifyEmailLogin: jest.fn(),
}))

jest.mock('@/lib/webcrypto', () => ({
  generateRandomHex: jest.fn(),
}))

jest.mock('next-auth/providers/email', () => ({
  __esModule: true,
  default: jest.fn((config) => ({ id: 'email', ...config })),
}))

jest.mock('next-auth/providers/google', () => ({
  __esModule: true,
  default: jest.fn((config) => ({ id: 'google', ...config })),
}))

jest.mock('next-auth/providers/github', () => ({
  __esModule: true,
  default: jest.fn((config) => ({ id: 'github', ...config })),
}))

jest.mock('next-auth/providers/azure-ad', () => ({
  __esModule: true,
  default: jest.fn((config) => ({ id: 'azure-ad', ...config })),
}))

describe('auth.providers', () => {
  let notifyEmailLogin
  let generateRandomHex

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
    notifyEmailLogin = require('@/lib/notify').notifyEmailLogin
    generateRandomHex = require('@/lib/webcrypto').generateRandomHex
  })

  describe('providers array', () => {
    it('should always include email provider', () => {
      const { providers } = require('./auth.providers')
      const emailProvider = providers.find((p) => p.id === 'email')

      expect(emailProvider).toBeDefined()
    })
  })

  describe('EmailProvider configuration', () => {
    let emailProvider

    beforeEach(() => {
      jest.resetModules()

      const { providers } = require('./auth.providers')

      emailProvider = providers.find((p) => p.id === 'email')
    })

    it('should have correct maxAge setting', () => {
      expect(emailProvider.maxAge).toBe(900)
    })

    it('should have generateVerificationToken function', () => {
      expect(emailProvider.generateVerificationToken).toBeDefined()
      expect(typeof emailProvider.generateVerificationToken).toBe('function')
    })

    it('should have sendVerificationRequest function', () => {
      expect(emailProvider.sendVerificationRequest).toBeDefined()
      expect(typeof emailProvider.sendVerificationRequest).toBe('function')
    })
  })

  describe('EmailProvider.generateVerificationToken', () => {
    let emailProvider

    beforeEach(() => {
      jest.resetModules()
      generateRandomHex = require('@/lib/webcrypto').generateRandomHex

      const { providers } = require('./auth.providers')

      emailProvider = providers.find((p) => p.id === 'email')
    })

    it('should generate random hex token', async () => {
      generateRandomHex.mockReturnValue('abc123')

      const token = await emailProvider.generateVerificationToken()

      expect(generateRandomHex).toHaveBeenCalledWith(6)
      expect(token).toBe('abc123')
    })

    it('should return different tokens on multiple calls', async () => {
      generateRandomHex
        .mockReturnValueOnce('token1')
        .mockReturnValueOnce('token2')

      const token1 = await emailProvider.generateVerificationToken()
      const token2 = await emailProvider.generateVerificationToken()

      expect(token1).toBe('token1')
      expect(token2).toBe('token2')
    })
  })

  describe('EmailProvider.sendVerificationRequest', () => {
    let emailProvider

    beforeEach(() => {
      jest.resetModules()

      // Re-setup mocks after resetModules
      jest.doMock('@/prisma/client', () => ({
        __esModule: true,
        default: mockDeep(),
      }))

      notifyEmailLogin = require('@/lib/notify').notifyEmailLogin
      notifyEmailLogin.mockResolvedValue(undefined)

      const mockPrisma = require('@/prisma/client').default

      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { providers } = require('./auth.providers')

      emailProvider = providers.find((p) => p.id === 'email')
    })

    it('should query user from database', async () => {
      const mockUser = { id: 'user1', email: 'test@example.com' }
      const mockPrisma = require('@/prisma/client').default

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      await emailProvider.sendVerificationRequest({
        identifier: 'test@example.com',
        url: 'https://example.com/auth/callback?token=abc123',
        token: 'abc123',
      })

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
        },
      })
    })

    it('should send email to existing user', async () => {
      const mockUser = { id: 'user1', email: 'test@example.com' }
      const mockPrisma = require('@/prisma/client').default

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      await emailProvider.sendVerificationRequest({
        identifier: 'test@example.com',
        url: 'https://example.com/auth/callback?token=abc123',
        token: 'abc123',
      })

      expect(notifyEmailLogin).toHaveBeenCalledWith(mockUser, {
        token: 'abc123',
      })
    })

    it('should send email to non-existing user with identifier', async () => {
      const mockPrisma = require('@/prisma/client').default

      mockPrisma.user.findUnique.mockResolvedValue(null)

      await emailProvider.sendVerificationRequest({
        identifier: 'newuser@example.com',
        url: 'https://example.com/auth/callback?token=xyz789',
        token: 'xyz789',
      })

      expect(notifyEmailLogin).toHaveBeenCalledWith(
        { id: 'newuser@example.com', email: 'newuser@example.com' },
        {
          token: 'xyz789',
        }
      )
    })

    it('should not send a verification code to a disallowed (disposable) email', async () => {
      const mockPrisma = require('@/prisma/client').default

      mockPrisma.user.findUnique.mockResolvedValue(null)

      await emailProvider.sendVerificationRequest({
        identifier: 'spam@throwawaymail.com',
        url: 'https://example.com/auth/callback?token=abc123',
        token: 'abc123',
      })

      expect(notifyEmailLogin).not.toHaveBeenCalled()
    })

    it('should not send a verification code to a throwaway-looking local part', async () => {
      const mockPrisma = require('@/prisma/client').default

      mockPrisma.user.findUnique.mockResolvedValue(null)

      await emailProvider.sendVerificationRequest({
        identifier: 'qwv8trzk3lmn@example.com',
        url: 'https://example.com/auth/callback?token=abc123',
        token: 'abc123',
      })

      expect(notifyEmailLogin).not.toHaveBeenCalled()
    })

    it('should skip sending email when SKIP_VERIFICATION_REQUEST is set', async () => {
      process.env.SKIP_VERIFICATION_REQUEST = 'true'

      const mockUser = { id: 'user1', email: 'test@example.com' }
      const mockPrisma = require('@/prisma/client').default

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      await emailProvider.sendVerificationRequest({
        identifier: 'test@example.com',
        url: 'https://example.com/auth/callback?token=abc123',
        token: 'abc123',
      })

      expect(notifyEmailLogin).not.toHaveBeenCalled()
      delete process.env.SKIP_VERIFICATION_REQUEST
    })
  })
})

describe('auth.providers trusted sign-in', () => {
  function loadWith(env) {
    let mod

    jest.isolateModules(() => {
      const keys = [
        'NEXTAUTH_TRUSTED_SIGNIN',
        'TARGET_ENV',
        'NEXTAUTH_GOOGLE_APP_ID',
        'NEXTAUTH_AZURE_AD_CLIENT_ID',
        'NEXTAUTH_GITHUB_APP_ID',
        'LIMITS_CONFIG',
      ]
      const previous = Object.fromEntries(
        keys.map((key) => [key, process.env[key]])
      )

      for (const key of keys) {
        delete process.env[key]
      }

      if (env !== undefined) {
        process.env.NEXTAUTH_TRUSTED_SIGNIN = env
      }

      try {
        mod = require('./auth.providers')
      } finally {
        for (const key of keys) {
          if (previous[key] === undefined) {
            delete process.env[key]
          } else {
            process.env[key] = previous[key]
          }
        }
      }
    })

    return mod
  }

  it('leaves the trusted provider out by default', () => {
    const ids = loadWith(undefined).providers.map((p) => p.id)

    expect(ids).not.toContain(TRUSTED_SIGNIN_PROVIDER_ID)
  })

  it('appends the trusted provider after the email provider when opted in', () => {
    const ids = loadWith('true').providers.map((p) => p.id)

    expect(ids.indexOf(TRUSTED_SIGNIN_PROVIDER_ID)).toBeGreaterThan(
      ids.indexOf('email')
    )
  })
})
