import {
  API_AUDIENCE,
  APP_AUDIENCE,
  ENDUSER_CONVERSATION_AUDIENCE,
  QUEUE_AUDIENCE,
  USER_AUDIENCE,
} from '@/lib/audience.consts'
import { schema } from '@/lib/joi.handler'
import { throwNotAuthenticated, throwNotAuthorized } from '@/lib/response'

import contactFingerprintSchema from '@/schemas/contactFingerprint'

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(),
  throwNotAuthorized: jest.fn(),
}))

describe('contactFingerprintSchema', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic validation', () => {
    const validate = async (schema, input, expected) => {
      const response = await schema.validateAsync(input)

      expect(response).toEqual(expected)
    }

    it('should correctly handle falsy values without session', async () => {
      const s = schema.object({
        contactFingerprint: contactFingerprintSchema,
      })

      await validate(s, {}, {})
      await validate(
        s,
        { contactFingerprint: null },
        { contactFingerprint: null }
      )
      await validate(s, { contactFingerprint: '' }, { contactFingerprint: '' })
    })

    it('should not strip whitespace-only values without context', async () => {
      const s = schema.object({
        contactFingerprint: contactFingerprintSchema,
      })

      const result = await s.validateAsync({ contactFingerprint: '  ' })

      expect(result).toEqual({ contactFingerprint: '  ' })
    })
  })

  describe('authentication checks', () => {
    it('should throw not authenticated when no user in session', async () => {
      const mockError = new Error('Not authenticated')

      throwNotAuthenticated.mockImplementation(() => {
        throw mockError
      })

      const context = { session: {} }

      await expect(
        contactFingerprintSchema.validateAsync('fp_test123_valid_fingerprint', {
          context,
        })
      ).rejects.toThrow('Not authenticated')

      expect(throwNotAuthenticated).toHaveBeenCalledWith()
    })

    it('should throw not authenticated when no payload in session', async () => {
      const mockError = new Error('Not authenticated')

      throwNotAuthenticated.mockImplementation(() => {
        throw mockError
      })

      const mockUser = { id: 'user-123' }
      const context = { session: { user: mockUser } }

      await expect(
        contactFingerprintSchema.validateAsync('fp_test123_valid_fingerprint', {
          context,
        })
      ).rejects.toThrow('Not authenticated')

      expect(throwNotAuthenticated).toHaveBeenCalledWith()
    })
  })

  describe('audience validation - authorized audiences', () => {
    it('should allow fingerprint with API_AUDIENCE', async () => {
      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: API_AUDIENCE }
      const context = { session: { user: mockUser, payload: mockPayload } }

      const result = await contactFingerprintSchema.validateAsync(
        'fp_api123_valid_fingerprint',
        {
          context,
        }
      )

      expect(result).toBe('fp_api123_valid_fingerprint')
      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should allow fingerprint with USER_AUDIENCE', async () => {
      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: USER_AUDIENCE }
      const context = { session: { user: mockUser, payload: mockPayload } }

      const result = await contactFingerprintSchema.validateAsync(
        'fp_user123_valid_fingerprint',
        {
          context,
        }
      )

      expect(result).toBe('fp_user123_valid_fingerprint')
      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should allow fingerprint with APP_AUDIENCE', async () => {
      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: APP_AUDIENCE }
      const context = { session: { user: mockUser, payload: mockPayload } }

      const result = await contactFingerprintSchema.validateAsync(
        'fp_app123_valid_fingerprint',
        {
          context,
        }
      )

      expect(result).toBe('fp_app123_valid_fingerprint')
      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should trim whitespace from fingerprint value', async () => {
      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: API_AUDIENCE }
      const context = { session: { user: mockUser, payload: mockPayload } }

      const result = await contactFingerprintSchema.validateAsync(
        '  fp_trimmed123_valid_fingerprint  ',
        { context }
      )

      expect(result).toBe('fp_trimmed123_valid_fingerprint')
    })
  })

  describe('audience validation - unauthorized audiences', () => {
    it('should throw not authorized with QUEUE_AUDIENCE', async () => {
      const mockError = new Error('Not authorized')

      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: QUEUE_AUDIENCE }
      const context = { session: { user: mockUser, payload: mockPayload } }

      await expect(
        contactFingerprintSchema.validateAsync(
          'fp_queue123_valid_fingerprint',
          { context }
        )
      ).rejects.toThrow('Not authorized')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        `Cannot use fingerprint with aud "${QUEUE_AUDIENCE}"`
      )
    })

    it('should throw not authorized with ENDUSER_CONVERSATION_AUDIENCE', async () => {
      const mockError = new Error('Not authorized')

      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: ENDUSER_CONVERSATION_AUDIENCE }
      const context = { session: { user: mockUser, payload: mockPayload } }

      await expect(
        contactFingerprintSchema.validateAsync(
          'fp_enduser123_valid_fingerprint',
          { context }
        )
      ).rejects.toThrow('Not authorized')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        `Cannot use fingerprint with aud "${ENDUSER_CONVERSATION_AUDIENCE}"`
      )
    })

    it('should throw not authorized with unknown audience', async () => {
      const mockError = new Error('Not authorized')

      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: 'unknown-audience' }
      const context = { session: { user: mockUser, payload: mockPayload } }

      await expect(
        contactFingerprintSchema.validateAsync(
          'fp_unknown123_valid_fingerprint',
          { context }
        )
      ).rejects.toThrow('Not authorized')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Cannot use fingerprint with aud "unknown-audience"'
      )
    })

    it('should throw not authorized with null audience', async () => {
      const mockError = new Error('Not authorized')

      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: null }
      const context = { session: { user: mockUser, payload: mockPayload } }

      await expect(
        contactFingerprintSchema.validateAsync('fp_null123_valid_fingerprint', {
          context,
        })
      ).rejects.toThrow('Not authorized')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Cannot use fingerprint with aud "null"'
      )
    })

    it('should throw not authorized with undefined audience', async () => {
      const mockError = new Error('Not authorized')

      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      const mockUser = { id: 'user-123' }
      const mockPayload = {}
      const context = { session: { user: mockUser, payload: mockPayload } }

      await expect(
        contactFingerprintSchema.validateAsync(
          'fp_undefined123_valid_fingerprint',
          { context }
        )
      ).rejects.toThrow('Not authorized')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Cannot use fingerprint with aud "undefined"'
      )
    })
  })

  describe('edge cases', () => {
    it('should allow null fingerprint even with unauthorized audience', async () => {
      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: QUEUE_AUDIENCE }
      const context = { session: { user: mockUser, payload: mockPayload } }

      const result = await contactFingerprintSchema.validateAsync(null, {
        context,
      })

      expect(result).toBeNull()
      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should allow empty string fingerprint even with unauthorized audience', async () => {
      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: QUEUE_AUDIENCE }
      const context = { session: { user: mockUser, payload: mockPayload } }

      const result = await contactFingerprintSchema.validateAsync('', {
        context,
      })

      expect(result).toBe('')
      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should allow whitespace-only fingerprint even with unauthorized audience', async () => {
      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: QUEUE_AUDIENCE }
      const context = { session: { user: mockUser, payload: mockPayload } }

      const result = await contactFingerprintSchema.validateAsync('   ', {
        context,
      })

      expect(result).toBe('   ')
      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should handle fingerprint in nested object with API_AUDIENCE', async () => {
      const s = schema.object({
        contact: schema.object({
          fingerprint: contactFingerprintSchema,
        }),
      })

      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: API_AUDIENCE }
      const context = { session: { user: mockUser, payload: mockPayload } }

      const result = await s.validateAsync(
        {
          contact: {
            fingerprint: 'fp_nested123_valid_fingerprint',
          },
        },
        { context }
      )

      expect(result).toEqual({
        contact: {
          fingerprint: 'fp_nested123_valid_fingerprint',
        },
      })
    })

    it('should reject fingerprint in nested object with unauthorized audience', async () => {
      const s = schema.object({
        contact: schema.object({
          fingerprint: contactFingerprintSchema,
        }),
      })

      const mockError = new Error('Not authorized')

      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: QUEUE_AUDIENCE }
      const context = { session: { user: mockUser, payload: mockPayload } }

      await expect(
        s.validateAsync(
          {
            contact: {
              fingerprint: 'fp_nested123_valid_fingerprint',
            },
          },
          { context }
        )
      ).rejects.toThrow('Not authorized')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        `Cannot use fingerprint with aud "${QUEUE_AUDIENCE}"`
      )
    })
  })

  describe('security enforcement', () => {
    it('should prevent fingerprint usage even if user is authenticated but audience is wrong', async () => {
      const mockError = new Error('Not authorized')

      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      // Simulate an authenticated user with wrong audience trying to use fingerprint
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockPayload = { aud: QUEUE_AUDIENCE, sub: 'user-123' }
      const context = { session: { user: mockUser, payload: mockPayload } }

      await expect(
        contactFingerprintSchema.validateAsync(
          'fp_secure123_valid_fingerprint',
          { context }
        )
      ).rejects.toThrow('Not authorized')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        `Cannot use fingerprint with aud "${QUEUE_AUDIENCE}"`
      )
    })

    it('should enforce audience check after authentication check', async () => {
      const mockError = new Error('Not authorized')

      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      // Valid user but invalid audience
      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: 'custom-audience' }
      const context = { session: { user: mockUser, payload: mockPayload } }

      await expect(
        contactFingerprintSchema.validateAsync('fp_test_valid_fingerprint', {
          context,
        })
      ).rejects.toThrow('Not authorized')

      // Should call throwNotAuthorized, not throwNotAuthenticated
      expect(throwNotAuthenticated).not.toHaveBeenCalled()
      expect(throwNotAuthorized).toHaveBeenCalledWith(
        'Cannot use fingerprint with aud "custom-audience"'
      )
    })

    it('should allow fingerprint only when both user AND correct audience present', async () => {
      const mockUser = { id: 'user-123' }
      const mockPayload = { aud: API_AUDIENCE }
      const context = { session: { user: mockUser, payload: mockPayload } }

      const result = await contactFingerprintSchema.validateAsync(
        'fp_valid123_valid_fingerprint',
        { context }
      )

      expect(result).toBe('fp_valid123_valid_fingerprint')
      expect(throwNotAuthenticated).not.toHaveBeenCalled()
      expect(throwNotAuthorized).not.toHaveBeenCalled()
    })

    it('should block fingerprint if switching from valid to invalid audience', async () => {
      const mockError = new Error('Not authorized')

      throwNotAuthorized.mockImplementation(() => {
        throw mockError
      })

      const mockUser = { id: 'user-123' }

      // First call with valid audience should succeed
      let context = {
        session: { user: mockUser, payload: { aud: API_AUDIENCE } },
      }
      const validResult = await contactFingerprintSchema.validateAsync(
        'fp_test123_valid_fingerprint',
        { context }
      )

      expect(validResult).toBe('fp_test123_valid_fingerprint')

      // Second call with invalid audience should fail
      context = {
        session: { user: mockUser, payload: { aud: QUEUE_AUDIENCE } },
      }
      await expect(
        contactFingerprintSchema.validateAsync('fp_test456_valid_fingerprint', {
          context,
        })
      ).rejects.toThrow('Not authorized')

      expect(throwNotAuthorized).toHaveBeenCalledWith(
        `Cannot use fingerprint with aud "${QUEUE_AUDIENCE}"`
      )
    })
  })
})
