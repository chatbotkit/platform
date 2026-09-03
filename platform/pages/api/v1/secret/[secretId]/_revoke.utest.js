/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'
import { SecretKind, SecretType } from '@/prisma/types'

import { revokeOAuthToken } from '@/lib/oauth.revoke'
import { getSecretValueAndType } from '@/lib/secret.value'

import handler from './revoke'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    secret: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({
  SecretKind: { shared: 'shared', personal: 'personal' },
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
  conflict: (msg) => ({ status: 409, body: { message: msg } }),
}))

jest.mock('@/lib/oauth.revoke', () => ({
  revokeOAuthToken: jest.fn(),
}))

jest.mock('@/lib/secret.value', () => ({
  getSecretValueAndType: jest.fn(),
}))

// @note DirectSecretManager is used internally; we mock it to avoid real crypto calls
jest.mock('@/lib/secret.manager', () => ({
  DirectSecretManager: jest.fn().mockImplementation(() => ({
    delValue: jest.fn().mockResolvedValue(undefined),
  })),
}))

describe('/api/v1/secret/[secretId]/revoke', () => {
  const mockSession = {
    user: { id: 'user_123', email: 'user@example.com' },
  }

  const mockReq = {
    query: { secretId: 'secret_abc' },
  }

  const mockSharedOauthSecret = {
    id: 'secret_abc',
    userId: 'user_123',
    kind: SecretKind.shared,
    type: SecretType.oauth,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should revoke an OAuth token and return the secret id', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        mockSharedOauthSecret
      )
      getSecretValueAndType.mockResolvedValue({
        value: 'Bearer oauth_token_value',
        baseType: SecretType.oauth,
      })

      const result = await handler(mockReq, mockSession)

      expect(revokeOAuthToken).toHaveBeenCalled()
      expect(result.status).toBe(200)
      expect(result.body.id).toBe('secret_abc')
    })

    it('should strip Bearer prefix before calling revokeOAuthToken', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        mockSharedOauthSecret
      )
      getSecretValueAndType.mockResolvedValue({
        value: 'Bearer mytoken123',
        baseType: SecretType.oauth,
      })

      await handler(mockReq, mockSession)

      expect(revokeOAuthToken).toHaveBeenCalledWith(
        mockSharedOauthSecret,
        'mytoken123'
      )
    })

    it('should strip Bearer prefix case-insensitively', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        mockSharedOauthSecret
      )
      getSecretValueAndType.mockResolvedValue({
        value: 'bearer mytoken456',
        baseType: SecretType.oauth,
      })

      await handler(mockReq, mockSession)

      expect(revokeOAuthToken).toHaveBeenCalledWith(
        mockSharedOauthSecret,
        'mytoken456'
      )
    })
  })

  describe('non-OAuth secrets', () => {
    it('should not call revokeOAuthToken for bearer type secrets', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        mockSharedOauthSecret
      )
      getSecretValueAndType.mockResolvedValue({
        value: 'some_api_key',
        baseType: SecretType.bearer,
      })

      const result = await handler(mockReq, mockSession)

      expect(revokeOAuthToken).not.toHaveBeenCalled()
      expect(result.status).toBe(200)
    })

    it('should not call revokeOAuthToken for plain type secrets', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        mockSharedOauthSecret
      )
      getSecretValueAndType.mockResolvedValue({
        value: 'plain_value',
        baseType: SecretType.plain,
      })

      const result = await handler(mockReq, mockSession)

      expect(revokeOAuthToken).not.toHaveBeenCalled()
      expect(result.status).toBe(200)
    })

    it('should complete successfully even when OAuth value is empty', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        mockSharedOauthSecret
      )
      getSecretValueAndType.mockResolvedValue({
        value: null,
        baseType: SecretType.oauth,
      })

      const result = await handler(mockReq, mockSession)

      expect(revokeOAuthToken).not.toHaveBeenCalled()
      expect(result.status).toBe(200)
    })
  })

  describe('missing secret value', () => {
    it('should return 404 when getSecretValueAndType returns null', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        mockSharedOauthSecret
      )
      getSecretValueAndType.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
      expect(revokeOAuthToken).not.toHaveBeenCalled()
    })
  })

  describe('not found handling', () => {
    it('should return 404 when secret does not exist', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
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
    it('should return 403 when user does not own the secret', async () => {
      const otherUserSecret = {
        ...mockSharedOauthSecret,
        userId: 'other_user_456',
      }

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(otherUserSecret)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(403)
      expect(getSecretValueAndType).not.toHaveBeenCalled()
    })
  })

  describe('kind restrictions', () => {
    it('should return 409 when secret kind is personal', async () => {
      const personalSecret = {
        ...mockSharedOauthSecret,
        kind: SecretKind.personal,
      }

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(personalSecret)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(409)
      expect(getSecretValueAndType).not.toHaveBeenCalled()
    })

    it('should only allow shared secrets to be revoked', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        mockSharedOauthSecret
      )
      getSecretValueAndType.mockResolvedValue({
        value: 'Bearer token',
        baseType: SecretType.oauth,
      })

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
    })
  })
})
