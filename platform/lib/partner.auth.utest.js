/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import defaultAuthAdapter from '@/lib/auth.adapter'
import memcache from '@/lib/memcache'
import { notifyEmailLogin } from '@/lib/notify'
import {
  getPartnerByIdentifier,
  getPartnerSlugFromHostname,
} from '@/lib/partner.helpers'
import { generateRandomHex } from '@/lib/webcrypto'
import { getChildUserIdentityEmail } from '@/lib/user.identity'

import {
  getPartnerAuthInitialAdapter,
  getPartnerAuthInitialCallbacks,
  getPartnerAuthProviders,
} from './partner.auth'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}))

jest.mock('@/lib/partner.helpers', () => ({
  getPartnerByIdentifier: jest.fn(),
  getPartnerSlugFromHostname: jest.fn(),
  partnerToEmailBranding: jest.fn((partner) => ({
    id: partner.id,
    name: partner.name,
    logo: partner.logo,
    icon: partner.icon,
    baseUrl: partner.domain
      ? `https://${partner.domain}`
      : `https://${partner.id}.chatbotkit.partners`,
    whitelabel: partner.whitelabel,
  })),
}))

jest.mock('@/lib/notify', () => ({
  notifyEmailLogin: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  // @note SystemError is used by lib/response.js (throwNotFound etc.) so it
  // must be a real Error subclass - not just a mock function
  SystemError: class SystemError extends Error {
    constructor(message, code) {
      super(message)
      this.code = code
    }
  },
}))

const { captureError } = require('@/lib/error')

jest.mock('@/lib/auth.adapter', () => ({
  __esModule: true,
  default: {
    createUser: jest.fn(),
    createSession: jest.fn(),
    updateSession: jest.fn(),
    deleteSession: jest.fn(),
    getSessionAndUser: jest.fn(),
  },
}))

jest.mock('@/lib/auth.callbacks', () => ({
  __esModule: true,
  default: {
    signIn: jest.fn(),
  },
}))

jest.mock('@/lib/webcrypto', () => ({
  generateRandomHex: jest.fn(),
}))

jest.mock('next-auth/providers/email', () => ({
  __esModule: true,
  default: {
    default: jest.fn((options) => ({
      id: 'email',
      type: 'email',
      name: 'Email',
      options,
    })),
  },
}))

describe('partner.auth', () => {
  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
    delete process.env.SKIP_VERIFICATION_REQUEST
  })

  describe('getPartnerAuthInitialAdapter', () => {
    it('should throw not found when slug not extracted', async () => {
      getPartnerSlugFromHostname.mockReturnValue(null)

      await expect(
        getPartnerAuthInitialAdapter('invalid.example.com')
      ).rejects.toThrow('Partner not found')

      expect(getPartnerSlugFromHostname).toHaveBeenCalledWith(
        'invalid.example.com'
      )
    })

    it('should throw not found when partner not found', async () => {
      getPartnerSlugFromHostname.mockReturnValue('test-partner')
      getPartnerByIdentifier.mockResolvedValue(null)

      await expect(
        getPartnerAuthInitialAdapter('test.example.com')
      ).rejects.toThrow('Partner not found')

      expect(getPartnerByIdentifier).toHaveBeenCalledWith('test-partner')
    })

    it('should return adapter for valid partner', async () => {
      getPartnerSlugFromHostname.mockReturnValue('test-partner')
      getPartnerByIdentifier.mockResolvedValue({
        id: 'partner-id',
        slug: 'test-partner',
      })

      const adapter = await getPartnerAuthInitialAdapter('test.example.com')

      expect(adapter).toBeDefined()
      expect(adapter.getUserByEmail).toBeInstanceOf(Function)
      expect(adapter.createUser).toBeInstanceOf(Function)
      expect(adapter.updateUser).toBeInstanceOf(Function)
    })

    describe('adapter.getUserByEmail', () => {
      let adapter

      beforeEach(async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })
        adapter = await getPartnerAuthInitialAdapter('test.example.com')
      })

      it('should return null when user not found', async () => {
        prisma.user.findFirst.mockResolvedValue(null)

        const result = await adapter.getUserByEmail('user@example.com')

        expect(result).toBeNull()
        expect(prisma.user.findFirst).toHaveBeenCalledWith({
          where: {
            parentId: 'partner-id',
            OR: [
              { email: 'user@example.com' },
              { parentContextEmail: 'user@example.com' },
            ],
          },
        })
      })

      it('should find a Child User by its internal identity email', async () => {
        const identityEmail = getChildUserIdentityEmail('user-id')

        prisma.user.findFirst.mockResolvedValue({
          id: 'user-id',
          email: identityEmail,
          emailVerified: new Date(),
        })

        const result = await adapter.getUserByEmail(identityEmail)

        expect(result).toEqual({
          id: 'user-id',
          email: identityEmail,
          emailVerified: expect.any(Date),
        })
        expect(prisma.user.findFirst).toHaveBeenCalledWith({
          where: {
            parentId: 'partner-id',
            OR: [
              { email: identityEmail },
              { parentContextEmail: identityEmail },
            ],
          },
        })
      })

      it('should find a user by its customer-facing email', async () => {
        const identityEmail = getChildUserIdentityEmail('child-user-id')

        prisma.user.findFirst.mockResolvedValue({
          id: 'child-user-id',
          email: identityEmail,
          emailVerified: new Date(),
        })

        const result = await adapter.getUserByEmail('user@example.com')

        expect(result).toEqual({
          id: 'child-user-id',
          email: identityEmail,
          emailVerified: expect.any(Date),
        })
        expect(prisma.user.findFirst).toHaveBeenCalledWith({
          where: {
            parentId: 'partner-id',
            OR: [
              { email: 'user@example.com' },
              { parentContextEmail: 'user@example.com' },
            ],
          },
        })
      })

      it('should fallback to global user lookup when allowGlobalLogin is enabled', async () => {
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
          auth: {
            allowGlobalLogin: true,
          },
        })

        const localAdapter = await getPartnerAuthInitialAdapter(
          'test.example.com'
        )

        prisma.user.findFirst.mockResolvedValue(null)
        prisma.user.findUnique.mockResolvedValue({
          id: 'global-user-id',
          email: 'global@example.com',
          emailVerified: new Date(),
        })

        const result = await localAdapter.getUserByEmail('global@example.com')

        expect(result).toEqual({
          id: 'global-user-id',
          email: 'global@example.com',
          emailVerified: expect.any(Date),
        })
        expect(prisma.user.findFirst).toHaveBeenCalledWith({
          where: {
            parentId: 'partner-id',
            OR: [
              { email: 'global@example.com' },
              { parentContextEmail: 'global@example.com' },
            ],
          },
        })
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: {
            email: 'global@example.com',
          },
        })
      })
    })

    describe('adapter.createUser', () => {
      it('should throw error when allowGlobalLogin is not enabled', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        const adapter = await getPartnerAuthInitialAdapter('test.example.com')

        await expect(adapter.createUser()).rejects.toThrow(
          'User creation is not allowed'
        )
      })

      it('should delegate to defaultAuthAdapter when allowGlobalLogin is enabled', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
          auth: { allowGlobalLogin: true },
        })

        const adapter = await getPartnerAuthInitialAdapter('test.example.com')

        const newUser = {
          id: 'new-user-id',
          email: 'new@example.com',
          emailVerified: null,
        }

        defaultAuthAdapter.createUser.mockResolvedValue(newUser)

        const result = await adapter.createUser(newUser)

        expect(result).toEqual(newUser)
        expect(defaultAuthAdapter.createUser).toHaveBeenCalledWith(newUser)
      })
    })

    describe('adapter.updateUser', () => {
      it('should return user data', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        const adapter = await getPartnerAuthInitialAdapter('test.example.com')

        const result = await adapter.updateUser({
          id: 'user-id',
          email: 'user@example.com',
          emailVerified: new Date(),
        })

        expect(result).toEqual({
          id: 'user-id',
          email: 'user@example.com',
          emailVerified: expect.any(Date),
        })
      })
    })

    describe('adapter.deleteUser', () => {
      it('should throw error', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        const adapter = await getPartnerAuthInitialAdapter('test.example.com')

        await expect(adapter.deleteUser()).rejects.toThrow(
          'User deletion is not allowed'
        )
      })
    })

    describe('adapter.createSession', () => {
      it('should delegate to default adapter', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        const adapter = await getPartnerAuthInitialAdapter('test.example.com')

        const sessionData = {
          sessionToken: 'token',
          userId: 'user-id',
          expires: new Date(),
        }

        defaultAuthAdapter.createSession.mockResolvedValue(sessionData)

        const result = await adapter.createSession(sessionData)

        expect(result).toEqual(sessionData)
        expect(defaultAuthAdapter.createSession).toHaveBeenCalledWith(
          sessionData
        )
      })

      it('should return null when default adapter returns falsy', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        const adapter = await getPartnerAuthInitialAdapter('test.example.com')

        defaultAuthAdapter.createSession.mockResolvedValue(null)

        const result = await adapter.createSession({})

        expect(result).toBeNull()
      })
    })

    describe('adapter.updateSession', () => {
      it('should delegate to default adapter', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        const adapter = await getPartnerAuthInitialAdapter('test.example.com')

        const sessionData = {
          sessionToken: 'token',
          expires: new Date(),
        }

        defaultAuthAdapter.updateSession.mockResolvedValue(sessionData)

        const result = await adapter.updateSession(sessionData)

        expect(result).toEqual(sessionData)
        expect(defaultAuthAdapter.updateSession).toHaveBeenCalledWith(
          sessionData
        )
      })
    })

    describe('adapter.deleteSession', () => {
      it('should delegate to default adapter', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        const adapter = await getPartnerAuthInitialAdapter('test.example.com')

        defaultAuthAdapter.deleteSession.mockResolvedValue({})

        const result = await adapter.deleteSession('session-token')

        expect(defaultAuthAdapter.deleteSession).toHaveBeenCalledWith(
          'session-token'
        )
      })
    })

    describe('adapter.getSessionAndUser', () => {
      it('should delegate to default adapter', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        const adapter = await getPartnerAuthInitialAdapter('test.example.com')

        const sessionAndUser = {
          session: { sessionToken: 'token' },
          user: { id: 'user-id' },
        }

        defaultAuthAdapter.getSessionAndUser.mockResolvedValue(sessionAndUser)

        const result = await adapter.getSessionAndUser('session-token')

        expect(result).toEqual(sessionAndUser)
        expect(defaultAuthAdapter.getSessionAndUser).toHaveBeenCalledWith(
          'session-token'
        )
      })
    })

    describe('adapter.createVerificationToken', () => {
      it('should store token in redis', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        const adapter = await getPartnerAuthInitialAdapter('test.example.com')

        const expiresAt = new Date(Date.now() + 900000)

        const verificationToken = {
          identifier: 'user@example.com',
          token: 'abc123',
          expires: expiresAt,
        }

        memcache.set.mockResolvedValue('OK')

        const result = await adapter.createVerificationToken(verificationToken)

        expect(result).toEqual(verificationToken)
        expect(memcache.set).toHaveBeenCalledWith(
          'partner:partner-id:verificationToken:abc123',
          verificationToken,
          {
            ex: expect.any(Number),
          }
        )
      })
    })

    describe('adapter.useVerificationToken', () => {
      it('should throw when token not found', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        const adapter = await getPartnerAuthInitialAdapter('test.example.com')

        memcache.get.mockResolvedValue(null)

        await expect(
          adapter.useVerificationToken({
            identifier: 'user@example.com',
            token: 'invalid',
          })
        ).rejects.toThrow('Invalid token')

        expect(memcache.get).toHaveBeenCalledWith(
          'partner:partner-id:verificationToken:invalid'
        )
      })

      it('should return token and delete from cache', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        const adapter = await getPartnerAuthInitialAdapter('test.example.com')

        const expiresAt = new Date(Date.now() + 900000)

        memcache.get.mockResolvedValue({
          identifier: 'user@example.com',
          token: 'abc123',
          expires: expiresAt.toISOString(),
        })

        memcache.del.mockResolvedValue(1)

        const result = await adapter.useVerificationToken({
          identifier: 'user@example.com',
          token: 'abc123',
        })

        expect(result).toEqual({
          identifier: 'user@example.com',
          token: 'abc123',
          expires: new Date(expiresAt.toISOString()),
        })

        expect(memcache.del).toHaveBeenCalledWith(
          'partner:partner-id:verificationToken:abc123'
        )
      })
    })
  })

  describe('getPartnerAuthProviders', () => {
    it('should throw when slug not found', async () => {
      getPartnerSlugFromHostname.mockReturnValue(null)

      await expect(
        getPartnerAuthProviders('invalid.example.com')
      ).rejects.toThrow('Partner not found')
    })

    it('should throw when partner not found', async () => {
      getPartnerSlugFromHostname.mockReturnValue('test-partner')
      getPartnerByIdentifier.mockResolvedValue(null)

      await expect(getPartnerAuthProviders('test.example.com')).rejects.toThrow(
        'Partner not found'
      )
    })

    it('should return email provider', async () => {
      getPartnerSlugFromHostname.mockReturnValue('test-partner')
      getPartnerByIdentifier.mockResolvedValue({
        id: 'partner-id',
        slug: 'test-partner',
      })

      const providers = await getPartnerAuthProviders('test.example.com')

      expect(providers).toHaveLength(1)
      expect(providers[0]).toBeDefined()
    })

    describe('email provider', () => {
      it('should generate random hex token', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        generateRandomHex.mockReturnValue('abc123')

        const providers = await getPartnerAuthProviders('test.example.com')
        const emailProvider = providers[0]

        const token = await emailProvider.options.generateVerificationToken()

        expect(token).toBe('abc123')
        expect(generateRandomHex).toHaveBeenCalledWith(6)
      })

      it('should not send email when user not found and allowGlobalLogin is not set', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        prisma.user.findUnique.mockResolvedValue(null)

        const providers = await getPartnerAuthProviders('test.example.com')
        const emailProvider = providers[0]

        await emailProvider.options.sendVerificationRequest({
          identifier: 'user@example.com',
          url: 'https://test.example.com/auth/callback',
          token: 'abc123',
        })

        expect(notifyEmailLogin).not.toHaveBeenCalled()
      })

      it('should send email for new user when allowGlobalLogin is enabled and no account exists yet', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
          name: 'Test Partner',
          auth: { allowGlobalLogin: true },
        })

        // @note both the configured partner's user and global user lookups return null
        prisma.user.findUnique.mockResolvedValue(null)

        notifyEmailLogin.mockResolvedValue()

        const providers = await getPartnerAuthProviders('test.example.com')
        const emailProvider = providers[0]

        await emailProvider.options.sendVerificationRequest({
          identifier: 'new@example.com',
          url: 'https://test.example.com/auth/callback',
          token: 'abc123',
        })

        expect(notifyEmailLogin).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'new@example.com' }),
          expect.objectContaining({
            token: 'abc123',
            branding: expect.objectContaining({ id: 'partner-id' }),
          })
        )
      })

      it('should send email when user found', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
          name: 'Test Partner',
        })

        prisma.user.findUnique.mockResolvedValue({
          id: 'user-id',
          name: 'Test User',
        })

        notifyEmailLogin.mockResolvedValue()

        const providers = await getPartnerAuthProviders('test.example.com')
        const emailProvider = providers[0]

        await emailProvider.options.sendVerificationRequest({
          identifier: 'user@example.com',
          url: 'https://test.example.com/auth/callback?token=abc123',
          token: 'abc123',
        })

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: {
            parentId_parentContextEmail: {
              parentId: 'partner-id',
              parentContextEmail: 'user@example.com',
            },
          },
        })

        expect(notifyEmailLogin).toHaveBeenCalledWith(
          {
            id: 'user-id',
            name: 'Test User',
            email: 'user@example.com',
          },
          {
            token: 'abc123',
            branding: expect.objectContaining({
              id: 'partner-id',
              name: 'Test Partner',
            }),
          }
        )
      })

      it('should fallback to global user for verification request when allowGlobalLogin is enabled', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
          name: 'Test Partner',
          auth: {
            allowGlobalLogin: true,
          },
        })

        prisma.user.findUnique
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'global-user-id',
            name: 'Global User',
          })

        notifyEmailLogin.mockResolvedValue()

        const providers = await getPartnerAuthProviders('test.example.com')
        const emailProvider = providers[0]

        await emailProvider.options.sendVerificationRequest({
          identifier: 'global@example.com',
          url: 'https://test.example.com/auth/callback?token=abc123',
          token: 'abc123',
        })

        expect(prisma.user.findUnique).toHaveBeenNthCalledWith(1, {
          where: {
            parentId_parentContextEmail: {
              parentId: 'partner-id',
              parentContextEmail: 'global@example.com',
            },
          },
        })
        expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, {
          where: {
            email: 'global@example.com',
          },
        })

        expect(notifyEmailLogin).toHaveBeenCalledWith(
          {
            id: 'global-user-id',
            name: 'Global User',
            email: 'global@example.com',
          },
          {
            token: 'abc123',
            branding: expect.objectContaining({
              id: 'partner-id',
              name: 'Test Partner',
            }),
          }
        )
      })

      it('should skip email when SKIP_VERIFICATION_REQUEST is set', async () => {
        process.env.SKIP_VERIFICATION_REQUEST = '1'

        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
        })

        prisma.user.findUnique.mockResolvedValue({
          id: 'user-id',
          name: 'Test User',
        })

        const providers = await getPartnerAuthProviders('test.example.com')
        const emailProvider = providers[0]

        await emailProvider.options.sendVerificationRequest({
          identifier: 'user@example.com',
          url: 'https://test.example.com/auth/callback?token=abc123',
          token: 'abc123',
        })

        expect(notifyEmailLogin).not.toHaveBeenCalled()
      })

      it("should pass the partner's own transport to notifyEmailLogin", async () => {
        // @note the transport is the partner's, not the platform's: the
        // catalogue carries the implementation that sends as the partner's
        // identity, so this only has to hand it over untouched

        const transport = { send: jest.fn() }

        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
          name: 'Test Partner',
          email: transport,
        })

        prisma.user.findUnique.mockResolvedValue({
          id: 'user-id',
          name: 'Test User',
        })

        notifyEmailLogin.mockResolvedValue()

        const providers = await getPartnerAuthProviders('test.example.com')
        const emailProvider = providers[0]

        await emailProvider.options.sendVerificationRequest({
          identifier: 'user@example.com',
          url: 'https://test.example.com/auth/callback?token=abc123',
          token: 'abc123',
        })

        expect(notifyEmailLogin).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'user@example.com' }),
          expect.objectContaining({
            transport,
            branding: expect.objectContaining({ id: 'partner-id' }),
          })
        )
      })

      it('should pass no transport to notifyEmailLogin when the partner has no email of its own', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
          name: 'Test Partner',
        })

        prisma.user.findUnique.mockResolvedValue({
          id: 'user-id',
          name: 'Test User',
        })

        notifyEmailLogin.mockResolvedValue()

        const providers = await getPartnerAuthProviders('test.example.com')
        const emailProvider = providers[0]

        await emailProvider.options.sendVerificationRequest({
          identifier: 'user@example.com',
          url: 'https://test.example.com/auth/callback?token=abc123',
          token: 'abc123',
        })

        expect(notifyEmailLogin).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'user@example.com' }),
          expect.objectContaining({ transport: undefined })
        )
      })

      it('should capture error and not propagate when notifyEmailLogin throws', async () => {
        getPartnerSlugFromHostname.mockReturnValue('test-partner')
        getPartnerByIdentifier.mockResolvedValue({
          id: 'partner-id',
          slug: 'test-partner',
          name: 'Test Partner',
        })

        prisma.user.findUnique.mockResolvedValue({
          id: 'user-id',
          name: 'Test User',
        })

        const emailError = new Error('email send failed')

        notifyEmailLogin.mockRejectedValue(emailError)

        const providers = await getPartnerAuthProviders('test.example.com')
        const emailProvider = providers[0]

        // @note should not throw despite notifyEmailLogin failing
        await emailProvider.options.sendVerificationRequest({
          identifier: 'user@example.com',
          url: 'https://test.example.com/auth/callback?token=abc123',
          token: 'abc123',
        })

        expect(captureError).toHaveBeenCalledWith(emailError)
      })
    })
  })

  describe('getPartnerAuthInitialCallbacks', () => {
    it('should return callbacks with signIn override', async () => {
      getPartnerSlugFromHostname.mockReturnValue('test-partner')
      getPartnerByIdentifier.mockResolvedValue({
        id: 'partner-id',
        slug: 'test-partner',
      })

      const callbacks = await getPartnerAuthInitialCallbacks('test.example.com')

      expect(callbacks).toBeDefined()
      expect(callbacks.signIn).toBeInstanceOf(Function)
    })

    it('should always return true for signIn', async () => {
      getPartnerSlugFromHostname.mockReturnValue('test-partner')
      getPartnerByIdentifier.mockResolvedValue({
        id: 'partner-id',
        slug: 'test-partner',
      })

      const callbacks = await getPartnerAuthInitialCallbacks('test.example.com')

      const result = await callbacks.signIn({
        user: { id: 'user-id', email: 'user@example.com' },
      })

      expect(result).toBe(true)
    })
  })
})
