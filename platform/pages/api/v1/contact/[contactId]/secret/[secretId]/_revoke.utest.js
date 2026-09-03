/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { revokeOAuthToken } from '@/lib/oauth.revoke'
import { canUseSecret } from '@/lib/secret.access'
import { ContactSecretManager } from '@/lib/secret.manager'
import { getSecretValueAndType } from '@/lib/secret.value'

import handler from './revoke'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    contact: {
      findUniqueByIdentifier: jest.fn(),
    },
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
}))

jest.mock('@/lib/oauth.revoke', () => ({
  revokeOAuthToken: jest.fn(),
}))

jest.mock('@/lib/secret.access', () => ({
  canUseSecret: jest.fn(),
}))

jest.mock('@/lib/secret.manager', () => ({
  ContactSecretManager: jest.fn().mockImplementation(() => ({
    delValue: jest.fn(),
  })),
}))

jest.mock('@/lib/secret.value', () => ({
  getSecretValueAndType: jest.fn(),
}))

jest.mock('@/prisma/types', () => ({
  SecretType: {
    plain: 'plain',
    basic: 'basic',
    bearer: 'bearer',
    oauth: 'oauth',
    template: 'template',
    reference: 'reference',
  },
}))

describe('POST /api/v1/contact/[contactId]/secret/[secretId]/revoke', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockContact = {
    id: 'contact_abc123',
    userId: 'user_123',
  }

  const mockSecret = {
    id: 'secret_xyz789',
    userId: 'user_123',
  }

  let mockSecretManager

  beforeEach(() => {
    jest.clearAllMocks()

    mockSecretManager = { delValue: jest.fn() }
    ContactSecretManager.mockImplementation(() => mockSecretManager)

    canUseSecret.mockResolvedValue(true)

    getSecretValueAndType.mockResolvedValue({
      value: null,
      baseType: 'bearer',
    })
  })

  describe('basic functionality', () => {
    it('should revoke a secret and return its id', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('secret_xyz789')
    })

    it('should call delValue on the secret manager', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      await handler(req, mockSession)

      expect(mockSecretManager.delValue).toHaveBeenCalledWith(mockSecret, false)
    })

    it('should initialize ContactSecretManager with the contact', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      await handler(req, mockSession)

      expect(ContactSecretManager).toHaveBeenCalledWith({
        contact: mockContact,
      })
    })
  })

  describe('contact authorization', () => {
    it('should return 404 when the contact is not found', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { contactId: 'contact_nonexistent', secretId: 'secret_xyz789' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when the contact belongs to another user', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        ...mockContact,
        userId: 'other_user',
      })

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.secret.findUniqueByIdentifier).not.toHaveBeenCalled()
    })
  })

  describe('secret authorization', () => {
    it('should return 404 when the secret is not found', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_missing' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(canUseSecret).not.toHaveBeenCalled()
    })

    it('should return 403 when the user cannot use the secret', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(false)

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(mockSecretManager.delValue).not.toHaveBeenCalled()
    })
  })

  describe('valueAndType handling', () => {
    it('should return 404 when getSecretValueAndType returns null', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockResolvedValue(null)

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(mockSecretManager.delValue).not.toHaveBeenCalled()
    })

    it('should call getSecretValueAndType with the secret and contact context', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      await handler(req, mockSession)

      expect(getSecretValueAndType).toHaveBeenCalledWith(mockSecret, {
        contact: mockContact,
      })
    })
  })

  describe('OAuth token revocation', () => {
    it('should revoke the OAuth token when baseType is oauth and value exists', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockResolvedValue({
        value: 'Bearer oauth_token_abc',
        baseType: 'oauth',
      })

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      await handler(req, mockSession)

      expect(revokeOAuthToken).toHaveBeenCalledWith(
        mockSecret,
        'oauth_token_abc'
      )
    })

    it('should strip the Bearer prefix before passing to revokeOAuthToken', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockResolvedValue({
        value: 'BEARER my_raw_token',
        baseType: 'oauth',
      })

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      await handler(req, mockSession)

      expect(revokeOAuthToken).toHaveBeenCalledWith(mockSecret, 'my_raw_token')
    })

    it('should not call revokeOAuthToken for non-oauth secret types', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockResolvedValue({
        value: 'some_bearer_token',
        baseType: 'bearer',
      })

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      await handler(req, mockSession)

      expect(revokeOAuthToken).not.toHaveBeenCalled()
      expect(mockSecretManager.delValue).toHaveBeenCalled()
    })

    it('should not call revokeOAuthToken when oauth value is falsy', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockResolvedValue({
        value: null,
        baseType: 'oauth',
      })

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      await handler(req, mockSession)

      expect(revokeOAuthToken).not.toHaveBeenCalled()
      expect(mockSecretManager.delValue).toHaveBeenCalled()
    })

    it('should still call delValue even when OAuth revocation is skipped', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValueAndType.mockResolvedValue({
        value: null,
        baseType: 'bearer',
      })

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      await handler(req, mockSession)

      expect(revokeOAuthToken).not.toHaveBeenCalled()
      expect(mockSecretManager.delValue).toHaveBeenCalledWith(mockSecret, false)
    })
  })

  describe('error handling', () => {
    it('should propagate contact lookup errors', async () => {
      prisma.contact.findUniqueByIdentifier.mockRejectedValue(
        new Error('Contact lookup failed')
      )

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Contact lookup failed'
      )
    })

    it('should propagate secret lookup errors', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockRejectedValue(
        new Error('Secret lookup failed')
      )

      const req = {
        query: { contactId: 'contact_abc123', secretId: 'secret_xyz789' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Secret lookup failed'
      )
    })
  })
})
