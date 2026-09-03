import {
  getLocalSessionClient,
  getSessionClient,
  getUserClient,
} from '@/lib/cbk.sdk'
import {
  getContextFrontendHost,
  getContextRequestIpAddress,
  getContextTimezone,
} from '@/lib/context.store'
import { TIMEZONE_HEADER_NAME } from '@/lib/header'
import { getInternalAssertionHeaders } from '@/lib/header.assertion'
import { getLocalAPIHostURL } from '@/lib/host'
import {
  getTemporaryUserSessionToken,
  getTemporaryUserToken,
} from '@/lib/session.temp'

import { ChatBotKit } from '@chatbotkit/sdk'

jest.mock('@/lib/context.store', () => ({
  getContextFrontendHost: jest.fn(),
  getContextRequestIpAddress: jest.fn(),
  getContextTimezone: jest.fn(),
}))

jest.mock('@/lib/header.assertion', () => ({
  getInternalAssertionHeaders: jest.fn(({ frontendHost, realIp }) =>
    frontendHost || realIp
      ? { 'x-chatbotkit-assertion-test': 'signed-context' }
      : {}
  ),
}))

jest.mock('@/lib/host', () => ({
  getLocalAPIHostURL: jest.fn(),
}))

jest.mock('@/lib/session.temp', () => ({
  getTemporaryUserToken: jest.fn(),
  getTemporaryUserSessionToken: jest.fn(),
}))

jest.mock('@chatbotkit/sdk', () => ({
  ChatBotKit: jest.fn(),
}))

const mockGetContextFrontendHost = getContextFrontendHost
const mockGetContextRequestIpAddress = getContextRequestIpAddress
const mockGetContextTimezone = getContextTimezone
const mockGetInternalAssertionHeaders = getInternalAssertionHeaders
const mockGetLocalAPIHostURL = getLocalAPIHostURL
const mockGetTemporaryUserToken = getTemporaryUserToken
const mockGetTemporarySessionToken = getTemporaryUserSessionToken
const mockChatBotKit = ChatBotKit

describe('getUserClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockGetLocalAPIHostURL.mockReturnValue('http://localhost:8080')
    mockGetContextFrontendHost.mockReturnValue(null)
    mockGetContextRequestIpAddress.mockReturnValue(null)
    mockGetContextTimezone.mockReturnValue(null)
    mockGetTemporaryUserToken.mockResolvedValue('mock-session-token')

    mockChatBotKit.mockImplementation((config) => config)
  })

  describe('basic functionality', () => {
    it('should create ChatBotKit client with minimal required parameters', async () => {
      const user = { id: 'user-123' }

      const result = await getUserClient(user)

      expect(mockGetTemporaryUserToken).toHaveBeenCalledWith('user-123')
      expect(mockGetLocalAPIHostURL).toHaveBeenCalled()
      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {},
      })
      expect(result).toEqual({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {},
      })
    })

    it('should handle HTTPS protocol correctly', async () => {
      mockGetLocalAPIHostURL.mockReturnValue('https://api.chatbotkit.com')

      const user = { id: 'user-456' }

      await getUserClient(user)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'api.chatbotkit.com',
        protocol: 'https:',
        headers: {},
      })
    })

    it('should handle localhost URLs correctly', async () => {
      mockGetLocalAPIHostURL.mockReturnValue('http://localhost:3000/api')

      const user = { id: 'user-789' }

      await getUserClient(user)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:3000',
        protocol: 'http:',
        headers: {},
      })
    })
  })

  describe('options parameter handling', () => {
    it('should merge provided options with defaults', async () => {
      const user = { id: 'user-123' }
      const options = {
        timeout: 5000,
        retries: 3,
      }

      await getUserClient(user, options)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        timeout: 5000,
        retries: 3,
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {},
      })
    })

    it('should handle options with custom headers', async () => {
      const user = { id: 'user-123' }
      const options = {
        headers: {
          'X-Custom-Header': 'custom-value',
          Authorization: 'Bearer custom-token',
        },
      }

      await getUserClient(user, options)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {
          'X-Custom-Header': 'custom-value',
          Authorization: 'Bearer custom-token',
        },
      })
    })

    it('should handle empty options object', async () => {
      const user = { id: 'user-123' }
      const options = {}

      await getUserClient(user, options)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {},
      })
    })
  })

  describe('context headers handling', () => {
    it('should include frontend host header when available', async () => {
      mockGetContextFrontendHost.mockReturnValue('frontend.example.com')

      const user = { id: 'user-123' }

      await getUserClient(user)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {
          'x-chatbotkit-assertion-test': 'signed-context',
        },
      })
    })

    it('should include timezone header when available', async () => {
      mockGetContextTimezone.mockReturnValue('America/New_York')

      const user = { id: 'user-123' }

      await getUserClient(user)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {
          [TIMEZONE_HEADER_NAME]: 'America/New_York',
        },
      })
    })

    it('should include both frontend host and timezone headers when available', async () => {
      mockGetContextFrontendHost.mockReturnValue('frontend.example.com')
      mockGetContextTimezone.mockReturnValue('Europe/London')

      const user = { id: 'user-123' }

      await getUserClient(user)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {
          'x-chatbotkit-assertion-test': 'signed-context',
          [TIMEZONE_HEADER_NAME]: 'Europe/London',
        },
      })
    })

    it('should not include undefined values in headers', async () => {
      mockGetContextFrontendHost.mockReturnValue(undefined)
      mockGetContextTimezone.mockReturnValue(null)

      const user = { id: 'user-123' }

      await getUserClient(user)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {},
      })
    })
  })

  describe('header merging with options', () => {
    it('should merge context headers with options headers', async () => {
      mockGetContextFrontendHost.mockReturnValue('frontend.example.com')
      mockGetContextTimezone.mockReturnValue('UTC')

      const user = { id: 'user-123' }
      const options = {
        headers: {
          'X-Custom-Header': 'custom-value',
          'User-Agent': 'Custom-Agent/1.0',
        },
      }

      await getUserClient(user, options)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {
          'x-chatbotkit-assertion-test': 'signed-context',
          [TIMEZONE_HEADER_NAME]: 'UTC',
          'X-Custom-Header': 'custom-value',
          'User-Agent': 'Custom-Agent/1.0',
        },
      })
    })

    it('should add the signed context after option headers', async () => {
      mockGetContextFrontendHost.mockReturnValue('frontend.example.com')

      const user = { id: 'user-123' }
      const options = {
        headers: {
          'x-chatbotkit-internal-frontend-host': 'override.example.com',
        },
      }

      await getUserClient(user, options)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {
          'x-chatbotkit-internal-frontend-host': 'override.example.com',
          'x-chatbotkit-assertion-test': 'signed-context',
        },
      })
      expect(mockGetInternalAssertionHeaders).toHaveBeenCalledWith({
        frontendHost: 'frontend.example.com',
        realIp: null,
      })
    })
  })

  describe('error handling', () => {
    it('should handle session token generation failure', async () => {
      mockGetTemporaryUserToken.mockRejectedValue(
        new Error('Session token generation failed')
      )

      const user = { id: 'user-123' }

      await expect(getUserClient(user)).rejects.toThrow(
        'Session token generation failed'
      )
    })

    it('should handle malformed URL from getLocalAPIHostURL', async () => {
      mockGetLocalAPIHostURL.mockReturnValue('invalid-url')

      const user = { id: 'user-123' }

      await expect(getUserClient(user)).rejects.toThrow('Invalid URL')
    })

    it('should handle ChatBotKit constructor failure', async () => {
      mockChatBotKit.mockImplementation(() => {
        throw new Error('ChatBotKit initialization failed')
      })

      const user = { id: 'user-123' }

      await expect(getUserClient(user)).rejects.toThrow(
        'ChatBotKit initialization failed'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty user id', async () => {
      const user = { id: '' }

      await getUserClient(user)

      expect(mockGetTemporaryUserToken).toHaveBeenCalledWith('')
    })

    it('should handle URL with port', async () => {
      mockGetLocalAPIHostURL.mockReturnValue('https://api.example.com:8443/v1')

      const user = { id: 'user-123' }

      await getUserClient(user)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'api.example.com:8443',
        protocol: 'https:',
        headers: {},
      })
    })

    it('should handle URL with path', async () => {
      mockGetLocalAPIHostURL.mockReturnValue('http://localhost:8080/api/v1')

      const user = { id: 'user-123' }

      await getUserClient(user)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {},
      })
    })

    it('should handle options with nested objects', async () => {
      const user = { id: 'user-123' }
      const options = {
        config: {
          nested: {
            value: 'test',
          },
        },
        headers: {
          'Content-Type': 'application/json',
        },
      }

      await getUserClient(user, options)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        config: {
          nested: {
            value: 'test',
          },
        },
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    })
  })

  describe('return value', () => {
    it('should return the constructed ChatBotKit instance', async () => {
      const mockInstance = {
        api: 'mock-api',
        chat: 'mock-chat',
      }

      mockChatBotKit.mockReturnValue(mockInstance)

      const user = { id: 'user-123' }

      const result = await getUserClient(user)

      expect(result).toBe(mockInstance)
    })
  })

  describe('function calls and dependencies', () => {
    it('should call all dependency functions in correct order', async () => {
      const user = { id: 'user-123' }

      await getUserClient(user)

      expect(mockGetLocalAPIHostURL).toHaveBeenCalledTimes(1)
      expect(mockGetContextFrontendHost).toHaveBeenCalledTimes(1)
      expect(mockGetContextRequestIpAddress).toHaveBeenCalledTimes(1)
      expect(mockGetContextTimezone).toHaveBeenCalledTimes(1)
      expect(mockGetInternalAssertionHeaders).toHaveBeenCalledTimes(1)
      expect(mockGetTemporaryUserToken).toHaveBeenCalledTimes(1)
      expect(mockChatBotKit).toHaveBeenCalledTimes(1)
    })

    it('should not call any functions multiple times', async () => {
      const user = { id: 'user-123' }
      const options = { timeout: 5000 }

      await getUserClient(user, options)

      expect(mockGetLocalAPIHostURL).toHaveBeenCalledTimes(1)
      expect(mockGetContextFrontendHost).toHaveBeenCalledTimes(1)
      expect(mockGetContextRequestIpAddress).toHaveBeenCalledTimes(1)
      expect(mockGetContextTimezone).toHaveBeenCalledTimes(1)
      expect(mockGetInternalAssertionHeaders).toHaveBeenCalledTimes(1)
      expect(mockGetTemporaryUserToken).toHaveBeenCalledTimes(1)
      expect(mockChatBotKit).toHaveBeenCalledTimes(1)
    })
  })
})

describe('getSessionClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockGetLocalAPIHostURL.mockReturnValue('http://localhost:8080')
    mockGetContextFrontendHost.mockReturnValue(null)
    mockGetContextRequestIpAddress.mockReturnValue(null)
    mockGetContextTimezone.mockReturnValue(null)
    mockGetTemporarySessionToken.mockResolvedValue('mock-session-token')

    mockChatBotKit.mockImplementation((config) => config)
  })

  describe('basic functionality', () => {
    it('should create ChatBotKit client with minimal required parameters', async () => {
      const session = { id: 'session-123', user: { id: 'user-123' } }

      const result = await getSessionClient(session)

      expect(mockGetTemporarySessionToken).toHaveBeenCalledWith(session)
      expect(mockGetLocalAPIHostURL).toHaveBeenCalled()
      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {},
      })
      expect(result).toEqual({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {},
      })
    })

    it('should handle HTTPS protocol correctly', async () => {
      mockGetLocalAPIHostURL.mockReturnValue('https://api.chatbotkit.com')

      const session = { id: 'session-456', user: { id: 'user-456' } }

      await getSessionClient(session)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'api.chatbotkit.com',
        protocol: 'https:',
        headers: {},
      })
    })

    it('should handle localhost URLs correctly', async () => {
      mockGetLocalAPIHostURL.mockReturnValue('http://localhost:3000/api')

      const session = { id: 'session-789', user: { id: 'user-789' } }

      await getSessionClient(session)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:3000',
        protocol: 'http:',
        headers: {},
      })
    })
  })

  describe('session parameter handling', () => {
    it('should pass entire session object to getTemporarySessionToken', async () => {
      const session = { id: 'session-abc', user: { id: 'user-abc' } }

      await getSessionClient(session)

      expect(mockGetTemporarySessionToken).toHaveBeenCalledWith(session)
    })

    it('should handle session with additional user properties', async () => {
      const session = {
        id: 'session-123',
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      }

      await getSessionClient(session)

      expect(mockGetTemporarySessionToken).toHaveBeenCalledWith(session)
    })
  })

  describe('options parameter handling', () => {
    it('should merge provided options with defaults', async () => {
      const session = { id: 'session-123', user: { id: 'user-123' } }
      const options = {
        timeout: 5000,
        retries: 3,
      }

      await getSessionClient(session, options)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        timeout: 5000,
        retries: 3,
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {},
      })
    })

    it('should handle options with custom headers', async () => {
      const session = { id: 'session-123', user: { id: 'user-123' } }
      const options = {
        headers: {
          'X-Custom-Header': 'custom-value',
          Authorization: 'Bearer custom-token',
        },
      }

      await getSessionClient(session, options)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {
          'X-Custom-Header': 'custom-value',
          Authorization: 'Bearer custom-token',
        },
      })
    })

    it('should handle empty options object', async () => {
      const session = { id: 'session-123', user: { id: 'user-123' } }
      const options = {}

      await getSessionClient(session, options)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {},
      })
    })
  })

  describe('context headers handling', () => {
    it('should include frontend host header when available', async () => {
      mockGetContextFrontendHost.mockReturnValue('frontend.example.com')

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await getSessionClient(session)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {
          'x-chatbotkit-assertion-test': 'signed-context',
        },
      })
    })

    it('should include timezone header when available', async () => {
      mockGetContextTimezone.mockReturnValue('America/New_York')

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await getSessionClient(session)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {
          [TIMEZONE_HEADER_NAME]: 'America/New_York',
        },
      })
    })

    it('should include both frontend host and timezone headers when available', async () => {
      mockGetContextFrontendHost.mockReturnValue('frontend.example.com')
      mockGetContextTimezone.mockReturnValue('Europe/London')

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await getSessionClient(session)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {
          'x-chatbotkit-assertion-test': 'signed-context',
          [TIMEZONE_HEADER_NAME]: 'Europe/London',
        },
      })
    })

    it('should not include undefined values in headers', async () => {
      mockGetContextFrontendHost.mockReturnValue(undefined)
      mockGetContextTimezone.mockReturnValue(null)

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await getSessionClient(session)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {},
      })
    })
  })

  describe('header merging with options', () => {
    it('should merge context headers with options headers', async () => {
      mockGetContextFrontendHost.mockReturnValue('frontend.example.com')
      mockGetContextTimezone.mockReturnValue('UTC')

      const session = { id: 'session-123', user: { id: 'user-123' } }
      const options = {
        headers: {
          'X-Custom-Header': 'custom-value',
          'User-Agent': 'Custom-Agent/1.0',
        },
      }

      await getSessionClient(session, options)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {
          'x-chatbotkit-assertion-test': 'signed-context',
          [TIMEZONE_HEADER_NAME]: 'UTC',
          'X-Custom-Header': 'custom-value',
          'User-Agent': 'Custom-Agent/1.0',
        },
      })
    })

    it('should add the signed context after option headers', async () => {
      mockGetContextFrontendHost.mockReturnValue('frontend.example.com')

      const session = { id: 'session-123', user: { id: 'user-123' } }
      const options = {
        headers: {
          'x-chatbotkit-internal-frontend-host': 'override.example.com',
        },
      }

      await getSessionClient(session, options)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {
          'x-chatbotkit-internal-frontend-host': 'override.example.com',
          'x-chatbotkit-assertion-test': 'signed-context',
        },
      })
    })
  })

  describe('error handling', () => {
    it('should handle session token generation failure', async () => {
      mockGetTemporarySessionToken.mockRejectedValue(
        new Error('Session token generation failed')
      )

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await expect(getSessionClient(session)).rejects.toThrow(
        'Session token generation failed'
      )
    })

    it('should handle malformed URL from getLocalAPIHostURL', async () => {
      mockGetLocalAPIHostURL.mockReturnValue('invalid-url')

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await expect(getSessionClient(session)).rejects.toThrow('Invalid URL')
    })

    it('should handle ChatBotKit constructor failure', async () => {
      mockChatBotKit.mockImplementation(() => {
        throw new Error('ChatBotKit initialization failed')
      })

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await expect(getSessionClient(session)).rejects.toThrow(
        'ChatBotKit initialization failed'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty session id', async () => {
      const session = { id: '', user: { id: 'user-123' } }

      await getSessionClient(session)

      expect(mockGetTemporarySessionToken).toHaveBeenCalledWith(session)
    })

    it('should handle empty user id', async () => {
      const session = { id: 'session-123', user: { id: '' } }

      await getSessionClient(session)

      expect(mockGetTemporarySessionToken).toHaveBeenCalledWith(session)
    })

    it('should handle URL with port', async () => {
      mockGetLocalAPIHostURL.mockReturnValue('https://api.example.com:8443/v1')

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await getSessionClient(session)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'api.example.com:8443',
        protocol: 'https:',
        headers: {},
      })
    })

    it('should handle URL with path', async () => {
      mockGetLocalAPIHostURL.mockReturnValue('http://localhost:8080/api/v1')

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await getSessionClient(session)

      expect(mockChatBotKit).toHaveBeenCalledWith({
        secret: 'mock-session-token',
        host: 'localhost:8080',
        protocol: 'http:',
        headers: {},
      })
    })
  })

  describe('return value', () => {
    it('should return the constructed ChatBotKit instance', async () => {
      const mockInstance = {
        api: 'mock-api',
        chat: 'mock-chat',
      }

      mockChatBotKit.mockReturnValue(mockInstance)

      const session = { id: 'session-123', user: { id: 'user-123' } }

      const result = await getSessionClient(session)

      expect(result).toBe(mockInstance)
    })
  })

  describe('function calls and dependencies', () => {
    it('should call all dependency functions in correct order', async () => {
      const session = { id: 'session-123', user: { id: 'user-123' } }

      await getSessionClient(session)

      expect(mockGetLocalAPIHostURL).toHaveBeenCalledTimes(1)
      expect(mockGetContextFrontendHost).toHaveBeenCalledTimes(1)
      expect(mockGetContextRequestIpAddress).toHaveBeenCalledTimes(1)
      expect(mockGetContextTimezone).toHaveBeenCalledTimes(1)
      expect(mockGetInternalAssertionHeaders).toHaveBeenCalledTimes(1)
      expect(mockGetTemporarySessionToken).toHaveBeenCalledTimes(1)
      expect(mockChatBotKit).toHaveBeenCalledTimes(1)
    })

    it('should not call any functions multiple times', async () => {
      const session = { id: 'session-123', user: { id: 'user-123' } }
      const options = { timeout: 5000 }

      await getSessionClient(session, options)

      expect(mockGetLocalAPIHostURL).toHaveBeenCalledTimes(1)
      expect(mockGetContextFrontendHost).toHaveBeenCalledTimes(1)
      expect(mockGetContextRequestIpAddress).toHaveBeenCalledTimes(1)
      expect(mockGetContextTimezone).toHaveBeenCalledTimes(1)
      expect(mockGetInternalAssertionHeaders).toHaveBeenCalledTimes(1)
      expect(mockGetTemporarySessionToken).toHaveBeenCalledTimes(1)
      expect(mockChatBotKit).toHaveBeenCalledTimes(1)
    })
  })
})

describe('getLocalSessionClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockGetLocalAPIHostURL.mockReturnValue('http://localhost:8080')
    mockGetContextFrontendHost.mockReturnValue(null)
    mockGetContextRequestIpAddress.mockReturnValue(null)
    mockGetContextTimezone.mockReturnValue(null)
    mockGetTemporarySessionToken.mockResolvedValue('mock-session-token')

    mockChatBotKit.mockImplementation((config) => config)
  })

  it('passes fetchFn to the ChatBotKit constructor', async () => {
    const session = { id: 'session-123', user: { id: 'user-123' } }

    await getLocalSessionClient(session, jest.fn())

    const config = mockChatBotKit.mock.calls[0][0]

    expect(typeof config.fetchFn).toBe('function')
  })

  it('fetchFn calls the handler with a Request built from url and init', async () => {
    const session = { id: 'session-123', user: { id: 'user-123' } }

    const mockResponse = new Response('ok', { status: 200 })
    const handler = jest.fn().mockResolvedValue(mockResponse)

    await getLocalSessionClient(session, handler)

    const { fetchFn } = mockChatBotKit.mock.calls[0][0]

    const result = await fetchFn('http://localhost:8080/api/v1/bot/bot-1', {
      method: 'GET',
      headers: { authorization: 'Bearer test-token' },
    })

    expect(handler).toHaveBeenCalledTimes(1)

    const req = handler.mock.calls[0][0]

    expect(req).toBeInstanceOf(Request)
    expect(req.url).toBe('http://localhost:8080/api/v1/bot/bot-1')
    expect(req.method).toBe('GET')
    expect(result).toBe(mockResponse)
  })

  it('fetchFn returns the handler response directly', async () => {
    const session = { id: 'session-123', user: { id: 'user-123' } }

    const mockResponse = new Response(JSON.stringify({ id: 'bot-1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

    const handler = jest.fn().mockResolvedValue(mockResponse)

    await getLocalSessionClient(session, handler)

    const { fetchFn } = mockChatBotKit.mock.calls[0][0]

    const result = await fetchFn('http://localhost:8080/api/v1/bot/bot-1', {})

    expect(result).toBe(mockResponse)
  })

  it('propagates headers from context into the client config', async () => {
    mockGetContextFrontendHost.mockReturnValue('frontend.example.com')
    mockGetContextTimezone.mockReturnValue('UTC')

    const session = { id: 'session-123', user: { id: 'user-123' } }

    await getLocalSessionClient(session, jest.fn())

    const config = mockChatBotKit.mock.calls[0][0]

    expect(config.headers['x-chatbotkit-assertion-test']).toBe('signed-context')
    expect(config.headers[TIMEZONE_HEADER_NAME]).toBe('UTC')
  })

  it('uses the session token as secret', async () => {
    const session = { id: 'session-123', user: { id: 'user-123' } }

    await getLocalSessionClient(session, jest.fn())

    expect(mockGetTemporarySessionToken).toHaveBeenCalledWith(session)

    const config = mockChatBotKit.mock.calls[0][0]

    expect(config.secret).toBe('mock-session-token')
  })
})
