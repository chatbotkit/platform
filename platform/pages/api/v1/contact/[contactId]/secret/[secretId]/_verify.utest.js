/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { UserAuthError } from '@/lib/error'
import { canUseSecret } from '@/lib/secret.access'
import { ContactSecretManager, getSecretManager } from '@/lib/secret.manager'
import { getSecretValue } from '@/lib/secret.value'

import handler from './verify'

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

jest.mock('@/lib/secret.value', () => ({
  getSecretValue: jest.fn(),
}))

jest.mock('@/lib/error', () => {
  class UserAuthError extends Error {
    constructor(message) {
      super(message)
      this.name = 'UserAuthError'
    }
  }

  return { UserAuthError }
})

describe('POST /api/v1/contact/[contactId]/secret/[secretId]/verify', () => {
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
    getSecretValue.mockResolvedValue('secret_token_value')

    // @note ContactSecretManager instanceof check requires the mock to share its prototype
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
      expect(getSecretValue).not.toHaveBeenCalled()
    })
  })

  describe('authenticated status (value returned)', () => {
    it('should return 200 with status "authenticated" when secret has a value', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValue.mockResolvedValue('Bearer some_token')

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('secret_xyz')
      expect(result.body.status).toBe('authenticated')
    })

    it('should not include an action field when status is authenticated', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValue.mockResolvedValue('Bearer some_token')

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.body.action).toBeUndefined()
    })

    it('should not call getSecretManager when the secret is authenticated', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValue.mockResolvedValue('some_value')

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }

      await handler(req, mockSession)

      expect(getSecretManager).not.toHaveBeenCalled()
    })
  })

  describe('unauthenticated status (UserAuthError thrown)', () => {
    beforeEach(() => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValue.mockRejectedValue(new UserAuthError('token expired'))
    })

    it('should return 200 with status "unauthenticated" when UserAuthError is thrown', async () => {
      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.status).toBe('unauthenticated')
    })

    it('should include an authenticate action with url when unauthenticated', async () => {
      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.body.action).toBeDefined()
      expect(result.body.action.type).toBe('authenticate')
      expect(result.body.action.url).toBeDefined()
    })

    it('should include the secret id in the response', async () => {
      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.body.id).toBe('secret_xyz')
    })

    it('should call getAuthUrl with raw: true when building the authenticate action', async () => {
      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }

      await handler(req, mockSession)

      expect(mockSecretManager.getAuthUrl).toHaveBeenCalledWith(
        mockSecret,
        expect.objectContaining({ raw: true })
      )
    })

    it('should use the URL href from the secret manager in the action', async () => {
      mockSecretManager.getAuthUrl.mockResolvedValue(
        new URL('https://accounts.google.com/oauth?state=xyz&scope=read')
      )

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.body.action.url).toBe(
        'https://accounts.google.com/oauth?state=xyz&scope=read'
      )
    })
  })

  describe('non-auth errors from getSecretValue', () => {
    it('should return 409 when a non-UserAuthError is thrown from getSecretValue', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValue.mockRejectedValue(new Error('Storage backend unreachable'))

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(409)
    })

    it('should propagate the error message from non-auth errors', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValue.mockRejectedValue(new Error('Storage backend unreachable'))

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.body.message).toContain('Storage backend unreachable')
    })
  })

  describe('unauthenticated with unsupported secret manager', () => {
    beforeEach(() => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(mockSecret)
      getSecretValue.mockRejectedValue(new UserAuthError('not authenticated'))
    })

    it('should return 409 when no secret manager is found', async () => {
      getSecretManager.mockReturnValue(null)

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(409)
    })

    it('should return 409 when manager is not a ContactSecretManager', async () => {
      // Return a plain object not inheriting from ContactSecretManager
      const otherManager = { getAuthUrl: jest.fn() }

      getSecretManager.mockReturnValue(otherManager)

      const req = {
        query: { contactId: 'contact_abc', secretId: 'secret_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(409)
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
  })
})
