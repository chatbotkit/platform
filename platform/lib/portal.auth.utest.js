/* eslint-disable @typescript-eslint/no-require-imports */
import { createEmailTransport } from '@chatbotkit-dev/email'

import {
  getPortalAuthInitialAdapter,
  getPortalAuthInitialCallbacks,
  getPortalAuthProviders,
} from '@/lib/portal.auth'

jest.mock('@/prisma/types', () => ({}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    portal: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}))

const prisma = require('@/prisma/client').default

jest.mock('@/lib/portal.hostname', () => ({
  getPortalSlugFromHostname: jest.fn(),
  isPortalRootHostname: jest.fn(),
  isPortalHostname: jest.fn(),
}))

const {
  getPortalSlugFromHostname,
  isPortalRootHostname,
  isPortalHostname,
} = require('@/lib/portal.hostname')

jest.mock('@/lib/app.config.helpers', () => ({
  userInConfig: jest.fn(),
}))

const { userInConfig } = require('@/lib/app.config.helpers')

jest.mock('@/lib/portal.config', () => ({
  getPortalGlobalConfig: jest.fn(),
}))

const { getPortalGlobalConfig } = require('@/lib/portal.config')

jest.mock('@/lib/auth.adapter', () => ({
  __esModule: true,
  default: {
    createSession: jest.fn(),
    updateSession: jest.fn(),
    deleteSession: jest.fn(),
    getSessionAndUser: jest.fn(),
  },
}))

const defaultAuthAdapter = require('@/lib/auth.adapter').default

jest.mock('@/lib/auth.callbacks', () => ({
  __esModule: true,
  default: {
    session: jest.fn(),
  },
}))

const defaultAuthCallbacks = require('@/lib/auth.callbacks').default

jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
}))

const memcache = require('@/lib/memcache').default

jest.mock('@/lib/context.store', () => ({
  getContextFrontendHost: jest.fn(),
  getContextRequestIpAddress: jest.fn(),
  getContextRequestUserAgent: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  SystemError: class SystemError extends Error {
    constructor(message, code) {
      super(message)
      this.code = code
    }
  },
}))

jest.mock('@/lib/log', () => ({
  logAudit: jest.fn(),
}))

jest.mock('@/lib/notify', () => ({
  notifyEmailLogin: jest.fn(),
}))

jest.mock('@chatbotkit-dev/email', () => ({
  createEmailTransport: jest.fn(() => ({ send: jest.fn() })),
}))

jest.mock('@/lib/domain', () => ({
  getRootDomain: jest.fn((h) => h),
}))

const { notifyEmailLogin } = require('@/lib/notify')
const { getContextFrontendHost } = require('@/lib/context.store')
const { getRootDomain } = require('@/lib/domain')

jest.mock('@/lib/webcrypto', () => ({
  generateRandomHex: jest.fn(),
}))

describe('getPortalAuthInitialAdapter', () => {
  const mockPortal = {
    id: 'portal123',
    userId: 'user123',
    slug: 'test-portal',
    config: {},
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return adapter when portal exists', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue(mockPortal)

      const adapter = await getPortalAuthInitialAdapter('test.example.com')

      expect(adapter).toBeDefined()
      expect(adapter).toHaveProperty('getUserByEmail')
      expect(adapter).toHaveProperty('createUser')
      expect(adapter).toHaveProperty('updateUser')
      expect(adapter).toHaveProperty('deleteUser')
      expect(adapter).toHaveProperty('createSession')
      expect(adapter).toHaveProperty('updateSession')
      expect(adapter).toHaveProperty('deleteSession')
      expect(adapter).toHaveProperty('getSessionAndUser')
      expect(adapter).toHaveProperty('createVerificationToken')
      expect(adapter).toHaveProperty('useVerificationToken')
    })

    it('should query portal with correct slug', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue(mockPortal)

      await getPortalAuthInitialAdapter('test.example.com')

      expect(prisma.portal.findUnique).toHaveBeenCalledWith({
        where: {
          slug: 'test-portal',
        },
      })
    })
  })

  describe('validation', () => {
    it('should throw when slug is null', async () => {
      getPortalSlugFromHostname.mockReturnValue(null)

      await expect(
        getPortalAuthInitialAdapter('invalid.example.com')
      ).rejects.toThrow('Portal not found')
    })

    it('should throw when slug contains invalid characters', async () => {
      getPortalSlugFromHostname.mockReturnValue('test@portal')

      await expect(
        getPortalAuthInitialAdapter('test.example.com')
      ).rejects.toThrow('Invalid portal slug')
    })

    it('should throw when portal does not exist', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue(null)

      await expect(
        getPortalAuthInitialAdapter('test.example.com')
      ).rejects.toThrow('Portal not found')
    })

    it('should accept valid slug formats', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal-123')
      prisma.portal.findUnique.mockResolvedValue(mockPortal)

      const adapter = await getPortalAuthInitialAdapter('test.example.com')

      expect(adapter).toBeDefined()
    })

    it('should reject slug with special characters', async () => {
      getPortalSlugFromHostname.mockReturnValue('test_portal!')

      await expect(
        getPortalAuthInitialAdapter('test.example.com')
      ).rejects.toThrow('Invalid portal slug')
    })
  })

  describe('adapter methods', () => {
    let adapter

    beforeEach(async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue(mockPortal)
      adapter = await getPortalAuthInitialAdapter('test.example.com')
    })

    describe('getUserByEmail', () => {
      it('should find user with exclamation prefix', async () => {
        const mockUser = {
          id: 'user123',
          email: 'test@example.com',
          emailVerified: new Date(),
        }

        prisma.user.findUnique.mockResolvedValue(mockUser)

        const result = await adapter.getUserByEmail('!test@example.com')

        expect(result).toEqual({
          id: 'user123',
          email: 'test@example.com',
          emailVerified: mockUser.emailVerified,
        })
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.com' },
        })
      })

      it('should return null when user not found', async () => {
        prisma.user.findUnique.mockResolvedValue(null)

        const result = await adapter.getUserByEmail('!test@example.com')

        expect(result).toBeNull()
      })

      it('should handle user in config', async () => {
        userInConfig.mockReturnValue(true)

        const mockUser = {
          id: 'user123',
          email: 'portal-owner@example.com',
          emailVerified: new Date(),
        }

        prisma.user.findUnique.mockResolvedValue(mockUser)

        const result = await adapter.getUserByEmail('config@example.com')

        expect(result).toEqual({
          id: 'user123',
          email: '!portal-owner@example.com',
          emailVerified: mockUser.emailVerified,
        })
      })

      it('should return null when user in config but not found', async () => {
        userInConfig.mockReturnValue(true)
        prisma.user.findUnique.mockResolvedValue(null)

        const result = await adapter.getUserByEmail('config@example.com')

        expect(result).toBeNull()
      })
    })

    describe('createUser', () => {
      it('should throw error', async () => {
        await expect(adapter.createUser()).rejects.toThrow(
          'User creation is not allowed'
        )
      })
    })

    describe('updateUser', () => {
      it('should return user data', async () => {
        const user = {
          id: 'user123',
          email: 'test@example.com',
          emailVerified: new Date(),
        }

        const result = await adapter.updateUser(user)

        expect(result).toEqual({
          id: 'user123',
          email: 'test@example.com',
          emailVerified: user.emailVerified,
        })
      })
    })

    describe('deleteUser', () => {
      it('should throw error', async () => {
        await expect(adapter.deleteUser()).rejects.toThrow(
          'User deletion is not allowed'
        )
      })
    })

    describe('createSession', () => {
      it('should create session with portal data', async () => {
        const mockSession = {
          sessionToken: 'token123',
          userId: 'user123',
          expires: new Date(),
        }

        const createdSession = { ...mockSession, id: 'session123' }

        defaultAuthAdapter.createSession.mockResolvedValue(createdSession)

        const result = await adapter.createSession(mockSession)

        expect(result).toEqual(createdSession)
        expect(defaultAuthAdapter.createSession).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionToken: 'token123',
            userId: 'user123',
            options: {
              portalId: 'portal123',
              portalUserId: undefined,
            },
          })
        )
      })

      it('should return null when creation fails', async () => {
        const mockSession = {
          sessionToken: 'token123',
          userId: 'user123',
          expires: new Date(),
        }

        defaultAuthAdapter.createSession.mockResolvedValue(null)

        const result = await adapter.createSession(mockSession)

        expect(result).toBeNull()
      })
    })

    describe('updateSession', () => {
      it('should update session', async () => {
        const mockSession = {
          sessionToken: 'token123',
          expires: new Date(),
        }

        const updatedSession = { ...mockSession, id: 'session123' }

        defaultAuthAdapter.updateSession.mockResolvedValue(updatedSession)

        const result = await adapter.updateSession(mockSession)

        expect(result).toEqual(updatedSession)
      })

      it('should return null when update fails', async () => {
        const mockSession = {
          sessionToken: 'token123',
          expires: new Date(),
        }

        defaultAuthAdapter.updateSession.mockResolvedValue(null)

        const result = await adapter.updateSession(mockSession)

        expect(result).toBeNull()
      })
    })

    describe('deleteSession', () => {
      it('should delete session', async () => {
        const deletedSession = { sessionToken: 'token123' }

        defaultAuthAdapter.deleteSession.mockResolvedValue(deletedSession)

        const result = await adapter.deleteSession('token123')

        expect(result).toEqual(deletedSession)
        expect(defaultAuthAdapter.deleteSession).toHaveBeenCalledWith(
          'token123'
        )
      })
    })

    describe('getSessionAndUser', () => {
      it('should get session and user', async () => {
        const sessionAndUser = {
          session: { id: 'session123' },
          user: { id: 'user123' },
        }

        defaultAuthAdapter.getSessionAndUser.mockResolvedValue(sessionAndUser)

        const result = await adapter.getSessionAndUser('token123')

        expect(result).toEqual(sessionAndUser)
        expect(defaultAuthAdapter.getSessionAndUser).toHaveBeenCalledWith(
          'token123'
        )
      })
    })

    describe('createVerificationToken', () => {
      it('should create and store verification token', async () => {
        const expires = new Date(Date.now() + 3600000)
        const verificationToken = {
          identifier: 'test@example.com',
          token: 'token123',
          expires,
        }

        memcache.set.mockResolvedValue(true)

        const result = await adapter.createVerificationToken(verificationToken)

        expect(result).toEqual(verificationToken)
        expect(memcache.set).toHaveBeenCalledWith(
          'portal:portal123:verificationToken:token123',
          verificationToken,
          expect.objectContaining({
            ex: expect.any(Number),
          })
        )
      })
    })

    describe('useVerificationToken', () => {
      it('should use and delete verification token', async () => {
        const expires = new Date(Date.now() + 3600000)
        const storedToken = {
          identifier: 'test@example.com',
          token: 'token123',
          expires: expires.toISOString(),
        }

        memcache.get.mockResolvedValue(storedToken)
        memcache.del.mockResolvedValue(true)

        const result = await adapter.useVerificationToken({
          identifier: 'test@example.com',
          token: 'token123',
        })

        expect(result.token).toBe('token123')
        expect(result.expires).toBeInstanceOf(Date)
        expect(memcache.del).toHaveBeenCalledWith(
          'portal:portal123:verificationToken:token123'
        )
      })

      it('should throw when token not found', async () => {
        memcache.get.mockResolvedValue(null)

        await expect(
          adapter.useVerificationToken({
            identifier: 'test@example.com',
            token: 'invalid',
          })
        ).rejects.toThrow('Invalid token')
      })
    })
  })

  describe('error handling', () => {
    it('should handle prisma errors gracefully', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(
        getPortalAuthInitialAdapter('test.example.com')
      ).rejects.toThrow('Portal not found')
    })
  })
})

describe('getPortalAuthProviders', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // @note EmailProvider tests require complex next-auth mocking
  // These tests verify the provider validation logic only

  describe('validation', () => {
    it('should throw when slug is null', async () => {
      getPortalSlugFromHostname.mockReturnValue(null)

      await expect(
        getPortalAuthProviders('invalid.example.com')
      ).rejects.toThrow('Portal not found')
    })

    it('should throw when slug contains invalid characters', async () => {
      getPortalSlugFromHostname.mockReturnValue('test$portal')

      await expect(getPortalAuthProviders('test.example.com')).rejects.toThrow(
        'Invalid portal slug'
      )
    })

    it('should throw when portal does not exist', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue(null)

      await expect(getPortalAuthProviders('test.example.com')).rejects.toThrow(
        'Portal not found'
      )
    })
  })

  describe('error handling', () => {
    it('should handle prisma errors', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(getPortalAuthProviders('test.example.com')).rejects.toThrow(
        'Portal not found'
      )
    })
  })

  describe('sendVerificationRequest', () => {
    const mockPortal = {
      id: 'portal123',
      userId: 'user123',
      slug: 'test-portal',
      name: 'Test Portal',
      config: {},
    }

    const mockUser = {
      id: 'user123',
      email: 'owner@example.com',
    }

    let emailProvider

    beforeEach(async () => {
      jest.clearAllMocks()

      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue(mockPortal)
      prisma.user.findUnique.mockResolvedValue(mockUser)
      userInConfig.mockReturnValue(true)
      getContextFrontendHost.mockReturnValue(null)
      notifyEmailLogin.mockResolvedValue()
      getRootDomain.mockImplementation((h) => h)
      isPortalHostname.mockReturnValue(true)

      const providers = await getPortalAuthProviders(
        'test-portal.chatbotkit.agency'
      )

      emailProvider = providers[0]
    })

    it('should create a transport for a verified custom frontend host', async () => {
      getContextFrontendHost.mockReturnValue('custom.example.com')
      getRootDomain.mockReturnValue('example.com')
      isPortalRootHostname.mockReturnValue(false)
      isPortalHostname.mockReturnValue(false)

      const mockTransport = { send: jest.fn() }

      createEmailTransport.mockReturnValue(mockTransport)

      await emailProvider.options.sendVerificationRequest({
        identifier: 'user@example.com',
        url: 'https://test-portal.chatbotkit.agency/api/auth/callback',
        token: 'abc123',
      })

      expect(getRootDomain).toHaveBeenCalledWith('custom.example.com')
      expect(isPortalHostname).toHaveBeenCalledWith('example.com')
      expect(createEmailTransport).toHaveBeenCalledWith(
        'notifications@example.com'
      )
      expect(notifyEmailLogin).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com' }),
        expect.objectContaining({ token: 'abc123', transport: mockTransport })
      )
    })

    it('should not create transport for a portal hostname', async () => {
      getRootDomain.mockReturnValue('chatbotkit.agency')
      isPortalRootHostname.mockReturnValue(false)
      isPortalHostname.mockReturnValue(true)

      await emailProvider.options.sendVerificationRequest({
        identifier: 'user@example.com',
        url: 'https://test-portal.chatbotkit.agency/api/auth/callback',
        token: 'abc123',
      })

      expect(getRootDomain).toHaveBeenCalledWith(
        'test-portal.chatbotkit.agency'
      )
      expect(isPortalHostname).toHaveBeenCalledWith('chatbotkit.agency')
      expect(createEmailTransport).not.toHaveBeenCalled()
      expect(notifyEmailLogin).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com' }),
        expect.objectContaining({ token: 'abc123', transport: undefined })
      )
    })

    it('should skip notification when SKIP_VERIFICATION_REQUEST is set', async () => {
      process.env.SKIP_VERIFICATION_REQUEST = '1'

      await emailProvider.options.sendVerificationRequest({
        identifier: 'user@example.com',
        url: 'https://custom.example.com/api/auth/callback?callbackUrl=/dashboard',
        token: 'abc123',
      })

      expect(notifyEmailLogin).not.toHaveBeenCalled()

      delete process.env.SKIP_VERIFICATION_REQUEST
    })

    it('should brand the email from the shared portal configuration', async () => {
      // @note the portal record's name is an internal label; without sidebar
      // branding the partner's shared configuration must supply the brand

      getPortalGlobalConfig.mockResolvedValue({
        name: 'QSBX',
        layout: { icon: 'https://example.com/icon.png' },
      })

      const providers = await getPortalAuthProviders(
        'test-portal.chatbotkit.agency'
      )

      await providers[0].options.sendVerificationRequest({
        identifier: 'user@example.com',
        url: 'https://test-portal.chatbotkit.agency/api/auth/callback',
        token: 'abc123',
      })

      expect(getPortalGlobalConfig).toHaveBeenCalledWith(mockPortal)
      expect(notifyEmailLogin).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com' }),
        expect.objectContaining({
          branding: expect.objectContaining({
            name: 'QSBX',
            icon: 'https://example.com/icon.png',
          }),
        })
      )
    })

    it('should prefer the portal sidebar branding over the shared configuration', async () => {
      getPortalGlobalConfig.mockResolvedValue({ name: 'QSBX' })
      prisma.portal.findUnique.mockResolvedValue({
        ...mockPortal,
        config: { layout: { sidebar: { title: 'My Portal' } } },
      })

      const providers = await getPortalAuthProviders(
        'test-portal.chatbotkit.agency'
      )

      await providers[0].options.sendVerificationRequest({
        identifier: 'user@example.com',
        url: 'https://test-portal.chatbotkit.agency/api/auth/callback',
        token: 'abc123',
      })

      expect(notifyEmailLogin).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          branding: expect.objectContaining({ name: 'My Portal' }),
        })
      )
    })

    it('should grant access through the shared portal configuration', async () => {
      const globalConfig = { users: { '@quench.ai': {} } }

      getPortalGlobalConfig.mockResolvedValue(globalConfig)
      userInConfig.mockImplementation((_user, config) => config === globalConfig)

      const providers = await getPortalAuthProviders(
        'test-portal.chatbotkit.agency'
      )

      await providers[0].options.sendVerificationRequest({
        identifier: 'user@quench.ai',
        url: 'https://test-portal.chatbotkit.agency/api/auth/callback',
        token: 'abc123',
      })

      expect(notifyEmailLogin).toHaveBeenCalled()
    })

    it('should deny access when neither configuration grants it', async () => {
      getPortalGlobalConfig.mockResolvedValue({ users: {} })
      userInConfig.mockReturnValue(false)

      const providers = await getPortalAuthProviders(
        'test-portal.chatbotkit.agency'
      )

      await providers[0].options.sendVerificationRequest({
        identifier: 'stranger@example.com',
        url: 'https://test-portal.chatbotkit.agency/api/auth/callback',
        token: 'abc123',
      })

      expect(notifyEmailLogin).not.toHaveBeenCalled()
    })
  })
})

describe('getPortalAuthInitialCallbacks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return callbacks object', async () => {
    const callbacks = await getPortalAuthInitialCallbacks('test.example.com')

    expect(callbacks).toBeDefined()
    expect(callbacks).toHaveProperty('signIn')
  })

  it('should include default callbacks', async () => {
    const callbacks = await getPortalAuthInitialCallbacks('test.example.com')

    expect(callbacks).toMatchObject(defaultAuthCallbacks)
  })

  it('should override signIn callback', async () => {
    const callbacks = await getPortalAuthInitialCallbacks('test.example.com')

    expect(callbacks.signIn).not.toBe(defaultAuthCallbacks.signIn)
  })

  it('should return true for signIn', async () => {
    const callbacks = await getPortalAuthInitialCallbacks('test.example.com')

    const result = await callbacks.signIn({})

    expect(result).toBe(true)
  })
})
