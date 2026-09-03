/* eslint-disable @typescript-eslint/no-require-imports */
import { getAppManifestPath } from './app.router.app.manifest'

// @note the no-host fallback is the deployment's own site host, never a
// hosted literal
jest.mock('@/config/site', () => ({
  siteHostname: 'self.example',
}))

jest.mock('@/lib/context.store', () => ({
  getContextFrontendHost: jest.fn(),
  getContextRequestHost: jest.fn(),
}))

jest.mock('@/lib/app.helpers', () => ({
  isAppHostname: jest.fn(),
}))

describe('getAppManifestPath', () => {
  const {
    getContextFrontendHost,
    getContextRequestHost,
  } = require('@/lib/context.store')
  const { isAppHostname } = require('@/lib/app.helpers')

  beforeEach(() => {
    jest.clearAllMocks()
    getContextFrontendHost.mockReturnValue(null)
    getContextRequestHost.mockReturnValue(null)
  })

  describe('basic functionality', () => {
    it('should return manifest path for app hostnames', () => {
      getContextRequestHost.mockReturnValue('chat.chatbotkit.app')
      isAppHostname.mockReturnValue(true)

      const result = getAppManifestPath()

      expect(result).toBe('/app.webmanifest')
      expect(getContextRequestHost).toHaveBeenCalled()
      expect(isAppHostname).toHaveBeenCalledWith('chat.chatbotkit.app')
    })

    it('should prefer the verified frontend host from context', () => {
      getContextFrontendHost.mockReturnValue('portal.example.com')
      getContextRequestHost.mockReturnValue('internal.example.com')
      isAppHostname.mockReturnValue(true)

      expect(getAppManifestPath()).toBe('/app.webmanifest')
      expect(isAppHostname).toHaveBeenCalledWith('portal.example.com')
    })

    it('should return null for non-app hostnames', () => {
      getContextRequestHost.mockReturnValue('chatbotkit.com')
      isAppHostname.mockReturnValue(false)

      const result = getAppManifestPath()

      expect(result).toBeNull()
      expect(getContextRequestHost).toHaveBeenCalled()
      expect(isAppHostname).toHaveBeenCalledWith('chatbotkit.com')
    })

    it('should accept optional app parameter without using it', () => {
      getContextRequestHost.mockReturnValue('inbox.chatbotkit.app')
      isAppHostname.mockReturnValue(true)

      const result = getAppManifestPath('inbox')

      expect(result).toBe('/app.webmanifest')
      expect(getContextRequestHost).toHaveBeenCalled()
      expect(isAppHostname).toHaveBeenCalledWith('inbox.chatbotkit.app')
    })
  })

  describe('edge cases', () => {
    it('should use default host when request host is null', () => {
      getContextRequestHost.mockReturnValue(null)
      isAppHostname.mockReturnValue(false)

      const result = getAppManifestPath()

      expect(result).toBeNull()
      expect(getContextRequestHost).toHaveBeenCalled()
      expect(isAppHostname).toHaveBeenCalledWith('self.example')
    })

    it('should use default host when request host is undefined', () => {
      getContextRequestHost.mockReturnValue(undefined)
      isAppHostname.mockReturnValue(false)

      const result = getAppManifestPath()

      expect(result).toBeNull()
      expect(getContextRequestHost).toHaveBeenCalled()
      expect(isAppHostname).toHaveBeenCalledWith('self.example')
    })

    it('should handle an empty request host', () => {
      getContextRequestHost.mockReturnValue('')
      isAppHostname.mockReturnValue(false)

      const result = getAppManifestPath()

      expect(result).toBeNull()
      expect(getContextRequestHost).toHaveBeenCalled()
      expect(isAppHostname).toHaveBeenCalledWith('self.example')
    })
  })

  describe('various app subdomains', () => {
    it('should return manifest path for connect subdomain', () => {
      getContextRequestHost.mockReturnValue('connect.chatbotkit.app')
      isAppHostname.mockReturnValue(true)

      const result = getAppManifestPath()

      expect(result).toBe('/app.webmanifest')
    })

    it('should return manifest path for task subdomain', () => {
      getContextRequestHost.mockReturnValue('task.chatbotkit.app')
      isAppHostname.mockReturnValue(true)

      const result = getAppManifestPath()

      expect(result).toBe('/app.webmanifest')
    })

    it('should return null for main domain', () => {
      getContextRequestHost.mockReturnValue('www.chatbotkit.com')
      isAppHostname.mockReturnValue(false)

      const result = getAppManifestPath()

      expect(result).toBeNull()
    })
  })
})
