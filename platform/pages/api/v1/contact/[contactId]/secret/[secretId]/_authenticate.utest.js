/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { canUseSecret } from '@/lib/secret.access'
import { ContactSecretManager, getSecretManager } from '@/lib/secret.manager'

import handler from './authenticate'

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
  conflict: (msg) => ({ status: 409, body: { message: msg } }),
}))

jest.mock('@/lib/secret.access', () => ({
  canUseSecret: jest.fn(),
}))

jest.mock('@/lib/secret.manager', () => ({
  ContactSecretManager: jest.fn(),
  getSecretManager: jest.fn(),
}))

describe('POST /api/v1/contact/[contactId]/secret/[secretId]/authenticate', () => {
  const mockSession = {
    user: { id: 'user_123' },
  }

  const mockContact = {
    id: 'contact_abc',
    userId: 'user_123',
  }

  const mockSecret = {
    id: 'secret_xyz',
    userId: 'user_123',
  }

  let mockSecretManager

  beforeEach(() => {
    jest.clearAllMocks()

    mockSecretManager = {
      getAuthUrl: jest
        .fn()
        .mockResolvedValue(new URL('https://auth.example.com/oauth')),
    }

    canUseSecret.mockResolvedValue(true)
    getSecretManager.mockReturnValue(mockSecretManager)

    // @note ContactSecretManager instanceof check requires the mock to be the constructor
    Object.setPrototypeOf(mockSecretManager, ContactSecretManager.prototype)
  })

  describe('contact authorization', () => {
    it('should return 404 when contact does not exist', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { contactId: 'contact_missing', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.secret.findUniqueByIdentifier).not.toHaveBeenCalled()
    })

    it('should return 403 when contact belongs to a different user', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        ...mockContact,
        userId: 'other_user',
      })

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.secret.findUniqueByIdentifier).not.toHaveBeenCalled()
    })
  })

  describe('secret authorization', () => {
    it('should return 404 when secret does not exist', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_missing' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(canUseSecret).not.toHaveBeenCalled()
    })

    it('should return 403 when user cannot use the secret', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      canUseSecret.mockResolvedValue(false)

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(getSecretManager).not.toHaveBeenCalled()
    })
  })

  describe('secret manager resolution', () => {
    it('should return 409 when no secret manager is found for the secret', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretManager.mockReturnValue(null)

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(409)
    })

    it('should pass the contact context when creating secret manager', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }

      await handler(req, mockSession)

      expect(getSecretManager).toHaveBeenCalledWith(mockSecret, {
        contact: mockContact,
      })
    })

    it('should return 409 when secret manager is not a ContactSecretManager instance', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)

      // Return an object that is NOT a ContactSecretManager
      const otherManager = { getAuthUrl: jest.fn() }

      getSecretManager.mockReturnValue(otherManager)

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(409)
    })
  })

  describe('happy path', () => {
    it('should return 200 with secret id and auth URL', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('secret_xyz')
      expect(result.body.url).toBeDefined()
    })

    it('should call getAuthUrl with raw: true to avoid unnecessary temp URLs', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }

      await handler(req, mockSession)

      expect(mockSecretManager.getAuthUrl).toHaveBeenCalledWith(
        mockSecret,
        expect.objectContaining({ raw: true })
      )
    })

    it('should include the auth URL from the secret manager in the response', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      mockSecretManager.getAuthUrl.mockResolvedValue(
        new URL('https://accounts.google.com/oauth?client_id=abc&state=xyz')
      )

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.body.url.href || String(result.body.url)).toContain(
        'accounts.google.com'
      )
    })
  })

  describe('error propagation', () => {
    it('should propagate contact lookup errors', async () => {
      prisma.contact.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB connection failed')
      )

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'DB connection failed'
      )
    })

    it('should propagate secret lookup errors', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockRejectedValue(
        new Error('Secret lookup failed')
      )

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Secret lookup failed'
      )
    })

    it('should propagate getAuthUrl errors', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      mockSecretManager.getAuthUrl.mockRejectedValue(
        new Error('OAuth provider error')
      )

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'OAuth provider error'
      )
    })
  })
})
