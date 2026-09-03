import { mockDeep } from 'jest-mock-extended'

import { redirect } from 'next/navigation'

import prisma from '@/prisma/client'

import {
  getAppConfig,
  getPublicConfig,
  getShadowConfig,
  getUserConfig,
} from '@/lib/app.config.helpers'
import {
  getAppConfigBySlug,
  getAppManifestBySlug,
  getAppSlugByHostname,
  isAppHostname,
} from '@/lib/app.helpers'
import { getSoftAppSession } from '@/lib/app.session'
import {
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import { merge, omit } from '@/lib/object'
import { getPortalGlobalConfig } from '@/lib/portal.config'
import { getPortalSlugFromHostname } from '@/lib/portal.hostname'

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,

  default: mockDeep(),
}))

jest.mock('@/prisma/types', () => ({
}))

jest.mock('@/lib/app.config.helpers', () => ({
  getAppConfig: jest.fn(),
  getPublicConfig: jest.fn(),
  getShadowConfig: jest.fn(),
  getUserConfig: jest.fn(),
}))

jest.mock('@/lib/app.helpers', () => ({
  getAppManifestBySlug: jest.fn(),
  getAppGlobalBySlug: jest.fn(),
  getAppConfigBySlug: jest.fn(),
  getAppSlugByHostname: jest.fn(),
  isAppHostname: jest.fn(),
}))

jest.mock('@/lib/app.session', () => ({
  getSoftAppSession: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  getContextFrontendHost: jest.fn(),
  getContextRequestHost: jest.fn(),
}))

jest.mock('@/lib/object', () => ({
  merge: jest.fn(),
  omit: jest.fn(),
}))

jest.mock('@/lib/portal.config', () => ({
  getPortalGlobalConfig: jest.fn(),
}))

jest.mock('@/lib/portal.hostname', () => ({
  getPortalSlugFromHostname: jest.fn(),
}))

/**
 * Dynamic imports for the source file to ensure mocks are set up first.
 *
 * We use dynamic imports instead of static imports because:
 * 1. Jest needs all mocks to be established before the source file is loaded
 * 2. Static imports would be processed immediately, causing module resolution
 *    to fail before mocks are in place
 * 3. Auto-formatting tools would move static imports to the top, breaking the solution
 *
 * This approach is robust against import reordering by formatters/linters.
 */
let getPublicAppConfig
let getUserAppConfig

beforeAll(async () => {
  const sourceModule = await import('@/lib/app.router.app.config')

  getPublicAppConfig = sourceModule.getPublicAppConfig
  getUserAppConfig = sourceModule.getUserAppConfig
})

describe('getPublicAppConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    getContextFrontendHost.mockReturnValue(null)
    getContextRequestHost.mockReturnValue(null)
    isAppHostname.mockReturnValue(false)
    getPortalSlugFromHostname.mockReturnValue(null)
    getAppSlugByHostname.mockReturnValue(null)
    getPublicConfig.mockImplementation((config) => config)
    getShadowConfig.mockImplementation((config) => config)
    merge.mockImplementation((...configs) => Object.assign({}, ...configs))
  })

  describe('portal functionality', () => {
    beforeEach(() => {
      getContextRequestHost.mockReturnValue('portal.chatbotkit.com')
      isAppHostname.mockReturnValue(true)
    })

    it('should return null when no portal slug is found', async () => {
      getPortalSlugFromHostname.mockReturnValue(null)

      const result = await getPublicAppConfig()

      expect(result).toBeNull()
      expect(getPortalSlugFromHostname).toHaveBeenCalledWith(
        'portal.chatbotkit.com'
      )
    })

    it('should return null when portal is not found in database', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue(null)

      const result = await getPublicAppConfig()

      expect(result).toBeNull()
      expect(prisma.portal.findUnique).toHaveBeenCalledWith({
        where: {
          slug: 'test-portal',
        },
        cacheStrategy: {
          ttl: 60,
          swr: 60,
        },
      })
    })

    it('should return common config when portal is valid', async () => {
      const mockPortal = {
        id: '123',
        config: { name: 'Test Portal', theme: 'dark' },
      }
      const mockGlobalConfig = { global: 'setting' }
      const mockCommonConfig = { name: 'Test Portal', theme: 'dark' }

      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue(mockPortal)
      getPortalGlobalConfig.mockReturnValue(mockGlobalConfig)
      getPublicConfig.mockReturnValue(mockCommonConfig)

      const result = await getPublicAppConfig()

      expect(result).toEqual(mockCommonConfig)
      expect(getPortalGlobalConfig).toHaveBeenCalledWith(mockPortal)
    })

    it('should use the request host when the frontend host is a custom portal domain', async () => {
      const mockPortal = {
        id: '123',
        config: { name: 'QSBX' },
      }

      getContextFrontendHost.mockReturnValue('quench.qsbx.ai')
      getContextRequestHost.mockReturnValue(
        'quench-qsbx-ai.chatbotkit.agency'
      )
      isAppHostname.mockImplementation((host) =>
        host.endsWith('.chatbotkit.agency')
      )
      getPortalSlugFromHostname.mockReturnValue('quench-qsbx-ai')
      prisma.portal.findUnique.mockResolvedValue(mockPortal)
      getPortalGlobalConfig.mockReturnValue({ name: 'QSBX' })
      getPublicConfig.mockReturnValue({ name: 'QSBX' })

      const result = await getPublicAppConfig()

      expect(result).toEqual({ name: 'QSBX' })
      expect(isAppHostname).toHaveBeenNthCalledWith(1, 'quench.qsbx.ai')
      expect(isAppHostname).toHaveBeenNthCalledWith(
        2,
        'quench-qsbx-ai.chatbotkit.agency'
      )
      expect(getPortalSlugFromHostname).toHaveBeenCalledWith(
        'quench-qsbx-ai.chatbotkit.agency'
      )
      expect(prisma.portal.findUnique).toHaveBeenCalledWith({
        where: { slug: 'quench-qsbx-ai' },
        cacheStrategy: { ttl: 60, swr: 60 },
      })
    })
  })

  describe('hosted apps functionality', () => {
    beforeEach(() => {
      getContextRequestHost.mockReturnValue('app.chatbotkit.com')
      isAppHostname.mockReturnValue(true)
      getPortalSlugFromHostname.mockReturnValue(null)
    })

    it('should return null when no app slug is found', async () => {
      getAppSlugByHostname.mockReturnValue(null)

      const result = await getPublicAppConfig()

      expect(result).toBeNull()
      expect(getAppSlugByHostname).toHaveBeenCalledWith('app.chatbotkit.com')
    })

    it('should return null when app config is not found', async () => {
      getAppSlugByHostname.mockReturnValue('test-app')
      getAppConfigBySlug.mockReturnValue(null)

      const result = await getPublicAppConfig()

      expect(result).toBeNull()
      expect(getAppConfigBySlug).toHaveBeenCalledWith('test-app')
    })

    it('should return common config when app is valid', async () => {
      const mockAppManifest = {}
      const mockAppConfig = { name: 'Test App', version: '1.0' }
      const mockCommonConfig = { name: 'Test App', version: '1.0' }

      getAppSlugByHostname.mockReturnValue('test-app')
      getAppManifestBySlug.mockReturnValue(mockAppManifest)
      getAppConfigBySlug.mockReturnValue(mockAppConfig)
      getPublicConfig.mockReturnValue(mockCommonConfig)

      const result = await getPublicAppConfig()

      expect(result).toEqual(mockCommonConfig)
      expect(getPublicConfig).toHaveBeenCalledWith(mockAppConfig)
    })
  })

  describe('dashboard functionality', () => {
    beforeEach(() => {
      getContextRequestHost.mockReturnValue('dashboard.chatbotkit.com')
      isAppHostname.mockReturnValue(false)
    })

    it('should return empty config for dashboard', async () => {
      const result = await getPublicAppConfig()

      expect(result).toEqual({})
      expect(getPortalSlugFromHostname).not.toHaveBeenCalled()
      expect(getAppSlugByHostname).not.toHaveBeenCalled()
      expect(prisma.portal.findUnique).not.toHaveBeenCalled()
    })

    it('should return empty config when no request host exists', async () => {
      getContextRequestHost.mockReturnValue(null)

      const result = await getPublicAppConfig()

      expect(result).toEqual({})
      expect(isAppHostname).not.toHaveBeenCalled()
    })

    it('should return empty config when host exists but is not app hostname', async () => {
      getContextRequestHost.mockReturnValue('some-other-domain.com')
      isAppHostname.mockReturnValue(false)

      const result = await getPublicAppConfig()

      expect(result).toEqual({})
      expect(isAppHostname).toHaveBeenCalledWith('some-other-domain.com')
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      getContextRequestHost.mockReturnValue('portal.chatbotkit.com')
      isAppHostname.mockReturnValue(true)
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockRejectedValue(new Error('Database error'))

      await expect(getPublicAppConfig()).rejects.toThrow('Database error')
    })

    it('should prioritize portal over hosted apps', async () => {
      const mockPortal = { id: '123', config: { name: 'Portal' } }

      getContextRequestHost.mockReturnValue('portal.chatbotkit.com')
      isAppHostname.mockReturnValue(true)
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      getAppSlugByHostname.mockReturnValue('test-app')
      prisma.portal.findUnique.mockResolvedValue(mockPortal)
      getPortalGlobalConfig.mockReturnValue({})
      getPublicConfig.mockReturnValue({ name: 'Portal' })

      const result = await getPublicAppConfig()

      expect(result).toEqual({ name: 'Portal' })
      expect(getAppConfigBySlug).not.toHaveBeenCalled()
    })
  })
})

describe('getUserAppConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    getContextFrontendHost.mockReturnValue(null)
    getContextRequestHost.mockReturnValue(null)
    isAppHostname.mockReturnValue(false)
    getPortalSlugFromHostname.mockReturnValue(null)
    getAppSlugByHostname.mockReturnValue(null)
    getPublicConfig.mockImplementation((config) => config)
    getShadowConfig.mockImplementation((config) => config)
    getAppConfig.mockImplementation((config, app) => config?.apps?.[app])
    getUserConfig.mockImplementation(() => null)
    merge.mockImplementation((...configs) => Object.assign({}, ...configs))
    omit.mockImplementation((obj, keys) => {
      const result = { ...obj }

      keys.forEach((key) => delete result[key])

      return result
    })
    getSoftAppSession.mockResolvedValue(null)
    redirect.mockImplementation(() => {
      throw new Error('Redirected')
    })
  })

  describe('portal functionality', () => {
    beforeEach(() => {
      getContextRequestHost.mockReturnValue('portal.chatbotkit.com')
      isAppHostname.mockReturnValue(true)
    })

    it('should redirect to signin when no portal slug is found', async () => {
      getPortalSlugFromHostname.mockReturnValue(null)

      await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
      expect(redirect).toHaveBeenCalledWith('/signin')
    })

    it('should redirect to signin when portal is not found in database', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue(null)

      await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
      expect(redirect).toHaveBeenCalledWith('/signin')
      expect(prisma.portal.findUnique).toHaveBeenCalledWith({
        where: {
          slug: 'test-portal',
        },
        cacheStrategy: {
          ttl: 60,
          swr: 60,
        },
      })
    })

    it('should redirect to signin when portal config cannot be parsed', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue({
        id: '123',
        config: { invalid: 'config' },
      })

      await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
      expect(redirect).toHaveBeenCalledWith('/signin')
    })

    it('should redirect to signin when no session', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue({
        id: '123',
        config: { name: 'Test Portal' },
      })
      getSoftAppSession.mockResolvedValue(null)

      await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
      expect(redirect).toHaveBeenCalledWith('/signin')
    })

    it('should redirect to signin when portal ID mismatch', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue({
        id: '123',
        config: { name: 'Test Portal' },
      })
      getSoftAppSession.mockResolvedValue({
        options: { portalId: '456', portalUserId: 'user-123' },
      })

      await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
      expect(redirect).toHaveBeenCalledWith('/signin')
    })

    it('should redirect to signin when user config not found', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue({
        id: '123',
        config: { name: 'Test Portal' },
      })
      getSoftAppSession.mockResolvedValue({
        options: { portalId: '123', portalUserId: 'user-123' },
      })
      getPortalGlobalConfig.mockReturnValue({})
      getUserConfig.mockReturnValue(null)

      await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
      expect(redirect).toHaveBeenCalledWith('/signin')
    })

    it('should redirect to signin when app not found in total config', async () => {
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue({
        id: '123',
        config: { name: 'Test Portal' },
      })
      getSoftAppSession.mockResolvedValue({
        options: { portalId: '123', portalUserId: 'user-123' },
      })
      getPortalGlobalConfig.mockReturnValue({})
      getUserConfig.mockReturnValue({ user: 'config' })
      merge.mockReturnValue({ name: 'Test Portal' }) // no apps property

      await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
      expect(redirect).toHaveBeenCalledWith('/signin')
    })

    it('should return merged config when everything is valid', async () => {
      const mockPortal = {
        id: '123',
        config: { name: 'Test Portal' },
      }
      const mockParsedConfig = { name: 'Test Portal' }
      const mockGlobalConfig = { global: 'setting' }
      const mockUserConfig = { user: 'config' }
      const mockTotalConfig = {
        name: 'Test Portal',
        apps: { 'test-app': { appName: 'Test App' } },
      }
      const mockAppConfig = { appName: 'Test App' }
      const mockFinalConfig = { name: 'Test Portal', appName: 'Test App' }

      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue(mockPortal)
      getSoftAppSession.mockResolvedValue({
        options: { portalId: '123', portalUserId: 'user-123' },
      })
      getPortalGlobalConfig.mockReturnValue(mockGlobalConfig)
      getUserConfig.mockReturnValue(mockUserConfig)
      merge.mockReturnValueOnce({ ...mockGlobalConfig, ...mockParsedConfig }) // combined config
      merge.mockReturnValueOnce(mockTotalConfig) // total config
      merge.mockReturnValueOnce(mockFinalConfig) // final merged config
      getAppConfig.mockReturnValue(mockAppConfig)
      getPublicConfig.mockReturnValue({ name: 'Test Portal' })
      omit.mockReturnValue({ apps: mockTotalConfig.apps })

      const result = await getUserAppConfig('test-app')

      expect(result).toEqual(mockFinalConfig)
      expect(getUserConfig).toHaveBeenCalledWith(
        { id: 'user-123', email: 'user-123' },
        { ...mockGlobalConfig, ...mockParsedConfig }
      )
      expect(getAppConfig).toHaveBeenCalledWith(mockTotalConfig, 'test-app')
    })

    it('should use the request host when the frontend host is a custom portal domain', async () => {
      const mockPortal = {
        id: '123',
        config: { apps: { chat: { save: true } } },
      }

      getContextFrontendHost.mockReturnValue('quench.qsbx.ai')
      getContextRequestHost.mockReturnValue(
        'quench-qsbx-ai.chatbotkit.agency'
      )
      isAppHostname.mockImplementation((host) =>
        host.endsWith('.chatbotkit.agency')
      )
      getPortalSlugFromHostname.mockReturnValue('quench-qsbx-ai')
      prisma.portal.findUnique.mockResolvedValue(mockPortal)
      getSoftAppSession.mockResolvedValue({
        options: { portalId: '123', portalUserId: 'user-123' },
      })
      getPortalGlobalConfig.mockReturnValue({ name: 'QSBX' })
      getUserConfig.mockReturnValue({})

      await getUserAppConfig('chat')

      expect(getPortalSlugFromHostname).toHaveBeenCalledWith(
        'quench-qsbx-ai.chatbotkit.agency'
      )
      expect(prisma.portal.findUnique).toHaveBeenCalledWith({
        where: { slug: 'quench-qsbx-ai' },
        cacheStrategy: { ttl: 60, swr: 60 },
      })
      expect(redirect).not.toHaveBeenCalled()
    })
  })

  describe('hosted apps functionality', () => {
    beforeEach(() => {
      getContextRequestHost.mockReturnValue('app.chatbotkit.com')
      isAppHostname.mockReturnValue(true)
      getPortalSlugFromHostname.mockReturnValue(null)
    })

    it('should redirect to signin when no app slug is found', async () => {
      getAppSlugByHostname.mockReturnValue(null)

      await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
      expect(redirect).toHaveBeenCalledWith('/signin')
    })

    it('should redirect to signin when app config is not found', async () => {
      getAppSlugByHostname.mockReturnValue('test-app')
      getAppConfigBySlug.mockReturnValue(null)

      await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
      expect(redirect).toHaveBeenCalledWith('/signin')
    })

    it('should redirect to signin when no session for hosted app', async () => {
      getAppSlugByHostname.mockReturnValue('test-app')
      getAppConfigBySlug.mockReturnValue({ name: 'Test App' })
      getSoftAppSession.mockResolvedValue(null)

      await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
      expect(redirect).toHaveBeenCalledWith('/signin')
    })

    it('should return config when hosted app is valid and user authenticated', async () => {
      const mockAppConfig = { name: 'Test App', version: '1.0' }

      getAppSlugByHostname.mockReturnValue('test-app')
      getAppConfigBySlug.mockReturnValue(mockAppConfig)
      getSoftAppSession.mockResolvedValue({
        user: { id: 'user-123' },
      })

      const result = await getUserAppConfig('test-app')

      expect(result).toEqual(mockAppConfig)
    })
  })

  describe('dashboard functionality', () => {
    beforeEach(() => {
      getContextRequestHost.mockReturnValue('dashboard.chatbotkit.com')
      isAppHostname.mockReturnValue(false)
    })

    it('should redirect to signin when no session for dashboard', async () => {
      getSoftAppSession.mockResolvedValue(null)

      await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
      expect(redirect).toHaveBeenCalledWith('/signin')
    })

    it('should redirect to signin when no session and no request host', async () => {
      getContextRequestHost.mockReturnValue(null)
      getSoftAppSession.mockResolvedValue(null)

      await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
      expect(redirect).toHaveBeenCalledWith('/signin')
      expect(isAppHostname).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      getContextRequestHost.mockReturnValue('portal.chatbotkit.com')
      isAppHostname.mockReturnValue(true)
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockRejectedValue(new Error('Database error'))

      await expect(getUserAppConfig('test-app')).rejects.toThrow(
        'Database error'
      )
    })

    it('should handle session errors gracefully', async () => {
      getContextRequestHost.mockReturnValue('portal.chatbotkit.com')
      isAppHostname.mockReturnValue(true)
      getPortalSlugFromHostname.mockReturnValue('test-portal')
      prisma.portal.findUnique.mockResolvedValue({
        id: '123',
        config: { name: 'Test Portal' },
      })
      getSoftAppSession.mockRejectedValue(new Error('Session error'))

      await expect(getUserAppConfig('test-app')).rejects.toThrow(
        'Session error'
      )
    })
  })

  describe('security: access control verification', () => {
    describe('cross-portal access prevention', () => {
      it('should prevent access when user session belongs to different portal', async () => {
        const targetPortal = {
          id: 'portal-123',
          config: { name: 'Target Portal' },
        }
        const userSessionFromDifferentPortal = {
          options: {
            portalId: 'different-portal-456', // different portal ID
            portalUserId: 'user-789',
          },
        }

        getContextRequestHost.mockReturnValue('target.chatbotkit.com')
        isAppHostname.mockReturnValue(true)
        getPortalSlugFromHostname.mockReturnValue('target-portal')
        prisma.portal.findUnique.mockResolvedValue(targetPortal)
        getSoftAppSession.mockResolvedValue(userSessionFromDifferentPortal)

        await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
        expect(redirect).toHaveBeenCalledWith('/signin')
      })

      it('should prevent access when session portal ID is null but portal exists', async () => {
        const targetPortal = {
          id: 'portal-123',
          config: { name: 'Target Portal' },
        }
        const sessionWithNullPortalId = {
          options: {
            portalId: null, // null portal ID
            portalUserId: 'user-789',
          },
        }

        getContextRequestHost.mockReturnValue('target.chatbotkit.com')
        isAppHostname.mockReturnValue(true)
        getPortalSlugFromHostname.mockReturnValue('target-portal')
        prisma.portal.findUnique.mockResolvedValue(targetPortal)
        getSoftAppSession.mockResolvedValue(sessionWithNullPortalId)

        await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
        expect(redirect).toHaveBeenCalledWith('/signin')
      })
    })

    describe('user configuration access control', () => {
      it('should prevent access when user is not in portal configuration at all', async () => {
        const portal = {
          id: '123',
          config: { name: 'Test Portal' },
        }
        const validSession = {
          options: { portalId: '123', portalUserId: 'unauthorized-user' },
        }

        getContextRequestHost.mockReturnValue('portal.chatbotkit.com')
        isAppHostname.mockReturnValue(true)
        getPortalSlugFromHostname.mockReturnValue('test-portal')
        prisma.portal.findUnique.mockResolvedValue(portal)
        getSoftAppSession.mockResolvedValue(validSession)
        getPortalGlobalConfig.mockReturnValue({})

        getUserConfig.mockReturnValue(null)

        await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
        expect(redirect).toHaveBeenCalledWith('/signin')
        expect(getUserConfig).toHaveBeenCalledWith(
          { id: 'unauthorized-user', email: 'unauthorized-user' },
          { name: 'Test Portal' }
        )
      })

      it('should prevent access when user exists but lacks permission for specific app', async () => {
        const portal = {
          id: '123',
          config: { name: 'Test Portal' },
        }
        const validSession = {
          options: { portalId: '123', portalUserId: 'user-123' },
        }
        const userConfigWithoutTargetApp = {
          apps: {
            'allowed-app': { setting: 'value' },
            // @note 'test-app' is NOT in this user's allowed apps
          },
        }
        const totalConfigWithoutTargetApp = {
          name: 'Test Portal',
          apps: userConfigWithoutTargetApp.apps, // only has 'allowed-app', not 'test-app'
        }

        getContextRequestHost.mockReturnValue('portal.chatbotkit.com')
        isAppHostname.mockReturnValue(true)
        getPortalSlugFromHostname.mockReturnValue('test-portal')
        prisma.portal.findUnique.mockResolvedValue(portal)
        getSoftAppSession.mockResolvedValue(validSession)
        getPortalGlobalConfig.mockReturnValue({})
        getUserConfig.mockReturnValue(userConfigWithoutTargetApp)
        merge.mockReturnValue(totalConfigWithoutTargetApp)

        await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
        expect(redirect).toHaveBeenCalledWith('/signin')
      })

      it('should allow access when user has explicit permission for the specific app', async () => {
        const portal = {
          id: '123',
          config: { name: 'Test Portal' },
        }
        const validSession = {
          options: { portalId: '123', portalUserId: 'user-123' },
        }
        const userConfigWithTargetApp = {
          apps: {
            'test-app': { setting: 'allowed' },
            'other-app': { setting: 'also-allowed' },
          },
        }
        const totalConfigWithTargetApp = {
          name: 'Test Portal',
          apps: {
            'test-app': { setting: 'allowed' },
            'other-app': { setting: 'also-allowed' },
          },
        }
        const appSpecificConfig = { setting: 'allowed' }
        const finalConfig = { name: 'Test Portal', setting: 'allowed' }

        getContextRequestHost.mockReturnValue('portal.chatbotkit.com')
        isAppHostname.mockReturnValue(true)
        getPortalSlugFromHostname.mockReturnValue('test-portal')
        prisma.portal.findUnique.mockResolvedValue(portal)
        getSoftAppSession.mockResolvedValue(validSession)
        getPortalGlobalConfig.mockReturnValue({})
        getUserConfig.mockReturnValue(userConfigWithTargetApp)
        merge.mockReturnValueOnce({ name: 'Test Portal' }) // combined config
        merge.mockReturnValueOnce(totalConfigWithTargetApp) // total config
        merge.mockReturnValueOnce(finalConfig) // final config
        getAppConfig.mockReturnValue(appSpecificConfig)
        getPublicConfig.mockReturnValue({ name: 'Test Portal' })
        omit.mockReturnValue({ apps: totalConfigWithTargetApp.apps })

        const result = await getUserAppConfig('test-app')

        expect(result).toEqual(finalConfig)
        expect(redirect).not.toHaveBeenCalled()
      })
    })

    describe('app-specific authorization scenarios', () => {
      it('should prevent access to app when user has partial config but app not in apps list', async () => {
        const portal = {
          id: '123',
          config: { name: 'Test Portal' },
        }
        const validSession = {
          options: { portalId: '123', portalUserId: 'user-123' },
        }
        const userConfigWithoutApps = {
          profile: { name: 'User Name' },
          settings: { theme: 'dark' },
          // Note: no 'apps' property at all
        }
        const totalConfigWithoutApps = {
          name: 'Test Portal',
          profile: { name: 'User Name' },
          settings: { theme: 'dark' },
          // Note: no 'apps' property
        }

        getContextRequestHost.mockReturnValue('portal.chatbotkit.com')
        isAppHostname.mockReturnValue(true)
        getPortalSlugFromHostname.mockReturnValue('test-portal')
        prisma.portal.findUnique.mockResolvedValue(portal)
        getSoftAppSession.mockResolvedValue(validSession)
        getPortalGlobalConfig.mockReturnValue({})
        getUserConfig.mockReturnValue(userConfigWithoutApps)
        merge.mockReturnValue(totalConfigWithoutApps)

        await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
        expect(redirect).toHaveBeenCalledWith('/signin')
      })

      it('should prevent access to app when apps is empty object', async () => {
        const portal = {
          id: '123',
          config: { name: 'Test Portal' },
        }
        const validSession = {
          options: { portalId: '123', portalUserId: 'user-123' },
        }
        const userConfigWithEmptyApps = {
          apps: {}, // Empty apps object
        }
        const totalConfigWithEmptyApps = {
          name: 'Test Portal',
          apps: {}, // Empty apps object
        }

        getContextRequestHost.mockReturnValue('portal.chatbotkit.com')
        isAppHostname.mockReturnValue(true)
        getPortalSlugFromHostname.mockReturnValue('test-portal')
        prisma.portal.findUnique.mockResolvedValue(portal)
        getSoftAppSession.mockResolvedValue(validSession)
        getPortalGlobalConfig.mockReturnValue({})
        getUserConfig.mockReturnValue(userConfigWithEmptyApps)
        merge.mockReturnValue(totalConfigWithEmptyApps)

        await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
        expect(redirect).toHaveBeenCalledWith('/signin')
      })
    })

    describe('session tampering prevention', () => {
      it('should prevent access when session options are malformed', async () => {
        const portal = {
          id: '123',
          config: { name: 'Test Portal' },
        }
        const malformedSession = {
          options: undefined, // Missing options entirely
        }

        getContextRequestHost.mockReturnValue('portal.chatbotkit.com')
        isAppHostname.mockReturnValue(true)
        getPortalSlugFromHostname.mockReturnValue('test-portal')
        prisma.portal.findUnique.mockResolvedValue(portal)
        getSoftAppSession.mockResolvedValue(malformedSession)

        // This should throw a TypeError due to accessing portalId on undefined options
        await expect(getUserAppConfig('test-app')).rejects.toThrow(
          'Cannot read properties of undefined'
        )
      })

      it('should prevent access when session has wrong structure', async () => {
        const portal = {
          id: '123',
          config: { name: 'Test Portal' },
        }
        const sessionWithWrongStructure = {
          options: {
            wrongField: 'should-not-work',
            // Missing portalId and portalUserId
          },
        }

        getContextRequestHost.mockReturnValue('portal.chatbotkit.com')
        isAppHostname.mockReturnValue(true)
        getPortalSlugFromHostname.mockReturnValue('test-portal')
        prisma.portal.findUnique.mockResolvedValue(portal)
        getSoftAppSession.mockResolvedValue(sessionWithWrongStructure)

        await expect(getUserAppConfig('test-app')).rejects.toThrow('Redirected')
        expect(redirect).toHaveBeenCalledWith('/signin')
      })
    })
  })
})
