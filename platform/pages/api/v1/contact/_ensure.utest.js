/* eslint-disable @typescript-eslint/no-require-imports */
// @ts-check
import handler, { bodySchema } from './ensure'

import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/contact.create', () => ({
  ensureTrustedContact: jest.fn(),
  ensureUntrustedContact: jest.fn(),
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => data),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const mockSchema = {
    object: jest.fn(function () {
      return this
    }),
    string: jest.fn(function () {
      return this
    }),
    number: jest.fn(function () {
      return this
    }),
    allow: jest.fn(function () {
      return this
    }),
    email: jest.fn(function () {
      return this
    }),
    phone: jest.fn(function () {
      return this
    }),
    validateAsync: jest.fn(),
  }

  return {
    __esModule: true,
    default: mockSchema,
    withSchema: (schema, fn) => fn,
  }
})

describe('contact/ensure', () => {
  const runHandler =
    /** @type {(req: unknown, session: unknown, body: unknown) => Promise<unknown>} */ (
      handler
    )

  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('bodySchema', () => {
    it('should be defined', () => {
      expect(bodySchema).toBeDefined()
    })
  })

  describe('handler', () => {
    const {
      ensureTrustedContact,
      ensureUntrustedContact,
    } = require('@/lib/contact.create')
    const mockEnsureTrustedContact = /** @type {jest.Mock} */ (
      ensureTrustedContact
    )
    const mockEnsureUntrustedContact = /** @type {jest.Mock} */ (
      ensureUntrustedContact
    )

    describe('with fingerprint (trusted contact)', () => {
      it('should create trusted contact when fingerprint is provided', async () => {
        const mockContact = { id: 'contact-123' }

        mockEnsureTrustedContact.mockResolvedValue(mockContact)

        const { req } = createMocks({
          method: 'POST',
          body: {
            fingerprint: 'verified-fingerprint-abc123',
            name: 'Jane Smith',
            email: 'jane@example.com',
          },
        })

        await runHandler(req, mockSession, {
          fingerprint: 'verified-fingerprint-abc123',
          name: 'Jane Smith',
          email: 'jane@example.com',
        })

        expect(mockEnsureTrustedContact).toHaveBeenCalledWith(
          mockSession.user,
          {
            name: 'Jane Smith',
            description: undefined,
            email: 'jane@example.com',
            phone: undefined,
            nick: undefined,
            preferences: undefined,
            meta: undefined,
          },
          'verified-fingerprint-abc123'
        )
        expect(mockEnsureUntrustedContact).not.toHaveBeenCalled()
      })

      it('should handle trusted contact with all fields', async () => {
        const mockContact = { id: 'contact-456' }

        mockEnsureTrustedContact.mockResolvedValue(mockContact)

        const { req } = createMocks({
          method: 'POST',
        })

        await runHandler(req, mockSession, {
          fingerprint: 'fingerprint-xyz',
          name: 'John Doe',
          description: 'Premium customer',
          email: 'john@example.com',
          phone: '+1234567890',
          nick: 'johnd',
          preferences: 'email_notifications:true',
          meta: { tier: 'premium' },
        })

        expect(mockEnsureTrustedContact).toHaveBeenCalledWith(
          mockSession.user,
          {
            name: 'John Doe',
            description: 'Premium customer',
            email: 'john@example.com',
            phone: '+1234567890',
            nick: 'johnd',
            preferences: 'email_notifications:true',
            meta: { tier: 'premium' },
          },
          'fingerprint-xyz'
        )
      })

      it('should return contact ID for trusted contact', async () => {
        const mockContact = { id: 'contact-789' }

        mockEnsureTrustedContact.mockResolvedValue(mockContact)

        const { req } = createMocks({ method: 'POST' })

        const result = await runHandler(req, mockSession, {
          fingerprint: 'fingerprint-test',
          name: 'Test User',
        })

        expect(result).toEqual({ id: 'contact-789' })
      })
    })

    describe('without fingerprint (untrusted contact)', () => {
      it('should create untrusted contact when fingerprint is not provided', async () => {
        const mockContact = { id: 'contact-untrusted-123' }

        mockEnsureUntrustedContact.mockResolvedValue(mockContact)

        const { req } = createMocks({
          method: 'POST',
          body: {
            name: 'Guest User',
            email: 'guest@example.com',
          },
        })

        await runHandler(req, mockSession, {
          name: 'Guest User',
          email: 'guest@example.com',
        })

        expect(mockEnsureUntrustedContact).toHaveBeenCalledWith(
          mockSession.user,
          {
            name: 'Guest User',
            description: undefined,
            email: 'guest@example.com',
            phone: undefined,
            nick: undefined,
            preferences: undefined,
            meta: undefined,
          }
        )
        expect(mockEnsureTrustedContact).not.toHaveBeenCalled()
      })

      it('should handle untrusted contact with all fields', async () => {
        const mockContact = { id: 'contact-untrusted-456' }

        mockEnsureUntrustedContact.mockResolvedValue(mockContact)

        const { req } = createMocks({ method: 'POST' })

        await runHandler(req, mockSession, {
          name: 'Anonymous User',
          description: 'Trial user',
          email: 'anon@example.com',
          phone: '+9876543210',
          nick: 'anon',
          preferences: 'sms_notifications:false',
          meta: { source: 'web' },
        })

        expect(mockEnsureUntrustedContact).toHaveBeenCalledWith(
          mockSession.user,
          {
            name: 'Anonymous User',
            description: 'Trial user',
            email: 'anon@example.com',
            phone: '+9876543210',
            nick: 'anon',
            preferences: 'sms_notifications:false',
            meta: { source: 'web' },
          }
        )
      })

      it('should return contact ID for untrusted contact', async () => {
        const mockContact = { id: 'contact-untrusted-789' }

        mockEnsureUntrustedContact.mockResolvedValue(mockContact)

        const { req } = createMocks({ method: 'POST' })

        const result = await runHandler(req, mockSession, {
          name: 'Test Guest',
        })

        expect(result).toEqual({ id: 'contact-untrusted-789' })
      })

      it('should handle empty fingerprint as falsy', async () => {
        const mockContact = { id: 'contact-untrusted-empty' }

        mockEnsureUntrustedContact.mockResolvedValue(mockContact)

        const { req } = createMocks({ method: 'POST' })

        await runHandler(req, mockSession, {
          fingerprint: '',
          name: 'User with empty fingerprint',
        })

        expect(mockEnsureUntrustedContact).toHaveBeenCalled()
        expect(mockEnsureTrustedContact).not.toHaveBeenCalled()
      })

      it('should handle null fingerprint', async () => {
        const mockContact = { id: 'contact-untrusted-null' }

        mockEnsureUntrustedContact.mockResolvedValue(mockContact)

        const { req } = createMocks({ method: 'POST' })

        await runHandler(req, mockSession, {
          fingerprint: null,
          name: 'User with null fingerprint',
        })

        expect(mockEnsureUntrustedContact).toHaveBeenCalled()
        expect(mockEnsureTrustedContact).not.toHaveBeenCalled()
      })
    })

    describe('edge cases', () => {
      it('should handle minimal data', async () => {
        const mockContact = { id: 'contact-minimal' }

        mockEnsureUntrustedContact.mockResolvedValue(mockContact)

        const { req } = createMocks({ method: 'POST' })

        await runHandler(req, mockSession, {
          name: 'Minimal User',
        })

        expect(mockEnsureUntrustedContact).toHaveBeenCalledWith(
          mockSession.user,
          {
            name: 'Minimal User',
            description: undefined,
            email: undefined,
            phone: undefined,
            nick: undefined,
            preferences: undefined,
            meta: undefined,
          }
        )
      })

      it('should handle complex meta object', async () => {
        const mockContact = { id: 'contact-complex-meta' }

        mockEnsureTrustedContact.mockResolvedValue(mockContact)

        const complexMeta = {
          preferences: {
            notifications: { email: true, sms: false },
            privacy: { tracking: false },
          },
          tags: ['vip', 'early-adopter'],
          customData: { referrer: 'google', campaign: 'summer2025' },
        }

        const { req } = createMocks({ method: 'POST' })

        await runHandler(req, mockSession, {
          fingerprint: 'fp-complex',
          name: 'Complex User',
          meta: complexMeta,
        })

        expect(mockEnsureTrustedContact).toHaveBeenCalledWith(
          mockSession.user,
          expect.objectContaining({
            meta: complexMeta,
          }),
          'fp-complex'
        )
      })
    })

    describe('error handling', () => {
      it('should propagate errors from ensureTrustedContact', async () => {
        const error = new Error('Database connection failed')

        mockEnsureTrustedContact.mockRejectedValue(error)

        const { req } = createMocks({ method: 'POST' })

        await expect(
          runHandler(req, mockSession, {
            fingerprint: 'fp-error',
            name: 'Error User',
          })
        ).rejects.toThrow('Database connection failed')
      })

      it('should propagate errors from ensureUntrustedContact', async () => {
        const error = new Error('Validation failed')

        mockEnsureUntrustedContact.mockRejectedValue(error)

        const { req } = createMocks({ method: 'POST' })

        await expect(
          runHandler(req, mockSession, {
            name: 'Error User',
          })
        ).rejects.toThrow('Validation failed')
      })
    })
  })
})
