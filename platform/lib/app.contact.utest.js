import { withCache } from '@/lib/app.cache'
import { getSessionClient } from '@/lib/cbk.sdk'
import { createContactFingerprint } from '@/lib/contact.create'
import { isValidEmail } from '@/lib/email.validation'

import { buildContact, ensureContact } from './app.contact'

jest.mock('@/lib/app.cache', () => ({
  withCache: jest.fn(),
}))

jest.mock('@/lib/cbk.sdk', () => ({
  getSessionClient: jest.fn(),
}))

jest.mock('@/lib/contact.create', () => ({
  createContactFingerprint: jest.fn(),
}))

jest.mock('@/lib/email.validation', () => ({
  isValidEmail: jest.fn(),
}))

describe('app.contact', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('buildContact', () => {
    describe('portal sessions', () => {
      it('should build contact for portal session with valid email', async () => {
        const namespace = 'test-namespace'
        const session = {
          options: {
            portalId: 'portal-123',
            portalUserId: 'user@example.com',
          },
          user: {
            id: 'user-456',
            name: 'Test User',
            email: 'test@example.com',
          },
        }
        const app = 'test-app'

        createContactFingerprint.mockReturnValue('fingerprint-123')
        isValidEmail.mockReturnValue(true)

        const result = await buildContact({ namespace, session, app })

        expect(createContactFingerprint).toHaveBeenCalledWith(namespace, [
          'portal-123',
          'user@example.com',
        ])
        expect(isValidEmail).toHaveBeenCalledWith('user@example.com')
        expect(result).toEqual({
          fingerprint: 'fingerprint-123',
          name: 'user@example.com',
          email: 'user@example.com',
          meta: {
            app: 'test-app',
          },
        })
      })

      it('should build contact for portal session with invalid email', async () => {
        const namespace = 'test-namespace'
        const session = {
          options: {
            portalId: 'portal-123',
            portalUserId: 'not-an-email',
          },
          user: {
            id: 'user-456',
            name: 'Test User',
            email: 'test@example.com',
          },
        }

        createContactFingerprint.mockReturnValue('fingerprint-456')
        isValidEmail.mockReturnValue(false)

        const result = await buildContact({ namespace, session })

        expect(isValidEmail).toHaveBeenCalledWith('not-an-email')
        expect(result).toEqual({
          fingerprint: 'fingerprint-456',
          name: 'not-an-email',
          email: undefined,
          meta: {},
        })
      })

      it('should build contact without app parameter', async () => {
        const namespace = 'test-namespace'
        const session = {
          options: {
            portalId: 'portal-123',
            portalUserId: 'user@example.com',
          },
          user: {
            id: 'user-456',
          },
        }

        createContactFingerprint.mockReturnValue('fingerprint-789')
        isValidEmail.mockReturnValue(true)

        const result = await buildContact({ namespace, session })

        expect(result.meta).toEqual({})
      })
    })

    describe('regular user sessions', () => {
      it('should build contact for regular user session', async () => {
        const namespace = 'test-namespace'
        const session = {
          options: {},
          user: {
            id: 'user-123',
            name: 'John Doe',
            email: 'john@example.com',
          },
        }
        const app = 'test-app'

        createContactFingerprint.mockReturnValue('fingerprint-regular')

        const result = await buildContact({ namespace, session, app })

        expect(createContactFingerprint).toHaveBeenCalledWith(namespace, [
          'user-123',
        ])
        expect(result).toEqual({
          fingerprint: 'fingerprint-regular',
          name: 'John Doe',
          email: 'john@example.com',
          meta: {
            app: 'test-app',
          },
        })
      })

      it('should build contact for user without name', async () => {
        const namespace = 'test-namespace'
        const session = {
          options: {},
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        }

        createContactFingerprint.mockReturnValue('fingerprint-no-name')

        const result = await buildContact({ namespace, session })

        expect(result).toEqual({
          fingerprint: 'fingerprint-no-name',
          name: undefined,
          email: 'test@example.com',
          meta: {},
        })
      })

      it('should build contact for user without email', async () => {
        const namespace = 'test-namespace'
        const session = {
          options: {},
          user: {
            id: 'user-123',
            name: 'Test User',
          },
        }

        createContactFingerprint.mockReturnValue('fingerprint-no-email')

        const result = await buildContact({ namespace, session })

        expect(result).toEqual({
          fingerprint: 'fingerprint-no-email',
          name: 'Test User',
          email: undefined,
          meta: {},
        })
      })
    })

    describe('edge cases', () => {
      it('should handle empty namespace', async () => {
        const namespace = ''
        const session = {
          options: {},
          user: {
            id: 'user-123',
            name: 'Test',
            email: 'test@example.com',
          },
        }

        createContactFingerprint.mockReturnValue('fingerprint-empty-ns')

        const result = await buildContact({ namespace, session })

        expect(createContactFingerprint).toHaveBeenCalledWith('', ['user-123'])
        expect(result.fingerprint).toBe('fingerprint-empty-ns')
      })

      it('should handle portal session with empty portal user id', async () => {
        const namespace = 'test-namespace'
        const session = {
          options: {
            portalId: 'portal-123',
            portalUserId: '',
          },
          user: {
            id: 'user-123',
          },
        }

        createContactFingerprint.mockReturnValue(
          'fingerprint-empty-portal-user'
        )
        isValidEmail.mockReturnValue(false)

        const result = await buildContact({ namespace, session })

        // Empty string is falsy, so the condition (portalId && portalUserId) fails
        // and it falls back to regular user session behavior

        expect(result.fingerprint).toBe('fingerprint-empty-portal-user')
        expect(result.name).toBeUndefined() // session.user.name is undefined
        expect(result.email).toBeUndefined()
      })
    })
  })

  describe('ensureContact', () => {
    it('should ensure contact with caching', async () => {
      const namespace = 'test-namespace'
      const session = {
        options: {},
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
        },
      }
      const app = 'test-app'

      const mockUserClient = {
        contact: {
          ensure: jest.fn().mockResolvedValue({
            id: 'contact-123',
            fingerprint: 'fingerprint-test',
          }),
        },
      }

      getSessionClient.mockResolvedValue(mockUserClient)
      createContactFingerprint.mockReturnValue('fingerprint-test')

      // Mock withCache to execute the callback immediately
      withCache.mockImplementation(async (fn) => await fn())

      const result = await ensureContact({ namespace, session, app })

      expect(getSessionClient).toHaveBeenCalledWith(session)
      expect(withCache).toHaveBeenCalled()
      expect(mockUserClient.contact.ensure).toHaveBeenCalledWith(
        expect.objectContaining({
          fingerprint: 'fingerprint-test',
          name: 'Test User',
          email: 'test@example.com',
          meta: {
            app: 'app',
          },
          verifiedAt: expect.any(Number),
        })
      )
      expect(result).toEqual({
        id: 'contact-123',
        fingerprint: 'fingerprint-test',
      })
    })

    it('should handle portal session in ensureContact', async () => {
      const namespace = 'test-namespace'
      const session = {
        options: {
          portalId: 'portal-123',
          portalUserId: 'portal-user@example.com',
        },
        user: {
          id: 'user-456',
        },
      }
      const app = 'portal-app'

      const mockUserClient = {
        contact: {
          ensure: jest.fn().mockResolvedValue({
            id: 'contact-portal',
            fingerprint: 'fingerprint-portal',
          }),
        },
      }

      getSessionClient.mockResolvedValue(mockUserClient)
      createContactFingerprint.mockReturnValue('fingerprint-portal')
      isValidEmail.mockReturnValue(true)

      withCache.mockImplementation(async (fn) => await fn())

      const result = await ensureContact({ namespace, session, app })

      expect(mockUserClient.contact.ensure).toHaveBeenCalledWith(
        expect.objectContaining({
          fingerprint: 'fingerprint-portal',
          email: 'portal-user@example.com',
          verifiedAt: expect.any(Number),
        })
      )
      expect(result).toEqual({
        id: 'contact-portal',
        fingerprint: 'fingerprint-portal',
      })
    })

    it('should handle contact with null fingerprint', async () => {
      const namespace = 'test-namespace'
      const session = {
        options: {},
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
        },
      }
      const app = 'test-app'

      const mockUserClient = {
        contact: {
          ensure: jest.fn().mockResolvedValue({
            id: 'contact-null-fingerprint',
            fingerprint: null,
          }),
        },
      }

      getSessionClient.mockResolvedValue(mockUserClient)
      createContactFingerprint.mockReturnValue(null)

      withCache.mockImplementation(async (fn) => await fn())

      const result = await ensureContact({ namespace, session, app })

      expect(mockUserClient.contact.ensure).toHaveBeenCalledWith(
        expect.objectContaining({
          fingerprint: null,
          name: 'Test User',
          email: 'test@example.com',
        })
      )
      expect(result).toEqual({
        id: 'contact-null-fingerprint',
        fingerprint: null,
      })
    })

    it('should pass cache options correctly', async () => {
      const namespace = 'test-namespace'
      const session = {
        options: {},
        user: {
          id: 'user-123',
          name: 'Test',
          email: 'test@example.com',
        },
      }
      const app = 'cache-test-app'

      const mockUserClient = {
        contact: {
          ensure: jest.fn().mockResolvedValue({
            id: 'contact-cache',
          }),
        },
      }

      getSessionClient.mockResolvedValue(mockUserClient)
      createContactFingerprint.mockReturnValue('fingerprint-cache')

      withCache.mockImplementation(async (fn) => await fn())

      await ensureContact({ namespace, session, app })

      expect(withCache).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          app: 'cache-test-app',
          category: 'contact',
          session: session,
          timeInSeconds: 86400, // ONE_DAY_IN_SECONDS
        })
      )
    })

    it('should handle contact.ensure errors', async () => {
      const namespace = 'test-namespace'
      const session = {
        options: {},
        user: {
          id: 'user-123',
          name: 'Test',
          email: 'test@example.com',
        },
      }
      const app = 'error-app'

      const mockUserClient = {
        contact: {
          ensure: jest
            .fn()
            .mockRejectedValue(new Error('Contact ensure failed')),
        },
      }

      getSessionClient.mockResolvedValue(mockUserClient)
      createContactFingerprint.mockReturnValue('fingerprint-error')

      withCache.mockImplementation(async (fn) => await fn())

      await expect(ensureContact({ namespace, session, app })).rejects.toThrow(
        'Contact ensure failed'
      )
    })
  })
})
