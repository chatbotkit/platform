/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'
import { SecretKind } from '@/prisma/types'

import { UserAuthError } from '@/lib/error'
import * as host from '@/lib/host'
import * as jwt from '@/lib/jwt'
import memcache from '@/lib/memcache'
import {
  ContactSecretManager,
  DirectSecretManager,
  EphemeralSecretManager,
  getAdminAuthError,
  getAuthURL,
  getSecretManager,
  getUserAuthError,
} from '@/lib/secret.manager'
import * as short from '@/lib/short'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    secret: {
      update: jest.fn(),
    },
    secretValue: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({
  SecretKind: {
    personal: 'personal',
    shared: 'shared',
  },
}))

jest.mock('@/lib/jwt', () => ({
  sign: jest.fn(() => Promise.resolve('mock-signed-token')),
}))

jest.mock('@/lib/host', () => ({
  getExternalFrontendHostURL: jest.fn(() => 'https://example.com'),
}))

jest.mock('@/lib/short', () => ({
  getTempShortURL: jest.fn((url) =>
    Promise.resolve(
      `https://short.ly/${Buffer.from(url).toString('base64').slice(0, 8)}`
    )
  ),
}))

jest.mock('@/lib/memcache', () => ({
  __esModule: true,

  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}))

describe('secret.manager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getUserAuthURL', () => {
    it('should generate auth URL with state token and hash parameters', async () => {
      const path = '/auth/callback'
      const state = { userId: 'user-123', secretId: 'secret-456' }

      const result = await getAuthURL(path, state)

      expect(jwt.sign).toHaveBeenCalledWith(state, 900) // QUARTER_HOUR_IN_SECONDS
      expect(host.getExternalFrontendHostURL).toHaveBeenCalled()
      expect(short.getTempShortURL).toHaveBeenCalled()
      expect(result).toBeInstanceOf(URL)
      expect(result.searchParams.get('cbk')).toBe('1')
      expect(result.searchParams.get('auth')).toBe('1')
      expect(result.searchParams.get('unfurl')).toBe('0')
    })

    it('should generate raw URL when raw option is true', async () => {
      const path = '/auth/callback'
      const state = { userId: 'user-123' }

      const result = await getAuthURL(path, state, { raw: true })

      expect(short.getTempShortURL).not.toHaveBeenCalled()
      expect(result).toBeInstanceOf(URL)
      expect(result.href).toContain('example.com')
    })

    it('should include state parameter in URL', async () => {
      const path = '/auth/callback'
      const state = { test: 'value' }

      await getAuthURL(path, state)

      const shortUrlCall = short.getTempShortURL.mock.calls[0][0]
      const url = new URL(shortUrlCall)

      expect(url.searchParams.get('state')).toBe('mock-signed-token')
    })

    it('should include hash parameters for popup and unfurl hints', async () => {
      const path = '/auth/callback'
      const state = { test: 'value' }

      await getAuthURL(path, state)

      const shortUrlCall = short.getTempShortURL.mock.calls[0][0]
      const url = new URL(shortUrlCall)

      expect(url.hash).toContain('target=_popup')
      expect(url.hash).toContain('unfurl=0')
    })

    it('should not add cbk param if already present in shortened URL', async () => {
      short.getTempShortURL.mockResolvedValueOnce(
        'https://short.ly/abc?cbk=1&existing=param'
      )

      const result = await getAuthURL('/auth/callback', {})

      expect(result.searchParams.get('cbk')).toBe('1')
      expect(result.href).toContain('cbk=1')
    })

    it('should not add auth param if already present in shortened URL', async () => {
      short.getTempShortURL.mockResolvedValueOnce('https://short.ly/abc?auth=1')

      const result = await getAuthURL('/auth/callback', {})

      expect(result.searchParams.get('auth')).toBe('1')
    })

    it('should not add unfurl param if already present in shortened URL', async () => {
      short.getTempShortURL.mockResolvedValueOnce(
        'https://short.ly/abc?unfurl=0'
      )

      const result = await getAuthURL('/auth/callback', {})

      expect(result.searchParams.get('unfurl')).toBe('0')
    })
  })

  describe('getUserAuthError', () => {
    it('should create UserAuthError with auth URL', async () => {
      const path = '/auth/callback'
      const state = { userId: 'user-123' }

      const result = await getUserAuthError(path, state)

      expect(result).toBeInstanceOf(UserAuthError)
      expect(result.message).toContain('Missing value for secret')
      expect(result.message).toContain('to authorize access')
    })

    it('should use raw URL option when provided', async () => {
      const path = '/auth/callback'
      const state = { userId: 'user-123' }

      await getUserAuthError(path, state, { raw: true })

      expect(short.getTempShortURL).not.toHaveBeenCalled()
    })
  })

  describe('getAdminAuthError', () => {
    it('should create AdminAuthError without revealing URL', async () => {
      const path = '/auth/callback'
      const state = { userId: 'user-123', secretId: 'secret-456' }

      const result = await getAdminAuthError(path, state)

      expect(result).toBeInstanceOf(Error)
      expect(result.message).toBe('Missing value for secret')
      expect(result.message).not.toContain('http')
      expect(result.message).not.toContain('visit')
    })

    it('should still generate URL internally for security purposes', async () => {
      const path = '/auth/callback'
      const state = { userId: 'user-123' }

      await getAdminAuthError(path, state)

      expect(jwt.sign).toHaveBeenCalledWith(state, 900)
      expect(host.getExternalFrontendHostURL).toHaveBeenCalled()
    })

    it('should support raw option', async () => {
      const path = '/auth/callback'
      const state = { userId: 'user-123' }

      await getAdminAuthError(path, state, { raw: true })

      expect(short.getTempShortURL).not.toHaveBeenCalled()
    })
  })

  describe('DirectSecretManager', () => {
    let manager
    let mockSecret

    beforeEach(() => {
      manager = new DirectSecretManager({ required: false })
      mockSecret = {
        id: 'secret-123',
        userId: 'user-456',
        kind: SecretKind.shared,
        value: 'secret-value',
      }
    })

    describe('getAuthUrl', () => {
      it('should generate auth URL for personal secret', async () => {
        mockSecret.kind = SecretKind.shared

        const result = await manager.getAuthUrl(mockSecret)

        expect(result).toBeInstanceOf(URL)
        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-456',
            secretId: 'secret-123',
          }),
          900
        )
      })

      it('should throw error for non-personal secret', async () => {
        mockSecret.kind = SecretKind.personal

        await expect(manager.getAuthUrl(mockSecret)).rejects.toThrow(
          'Secret kind must be shared'
        )
      })

      it('should support raw URL option', async () => {
        mockSecret.kind = SecretKind.shared

        await manager.getAuthUrl(mockSecret, { raw: true })

        expect(short.getTempShortURL).not.toHaveBeenCalled()
      })

      it('should include correct path in URL', async () => {
        mockSecret.kind = SecretKind.shared

        await manager.getAuthUrl(mockSecret)

        const shortUrlCall = short.getTempShortURL.mock.calls[0][0]

        expect(shortUrlCall).toContain(
          `/secrets/${mockSecret.id}/manager/authenticate`
        )
      })
    })

    describe('getAuthError', () => {
      it('should create AdminAuthError without revealing URL', async () => {
        const result = await manager.getAuthError(mockSecret)

        expect(result).toBeInstanceOf(Error)
        expect(result.message).toBe('Missing value for secret')
        expect(result.message).not.toContain('http')
      })

      it('should include correct state in error generation', async () => {
        await manager.getAuthError(mockSecret)

        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-456',
            secretId: 'secret-123',
          }),
          900
        )
      })
    })

    describe('getValue', () => {
      it('should return secret value when present', async () => {
        const result = await manager.getValue(mockSecret)

        expect(result).toBe('secret-value')
      })

      it('should return null when value is empty', async () => {
        mockSecret.value = ''

        const result = await manager.getValue(mockSecret)

        expect(result).toBe(null)
      })

      it('should return null when value is null', async () => {
        mockSecret.value = null

        const result = await manager.getValue(mockSecret)

        expect(result).toBe(null)
      })

      it('should not throw when required is true but value is missing', async () => {
        manager = new DirectSecretManager({ required: true })
        mockSecret.value = null

        const result = await manager.getValue(mockSecret)

        expect(result).toBe(null)
      })
    })

    describe('setValue', () => {
      it('should update secret value in database', async () => {
        const newValue = 'new-secret-value'

        await manager.setValue(mockSecret, newValue)

        expect(prisma.secret.update).toHaveBeenCalledWith({
          where: { id: 'secret-123' },
          data: { value: newValue },
        })
      })
    })

    describe('delValue', () => {
      it('should set secret value to null in database', async () => {
        await manager.delValue(mockSecret)

        expect(prisma.secret.update).toHaveBeenCalledWith({
          where: { id: 'secret-123' },
          data: { value: null },
        })
      })
    })
  })

  describe('ContactSecretManager', () => {
    let manager
    let mockSecret
    let mockContact

    beforeEach(() => {
      mockContact = {
        id: 'contact-789',
        email: 'test@example.com',
        verifiedAt: new Date(),
      }
      manager = new ContactSecretManager({
        required: true,
        contact: mockContact,
      })
      mockSecret = {
        id: 'secret-123',
        userId: 'user-456',
        kind: SecretKind.personal,
        value: null,
      }
    })

    describe('getAuthUrl', () => {
      it('should generate auth URL for personal secret', async () => {
        const result = await manager.getAuthUrl(mockSecret)

        expect(result).toBeInstanceOf(URL)
        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-456',
            secretId: 'secret-123',
            contact: { id: 'contact-789' },
          }),
          900
        )
      })

      it('should throw error for non-personal secret', async () => {
        mockSecret.kind = SecretKind.shared

        await expect(manager.getAuthUrl(mockSecret)).rejects.toThrow(
          'Secret kind must be personal'
        )
      })

      it('should support raw URL option', async () => {
        await manager.getAuthUrl(mockSecret, { raw: true })

        expect(short.getTempShortURL).not.toHaveBeenCalled()
      })
    })

    describe('getAuthError', () => {
      it('should create UserAuthError with contact state', async () => {
        const result = await manager.getAuthError(mockSecret)

        expect(result).toBeInstanceOf(UserAuthError)
        expect(result.message).toContain('Missing value for secret')
      })
    })

    describe('getValue', () => {
      it('should return value from database when present', async () => {
        prisma.secretValue.findUnique.mockResolvedValue({
          value: 'stored-value',
        })

        const result = await manager.getValue(mockSecret)

        expect(result).toBe('stored-value')
        expect(prisma.secretValue.findUnique).toHaveBeenCalledWith({
          where: {
            userId_secretId_contactId: {
              userId: 'user-456',
              secretId: 'secret-123',
              contactId: 'contact-789',
            },
          },
        })
      })

      it('should return null when value not found and not required', async () => {
        manager = new ContactSecretManager({
          required: false,
          contact: mockContact,
        })
        prisma.secretValue.findUnique.mockResolvedValue(null)

        const result = await manager.getValue(mockSecret)

        expect(result).toBe(null)
      })

      it('should throw UserAuthError when value not found and required', async () => {
        prisma.secretValue.findUnique.mockResolvedValue(null)

        await expect(manager.getValue(mockSecret)).rejects.toThrow(
          UserAuthError
        )
      })

      it('should return null when value is empty string', async () => {
        manager = new ContactSecretManager({
          required: false,
          contact: mockContact,
        })
        prisma.secretValue.findUnique.mockResolvedValue({
          value: '',
        })

        const result = await manager.getValue(mockSecret)

        expect(result).toBe(null)
      })
    })

    describe('setValue', () => {
      it('should upsert value in database', async () => {
        const newValue = 'new-contact-value'

        await manager.setValue(mockSecret, newValue)

        expect(prisma.secretValue.upsert).toHaveBeenCalledWith({
          where: {
            userId_secretId_contactId: {
              userId: 'user-456',
              secretId: 'secret-123',
              contactId: 'contact-789',
            },
          },
          create: {
            userId: 'user-456',
            secretId: 'secret-123',
            contactId: 'contact-789',
            value: newValue,
          },
          update: {
            value: newValue,
          },
        })
      })
    })

    describe('delValue', () => {
      it('should delete value from database', async () => {
        await manager.delValue(mockSecret, false)

        expect(prisma.secretValue.delete).toHaveBeenCalledWith({
          where: {
            userId_secretId_contactId: {
              userId: 'user-456',
              secretId: 'secret-123',
              contactId: 'contact-789',
            },
          },
        })
      })

      it('should throw UserAuthError when auth parameter is true', async () => {
        await expect(manager.delValue(mockSecret, true)).rejects.toThrow(
          UserAuthError
        )
      })
    })
  })

  describe('EphemeralSecretManager', () => {
    let manager
    let mockSecret

    beforeEach(() => {
      manager = new EphemeralSecretManager({
        required: true,
        namespace: 'test-namespace',
      })
      mockSecret = {
        id: 'secret-123',
        userId: 'user-456',
        kind: SecretKind.personal,
        value: null,
      }
    })

    describe('getAuthUrl', () => {
      it('should generate auth URL for personal secret', async () => {
        const result = await manager.getAuthUrl(mockSecret)

        expect(result).toBeInstanceOf(URL)
        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-456',
            secretId: 'secret-123',
            ephemeral: { namespace: 'test-namespace' },
          }),
          900
        )
      })

      it('should throw error for non-personal secret', async () => {
        mockSecret.kind = SecretKind.shared

        await expect(manager.getAuthUrl(mockSecret)).rejects.toThrow(
          'Secret kind must be personal'
        )
      })
    })

    describe('getAuthError', () => {
      it('should create UserAuthError with ephemeral state', async () => {
        const result = await manager.getAuthError(mockSecret)

        expect(result).toBeInstanceOf(UserAuthError)
        expect(result.message).toContain('Missing value for secret')
      })
    })

    describe('getValue', () => {
      it('should return value from Redis when present', async () => {
        memcache.get.mockResolvedValue('cached-value')

        const result = await manager.getValue(mockSecret)

        expect(result).toBe('cached-value')
        expect(memcache.get).toHaveBeenCalledWith(
          'secret:ephemeral:secret-123:test-namespace'
        )
      })

      it('should return null when value not found and not required', async () => {
        manager = new EphemeralSecretManager({
          required: false,
          namespace: 'test-namespace',
        })
        memcache.get.mockResolvedValue(null)

        const result = await manager.getValue(mockSecret)

        expect(result).toBe(null)
      })

      it('should throw UserAuthError when value not found and required', async () => {
        memcache.get.mockResolvedValue(null)

        await expect(manager.getValue(mockSecret)).rejects.toThrow(
          UserAuthError
        )
      })

      it('should return null when value is empty string', async () => {
        manager = new EphemeralSecretManager({
          required: false,
          namespace: 'test-namespace',
        })
        memcache.get.mockResolvedValue('')

        const result = await manager.getValue(mockSecret)

        expect(result).toBe(null)
      })
    })

    describe('setValue', () => {
      it('should store value in Redis with expiration', async () => {
        const newValue = 'new-ephemeral-value'

        await manager.setValue(mockSecret, newValue)

        expect(memcache.set).toHaveBeenCalledWith(
          'secret:ephemeral:secret-123:test-namespace',
          newValue,
          { ex: 86400 } // ONE_DAY_IN_SECONDS
        )
      })
    })

    describe('delValue', () => {
      it('should delete value from Redis', async () => {
        await manager.delValue(mockSecret, false)

        expect(memcache.del).toHaveBeenCalledWith(
          'secret:ephemeral:secret-123:test-namespace'
        )
      })

      it('should throw UserAuthError when auth parameter is true', async () => {
        await expect(manager.delValue(mockSecret, true)).rejects.toThrow(
          UserAuthError
        )
      })
    })
  })

  describe('getSecretManager', () => {
    let mockSecret

    beforeEach(() => {
      mockSecret = {
        id: 'secret-123',
        userId: 'user-456',
        kind: SecretKind.personal,
        value: null,
      }
    })

    describe('personal secrets', () => {
      it('should return ContactSecretManager for verified contact', () => {
        const contact = {
          id: 'contact-789',
          email: 'test@example.com',
          verifiedAt: new Date(),
        }

        const result = getSecretManager(mockSecret, {
          contact,
          namespace: null,
        })

        expect(result).toBeInstanceOf(ContactSecretManager)
      })

      it('should return EphemeralSecretManager for namespace when contact is not verified', () => {
        const contact = {
          id: 'contact-789',
          email: 'test@example.com',
          verifiedAt: null,
        }
        const namespace = 'test-namespace'

        const result = getSecretManager(mockSecret, { contact, namespace })

        expect(result).toBeInstanceOf(EphemeralSecretManager)
      })

      it('should return EphemeralSecretManager for namespace when no contact provided', () => {
        const namespace = 'test-namespace'

        const result = getSecretManager(mockSecret, {
          contact: null,
          namespace,
        })

        expect(result).toBeInstanceOf(EphemeralSecretManager)
      })

      it('should return null when neither verified contact nor namespace provided', () => {
        const result = getSecretManager(mockSecret, {
          contact: null,
          namespace: null,
        })

        expect(result).toBe(null)
      })

      it('should return null when contact is not verified and no namespace', () => {
        const contact = {
          id: 'contact-789',
          email: 'test@example.com',
          verifiedAt: null,
        }

        const result = getSecretManager(mockSecret, {
          contact,
          namespace: null,
        })

        expect(result).toBe(null)
      })
    })

    describe('shared secrets', () => {
      beforeEach(() => {
        mockSecret.kind = SecretKind.shared
      })

      it('should return DirectSecretManager for shared secrets', () => {
        const result = getSecretManager(mockSecret, {
          contact: null,
          namespace: null,
        })

        expect(result).toBeInstanceOf(DirectSecretManager)
      })

      it('should return DirectSecretManager even when contact and namespace provided', () => {
        const contact = {
          id: 'contact-789',
          email: 'test@example.com',
          verifiedAt: new Date(),
        }
        const namespace = 'test-namespace'

        const result = getSecretManager(mockSecret, { contact, namespace })

        expect(result).toBeInstanceOf(DirectSecretManager)
      })
    })

    it('should log debug information', () => {
      const contact = {
        id: 'contact-789',
        email: 'test@example.com',
        verifiedAt: new Date(),
      }

      getSecretManager(mockSecret, { contact, namespace: 'test' })
    })
  })
})
