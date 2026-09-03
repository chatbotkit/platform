/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'
import { SecretType } from '@/prisma/types'

import { revokeOAuthToken } from '@/lib/oauth.revoke'
import { getSecretValueAndType } from '@/lib/secret.value'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    secret: {
      findUniqueByIdentifier: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({
  SecretType: { oauth: 'oauth', bearer: 'bearer', plain: 'plain' },
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
}))

jest.mock('@/lib/oauth.revoke', () => ({
  revokeOAuthToken: jest.fn(),
}))

jest.mock('@/lib/secret.value', () => ({
  getSecretValueAndType: jest.fn(),
}))

describe('/api/v1/secret/[secretId]/delete', () => {
  const mockSession = {
    user: { id: 'user_123', email: 'user@example.com' },
  }

  const mockReq = {
    query: { secretId: 'secret_abc' },
  }

  const mockSecret = {
    id: 'secret_abc',
    userId: 'user_123',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should delete a secret and return its id', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockResolvedValue(null)
      prisma.secret.delete.mockResolvedValue(mockSecret)

      const result = await handler(mockReq, mockSession)

      expect(prisma.secret.delete).toHaveBeenCalledWith({
        where: { id: 'secret_abc' },
      })
      expect(result.status).toBe(200)
      expect(result.body.id).toBe('secret_abc')
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

  describe('OAuth token revocation on delete', () => {
    it('should revoke OAuth token before deleting the secret', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockResolvedValue({
        value: 'Bearer oauth_token',
        baseType: SecretType.oauth,
      })
      prisma.secret.delete.mockResolvedValue(mockSecret)

      await handler(mockReq, mockSession)

      // Token revocation happens before delete
      expect(revokeOAuthToken).toHaveBeenCalledWith(mockSecret, 'oauth_token')
      expect(prisma.secret.delete).toHaveBeenCalled()
    })

    it('should strip Bearer prefix before revoking the OAuth token', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockResolvedValue({
        value: 'Bearer mytoken123',
        baseType: SecretType.oauth,
      })
      prisma.secret.delete.mockResolvedValue(mockSecret)

      await handler(mockReq, mockSession)

      expect(revokeOAuthToken).toHaveBeenCalledWith(mockSecret, 'mytoken123')
    })

    it('should not call revokeOAuthToken when secret is not oauth type', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockResolvedValue({
        value: 'api_key_value',
        baseType: SecretType.bearer,
      })
      prisma.secret.delete.mockResolvedValue(mockSecret)

      await handler(mockReq, mockSession)

      expect(revokeOAuthToken).not.toHaveBeenCalled()
      expect(prisma.secret.delete).toHaveBeenCalled()
    })

    it('should not call revokeOAuthToken when secret value is null', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockResolvedValue({
        value: null,
        baseType: SecretType.oauth,
      })
      prisma.secret.delete.mockResolvedValue(mockSecret)

      await handler(mockReq, mockSession)

      expect(revokeOAuthToken).not.toHaveBeenCalled()
      expect(prisma.secret.delete).toHaveBeenCalled()
    })

    it('should still delete secret even when getSecretValueAndType returns null', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockResolvedValue(null)
      prisma.secret.delete.mockResolvedValue(mockSecret)

      const result = await handler(mockReq, mockSession)

      expect(revokeOAuthToken).not.toHaveBeenCalled()
      expect(prisma.secret.delete).toHaveBeenCalled()
      expect(result.status).toBe(200)
    })
  })

  describe('not found handling', () => {
    it('should return 404 when secret does not exist', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.secret.delete).not.toHaveBeenCalled()
    })
  })

  describe('authorization', () => {
    it('should return 403 when user does not own the secret', async () => {
      const otherUserSecret = {
        ...mockSecret,
        userId: 'other_user_456',
      }

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(otherUserSecret)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.secret.delete).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should propagate errors from prisma delete', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockResolvedValue(null)
      prisma.secret.delete.mockRejectedValue(new Error('DB error'))

      await expect(handler(mockReq, mockSession)).rejects.toThrow('DB error')
    })

    it('should still delete secret when getSecretValueAndType throws due to missing auth context', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockRejectedValue(
        new Error('Cannot obtain valid authentication context')
      )
      prisma.secret.delete.mockResolvedValue(mockSecret)

      const result = await handler(mockReq, mockSession)

      expect(revokeOAuthToken).not.toHaveBeenCalled()
      expect(prisma.secret.delete).toHaveBeenCalledWith({
        where: { id: 'secret_abc' },
      })
      expect(result.status).toBe(200)
      expect(result.body.id).toBe('secret_abc')
    })
  })
})
