/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { canUseSecret } from '@/lib/secret.access'
import { DirectSecretManager, getSecretManager } from '@/lib/secret.manager'

import handler from './authenticate'

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

jest.mock('@/lib/secret.access', () => ({
  canUseSecret: jest.fn(),
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

describe('/api/v1/secret/[secretId]/authenticate', () => {
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

  describe('basic functionality', () => {
    it('should return authentication URL for a valid personal secret', async () => {
      const mockAuthUrl = new URL(
        'https://oauth.example.com/authorize?client_id=xxx'
      )

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(true)

      const mockSecretManagerInstance = {
        getAuthUrl: jest.fn().mockResolvedValue(mockAuthUrl),
      }

      getSecretManager.mockReturnValue(mockSecretManagerInstance)

      // Make instanceof check pass by returning a DirectSecretManager-compatible instance
      Object.setPrototypeOf(
        mockSecretManagerInstance,
        DirectSecretManager.prototype
      )

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('secret_abc')
      expect(result.body.url).toBe(mockAuthUrl)
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
      expect(getSecretManager).not.toHaveBeenCalled()
    })

    it('should call canUseSecret with the session user and secret', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(false)

      await handler(mockReq, mockSession)

      expect(canUseSecret).toHaveBeenCalledWith(mockSession.user, mockSecret)
    })
  })

  describe('secret manager handling', () => {
    it('should return 409 when no secret manager is available', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(true)
      getSecretManager.mockReturnValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(409)
    })

    it('should return 409 when secret manager is not a DirectSecretManager', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(true)

      // Return a non-DirectSecretManager instance
      const genericManager = { getAuthUrl: jest.fn() }

      getSecretManager.mockReturnValue(genericManager)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(409)
    })

    it('should pass raw:true to getAuthUrl to avoid creating temp URLs unnecessarily', async () => {
      const mockAuthUrl = new URL('https://oauth.example.com/authorize')
      const mockGetAuthUrl = jest.fn().mockResolvedValue(mockAuthUrl)
      const mockSecretManagerInstance = { getAuthUrl: mockGetAuthUrl }

      Object.setPrototypeOf(
        mockSecretManagerInstance,
        DirectSecretManager.prototype
      )

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(true)
      getSecretManager.mockReturnValue(mockSecretManagerInstance)

      await handler(mockReq, mockSession)

      expect(mockGetAuthUrl).toHaveBeenCalledWith(
        mockSecret,
        expect.objectContaining({ raw: true })
      )
    })
  })
})
