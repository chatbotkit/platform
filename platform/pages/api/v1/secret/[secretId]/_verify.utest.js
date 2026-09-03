/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { UserAuthError } from '@/lib/error'
import { canUseSecret } from '@/lib/secret.access'
import { DirectSecretManager, getSecretManager } from '@/lib/secret.manager'
import { getSecretValue } from '@/lib/secret.value'

import handler from './verify'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    secret: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
  conflict: (msg) => ({ status: 409, body: { message: msg } }),
}))

jest.mock('@/lib/error', () => ({
  UserAuthError: class UserAuthError extends Error {
    constructor(message) {
      super(message)
      this.name = 'UserAuthError'
    }
  },
}))

jest.mock('@/lib/secret.access', () => ({
  canUseSecret: jest.fn(),
}))

jest.mock('@/lib/secret.value', () => ({
  getSecretValue: jest.fn(),
}))

jest.mock('@/lib/secret.manager', () => {
  const mockGetAuthUrl = jest.fn()
  const DirectSecretManagerMock = jest.fn().mockImplementation(() => ({
    getAuthUrl: mockGetAuthUrl,
  }))

  return {
    getSecretManager: jest.fn(),
    DirectSecretManager: DirectSecretManagerMock,
  }
})

describe('/api/v1/secret/[secretId]/verify', () => {
  const mockSession = {
    user: { id: 'user_123', email: 'user@example.com' },
  }

  const mockReq = {
    query: { secretId: 'secret_abc' },
  }

  const mockSecret = {
    id: 'secret_abc',
    userId: 'user_123',
    kind: 'personal',
    type: 'oauth',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('authenticated secret', () => {
    it('should return authenticated status when secret value exists', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(true)
      getSecretValue.mockResolvedValue('Bearer token_value')

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('secret_abc')
      expect(result.body.status).toBe('authenticated')
      expect(result.body.action).toBeUndefined()
    })

    it('should not call getSecretManager when secret is authenticated', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(true)
      getSecretValue.mockResolvedValue('some_value')

      await handler(mockReq, mockSession)

      expect(getSecretManager).not.toHaveBeenCalled()
    })
  })

  describe('unauthenticated secret', () => {
    it('should return unauthenticated status when secret value is null', async () => {
      const mockAuthUrl = new URL('https://oauth.example.com/authorize')
      const mockSecretManagerInstance = {
        getAuthUrl: jest.fn().mockResolvedValue(mockAuthUrl),
      }

      Object.setPrototypeOf(
        mockSecretManagerInstance,
        DirectSecretManager.prototype
      )

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(true)
      getSecretValue.mockResolvedValue(null)
      getSecretManager.mockReturnValue(mockSecretManagerInstance)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.status).toBe('unauthenticated')
      expect(result.body.action).toBeDefined()
      expect(result.body.action.type).toBe('authenticate')
      expect(result.body.action.url).toBe(mockAuthUrl.href)
    })

    it('should return unauthenticated status when UserAuthError is thrown', async () => {
      const mockAuthUrl = new URL('https://oauth.example.com/authorize')
      const mockSecretManagerInstance = {
        getAuthUrl: jest.fn().mockResolvedValue(mockAuthUrl),
      }

      Object.setPrototypeOf(
        mockSecretManagerInstance,
        DirectSecretManager.prototype
      )

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(true)
      getSecretValue.mockRejectedValue(new UserAuthError('Auth required'))
      getSecretManager.mockReturnValue(mockSecretManagerInstance)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.status).toBe('unauthenticated')
      expect(result.body.action.type).toBe('authenticate')
    })

    it('should return 409 conflict for non-UserAuthError exceptions', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(true)
      getSecretValue.mockRejectedValue(new Error('Unexpected error'))

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(409)
    })

    it('should return 409 when secret manager is not available for unauthenticated secret', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(true)
      getSecretValue.mockResolvedValue(null)
      getSecretManager.mockReturnValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(409)
    })

    it('should return 409 when secret manager is not a DirectSecretManager', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(true)
      getSecretValue.mockResolvedValue(null)
      getSecretManager.mockReturnValue({ getAuthUrl: jest.fn() })

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(409)
    })

    it('should pass raw:true when generating the unauthenticated action URL', async () => {
      const mockAuthUrl = new URL('https://oauth.example.com/authorize')
      const mockGetAuthUrl = jest.fn().mockResolvedValue(mockAuthUrl)
      const mockSecretManagerInstance = { getAuthUrl: mockGetAuthUrl }

      Object.setPrototypeOf(
        mockSecretManagerInstance,
        DirectSecretManager.prototype
      )

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(true)
      getSecretValue.mockResolvedValue(null)
      getSecretManager.mockReturnValue(mockSecretManagerInstance)

      await handler(mockReq, mockSession)

      expect(mockGetAuthUrl).toHaveBeenCalledWith(
        mockSecret,
        expect.objectContaining({ raw: true })
      )
    })
  })

  describe('not found handling', () => {
    it('should return 404 when secret does not exist', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
      expect(canUseSecret).not.toHaveBeenCalled()
    })

    it('should look up secret using secretId from URL param', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { secretId: 'secret_xyz' } }

      await handler(req, mockSession)

      expect(prisma.secret.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'secret_xyz'
      )
    })
  })

  describe('authorization', () => {
    it('should return 403 when user cannot use the secret', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(false)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(403)
      expect(getSecretValue).not.toHaveBeenCalled()
    })

    it('should call canUseSecret with the session user and secret', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(false)

      await handler(mockReq, mockSession)

      expect(canUseSecret).toHaveBeenCalledWith(mockSession.user, mockSecret)
    })
  })
})
