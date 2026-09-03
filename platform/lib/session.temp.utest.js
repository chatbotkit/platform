import { API_AUDIENCE, USER_AUDIENCE } from '@/lib/audience.consts'

import * as jwt from '@/lib/jwt'
import {
  getTemporaryAPISessionToken,
  getTemporaryUserSessionToken,
  getTemporaryUserToken,
} from '@/lib/session.temp'

jest.mock('@/lib/jwt', () => ({
  sign: jest.fn(),
  verify: jest.requireActual('@/lib/jwt').verify,
}))

describe('getTemporaryUserToken (unit tests with mocks)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jwt.sign.mockResolvedValue('mock-jwt-token')
  })

  describe('token generation', () => {
    it('should generate token with default duration', async () => {
      const mockToken = 'mock-jwt-token'

      jwt.sign.mockResolvedValue(mockToken)

      const userId = 'user-123'
      const result = await getTemporaryUserToken(userId)

      expect(result).toBe(mockToken)
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user-123' },
        900, // 15 minutes = 900 seconds
        USER_AUDIENCE
      )
    })

    it('should generate token with custom duration', async () => {
      const mockToken = 'mock-jwt-token-custom'

      jwt.sign.mockResolvedValue(mockToken)

      const userId = 'user-456'
      const customDuration = 1800 // 30 minutes
      const result = await getTemporaryUserToken(userId, {
        durationInSeconds: customDuration,
      })

      expect(result).toBe(mockToken)
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user-456' },
        1800,
        USER_AUDIENCE
      )
    })

    it('should generate token with very short duration', async () => {
      const mockToken = 'mock-jwt-token-short'

      jwt.sign.mockResolvedValue(mockToken)

      const userId = 'user-789'
      const shortDuration = 60 // 1 minute
      const result = await getTemporaryUserToken(userId, {
        durationInSeconds: shortDuration,
      })

      expect(result).toBe(mockToken)
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user-789' },
        60,
        USER_AUDIENCE
      )
    })

    it('should generate token with long duration', async () => {
      const mockToken = 'mock-jwt-token-long'

      jwt.sign.mockResolvedValue(mockToken)

      const userId = 'user-abc'
      const longDuration = 7200 // 2 hours
      const result = await getTemporaryUserToken(userId, {
        durationInSeconds: longDuration,
      })

      expect(result).toBe(mockToken)
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user-abc' },
        7200,
        USER_AUDIENCE
      )
    })
  })

  describe('payload structure', () => {
    it('should include userId in payload', async () => {
      jwt.sign.mockResolvedValue('token')

      await getTemporaryUserToken('test-user-id')

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).toHaveProperty('userId')
      expect(payload.userId).toBe('test-user-id')
    })

    it('should only include userId in payload', async () => {
      jwt.sign.mockResolvedValue('token')

      await getTemporaryUserToken('test-user-id')

      const payload = jwt.sign.mock.calls[0][0]

      expect(Object.keys(payload)).toEqual(['userId'])
    })
  })

  describe('audience', () => {
    it('should use USER_AUDIENCE for all tokens', async () => {
      jwt.sign.mockResolvedValue('token')

      await getTemporaryUserToken('user-1')

      const audience = jwt.sign.mock.calls[0][2]

      expect(audience).toBe(USER_AUDIENCE)
    })
  })

  describe('edge cases', () => {
    it('should handle empty userId string', async () => {
      jwt.sign.mockResolvedValue('token')

      const result = await getTemporaryUserToken('')

      expect(result).toBe('token')
      expect(jwt.sign).toHaveBeenCalledWith({ userId: '' }, 900, USER_AUDIENCE)
    })

    it('should handle userId with special characters', async () => {
      jwt.sign.mockResolvedValue('token')

      const specialUserId = 'user-@#$%^&*()'
      const result = await getTemporaryUserToken(specialUserId)

      expect(result).toBe('token')
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: specialUserId },
        900,
        USER_AUDIENCE
      )
    })

    it('should handle zero duration', async () => {
      jwt.sign.mockResolvedValue('token')

      const result = await getTemporaryUserToken('user-123', {
        durationInSeconds: 0,
      })

      expect(result).toBe('token')
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user-123' },
        0,
        USER_AUDIENCE
      )
    })

    it('should handle negative duration', async () => {
      jwt.sign.mockResolvedValue('token')

      const result = await getTemporaryUserToken('user-123', {
        durationInSeconds: -100,
      })

      expect(result).toBe('token')
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user-123' },
        -100,
        USER_AUDIENCE
      )
    })
  })

  describe('error handling', () => {
    it('should propagate errors from jwt.sign', async () => {
      const mockError = new Error('JWT signing failed')

      jwt.sign.mockRejectedValue(mockError)

      await expect(getTemporaryUserToken('user-123')).rejects.toThrow(
        'JWT signing failed'
      )
    })

    it('should propagate specific JWT errors', async () => {
      const jwtError = new Error('Invalid secret key')

      jwt.sign.mockRejectedValue(jwtError)

      await expect(getTemporaryUserToken('user-456')).rejects.toThrow(
        'Invalid secret key'
      )
    })
  })

  describe('return value', () => {
    it('should return string token', async () => {
      jwt.sign.mockResolvedValue('valid-jwt-token-string')

      const result = await getTemporaryUserToken('user-123')

      expect(typeof result).toBe('string')
      expect(result).toBe('valid-jwt-token-string')
    })
  })
})

describe('getTemporarySessionToken (unit tests with mocks)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jwt.sign.mockResolvedValue('mock-session-jwt-token')
  })

  describe('token generation', () => {
    it('should generate token with default duration', async () => {
      const mockToken = 'mock-session-jwt-token'

      jwt.sign.mockResolvedValue(mockToken)

      const session = { id: 'session-123', user: { id: 'user-123' } }
      const result = await getTemporaryUserSessionToken(session)

      expect(result).toBe(mockToken)
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'session-123', userId: 'user-123' },
        900, // 15 minutes = 900 seconds
        USER_AUDIENCE
      )
    })

    it('should generate token with custom duration', async () => {
      const mockToken = 'mock-session-jwt-token-custom'

      jwt.sign.mockResolvedValue(mockToken)

      const session = { id: 'session-456', user: { id: 'user-456' } }
      const customDuration = 1800 // 30 minutes
      const result = await getTemporaryUserSessionToken(session, {
        durationInSeconds: customDuration,
      })

      expect(result).toBe(mockToken)
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'session-456', userId: 'user-456' },
        1800,
        USER_AUDIENCE
      )
    })

    it('should generate token with very short duration', async () => {
      const mockToken = 'mock-session-jwt-token-short'

      jwt.sign.mockResolvedValue(mockToken)

      const session = { id: 'session-789', user: { id: 'user-789' } }
      const shortDuration = 60 // 1 minute
      const result = await getTemporaryUserSessionToken(session, {
        durationInSeconds: shortDuration,
      })

      expect(result).toBe(mockToken)
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'session-789', userId: 'user-789' },
        60,
        USER_AUDIENCE
      )
    })

    it('should generate token with long duration', async () => {
      const mockToken = 'mock-session-jwt-token-long'

      jwt.sign.mockResolvedValue(mockToken)

      const session = { id: 'session-abc', user: { id: 'user-abc' } }
      const longDuration = 7200 // 2 hours
      const result = await getTemporaryUserSessionToken(session, {
        durationInSeconds: longDuration,
      })

      expect(result).toBe(mockToken)
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'session-abc', userId: 'user-abc' },
        7200,
        USER_AUDIENCE
      )
    })
  })

  describe('payload structure', () => {
    it('should include sub and userId in payload', async () => {
      jwt.sign.mockResolvedValue('token')

      await getTemporaryUserSessionToken({
        id: 'test-session-id',
        user: { id: 'test-user-id' },
      })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).toHaveProperty('sub')
      expect(payload).toHaveProperty('userId')
      expect(payload.sub).toBe('test-session-id')
      expect(payload.userId).toBe('test-user-id')
    })

    it('should only include sub and userId in payload', async () => {
      jwt.sign.mockResolvedValue('token')

      await getTemporaryUserSessionToken({
        id: 'test-session-id',
        user: { id: 'test-user-id' },
      })

      const payload = jwt.sign.mock.calls[0][0]

      expect(Object.keys(payload).sort()).toEqual(['sub', 'userId'].sort())
    })

    it('should use session.id as sub claim', async () => {
      jwt.sign.mockResolvedValue('token')

      await getTemporaryUserSessionToken({
        id: 'my-session-id',
        user: { id: 'my-user-id' },
      })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload.sub).toBe('my-session-id')
    })

    it('should use session.user.id as userId claim', async () => {
      jwt.sign.mockResolvedValue('token')

      await getTemporaryUserSessionToken({
        id: 'my-session-id',
        user: { id: 'my-user-id' },
      })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload.userId).toBe('my-user-id')
    })
  })

  describe('audience', () => {
    it('should use USER_AUDIENCE for all tokens', async () => {
      jwt.sign.mockResolvedValue('token')

      await getTemporaryUserSessionToken({
        id: 'session-1',
        user: { id: 'user-1' },
      })

      const audience = jwt.sign.mock.calls[0][2]

      expect(audience).toBe(USER_AUDIENCE)
    })
  })

  describe('edge cases', () => {
    it('should handle empty session id string', async () => {
      jwt.sign.mockResolvedValue('token')

      const result = await getTemporaryUserSessionToken({
        id: '',
        user: { id: 'user-123' },
      })

      expect(result).toBe('token')
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: '', userId: 'user-123' },
        900,
        USER_AUDIENCE
      )
    })

    it('should handle empty userId string', async () => {
      jwt.sign.mockResolvedValue('token')

      const result = await getTemporaryUserSessionToken({
        id: 'session-123',
        user: { id: '' },
      })

      expect(result).toBe('token')
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'session-123', userId: '' },
        900,
        USER_AUDIENCE
      )
    })

    it('should handle session id with special characters', async () => {
      jwt.sign.mockResolvedValue('token')

      const specialSessionId = 'session-@#$%^&*()'
      const result = await getTemporaryUserSessionToken({
        id: specialSessionId,
        user: { id: 'user-123' },
      })

      expect(result).toBe('token')
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: specialSessionId, userId: 'user-123' },
        900,
        USER_AUDIENCE
      )
    })

    it('should handle zero duration', async () => {
      jwt.sign.mockResolvedValue('token')

      const result = await getTemporaryUserSessionToken(
        { id: 'session-123', user: { id: 'user-123' } },
        { durationInSeconds: 0 }
      )

      expect(result).toBe('token')
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'session-123', userId: 'user-123' },
        0,
        USER_AUDIENCE
      )
    })

    it('should handle negative duration', async () => {
      jwt.sign.mockResolvedValue('token')

      const result = await getTemporaryUserSessionToken(
        { id: 'session-123', user: { id: 'user-123' } },
        { durationInSeconds: -100 }
      )

      expect(result).toBe('token')
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'session-123', userId: 'user-123' },
        -100,
        USER_AUDIENCE
      )
    })
  })

  describe('error handling', () => {
    it('should propagate errors from jwt.sign', async () => {
      const mockError = new Error('JWT signing failed')

      jwt.sign.mockRejectedValue(mockError)

      await expect(
        getTemporaryUserSessionToken({
          id: 'session-123',
          user: { id: 'user-123' },
        })
      ).rejects.toThrow('JWT signing failed')
    })

    it('should propagate specific JWT errors', async () => {
      const jwtError = new Error('Invalid secret key')

      jwt.sign.mockRejectedValue(jwtError)

      await expect(
        getTemporaryUserSessionToken({
          id: 'session-456',
          user: { id: 'user-456' },
        })
      ).rejects.toThrow('Invalid secret key')
    })
  })

  describe('return value', () => {
    it('should return string token', async () => {
      jwt.sign.mockResolvedValue('valid-session-jwt-token-string')

      const result = await getTemporaryUserSessionToken({
        id: 'session-123',
        user: { id: 'user-123' },
      })

      expect(typeof result).toBe('string')
      expect(result).toBe('valid-session-jwt-token-string')
    })
  })

  describe('path restrictions', () => {
    it('should include allowedRoutes in payload when provided', async () => {
      jwt.sign.mockResolvedValue('token-with-paths')

      const session = { id: 'session-123', user: { id: 'user-123' } }
      const allowedRoutes = ['/api/v1/bot/**', '/api/v1/dataset/**']

      await getTemporaryUserSessionToken(session, { allowedRoutes })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).toHaveProperty('allowedRoutes')
      expect(payload.allowedRoutes).toEqual([
        '/api/v1/bot/**',
        '/api/v1/dataset/**',
      ])
    })

    it('should not include allowedRoutes when not provided', async () => {
      jwt.sign.mockResolvedValue('token-without-paths')

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await getTemporaryUserSessionToken(session)

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).not.toHaveProperty('allowedRoutes')
    })

    it('should include empty allowedRoutes array when explicitly provided (secure default)', async () => {
      jwt.sign.mockResolvedValue('token-no-routes')

      const session = { id: 'session-123', user: { id: 'user-123' } }
      const allowedRoutes = []

      await getTemporaryUserSessionToken(session, { allowedRoutes })

      const payload = jwt.sign.mock.calls[0][0]

      // @note empty array should be passed through to block all routes (security)
      expect(payload).toHaveProperty('allowedRoutes')
      expect(payload.allowedRoutes).toEqual([])
    })

    it('should handle single path pattern', async () => {
      jwt.sign.mockResolvedValue('token-single-path')

      const session = { id: 'session-123', user: { id: 'user-123' } }
      const allowedRoutes = ['/api/v1/bot/**']

      await getTemporaryUserSessionToken(session, { allowedRoutes })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload.allowedRoutes).toEqual(['/api/v1/bot/**'])
    })

    it('should handle multiline path patterns', async () => {
      jwt.sign.mockResolvedValue('token-multiline-paths')

      const session = { id: 'session-123', user: { id: 'user-123' } }
      const allowedRoutes = [
        '/api/v1/bot/**',
        '/api/v1/dataset/**',
        '/api/v1/conversation/**',
      ]

      await getTemporaryUserSessionToken(session, { allowedRoutes })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload.allowedRoutes).toEqual([
        '/api/v1/bot/**',
        '/api/v1/dataset/**',
        '/api/v1/conversation/**',
      ])
    })

    it('should handle path patterns with negation', async () => {
      jwt.sign.mockResolvedValue('token-negation-paths')

      const session = { id: 'session-123', user: { id: 'user-123' } }
      const allowedRoutes = ['/api/v1/**', '!/api/v1/admin/**']

      await getTemporaryUserSessionToken(session, { allowedRoutes })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload.allowedRoutes).toEqual(['/api/v1/**', '!/api/v1/admin/**'])
    })

    it('should work with both duration and allowedRoutes', async () => {
      jwt.sign.mockResolvedValue('token-both-options')

      const session = { id: 'session-123', user: { id: 'user-123' } }
      const customDuration = 1800
      const allowedRoutes = ['/api/v1/bot/**']

      await getTemporaryUserSessionToken(session, {
        durationInSeconds: customDuration,
        allowedRoutes,
      })

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          sub: 'session-123',
          userId: 'user-123',
          allowedRoutes: ['/api/v1/bot/**'],
        },
        1800,
        expect.anything()
      )
    })
  })

  describe('contactId propagation', () => {
    it('should include contactId in payload when provided', async () => {
      jwt.sign.mockResolvedValue('token-with-contact')

      const session = { id: 'session-123', user: { id: 'user-123' } }
      const contactId = 'contact-456'

      await getTemporaryUserSessionToken(session, { contactId })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).toHaveProperty('contactId')
      expect(payload.contactId).toBe('contact-456')
    })

    it('should not include contactId when not provided', async () => {
      jwt.sign.mockResolvedValue('token-without-contact')

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await getTemporaryUserSessionToken(session)

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).not.toHaveProperty('contactId')
    })

    it('should not include contactId when undefined', async () => {
      jwt.sign.mockResolvedValue('token-undefined-contact')

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await getTemporaryUserSessionToken(session, { contactId: undefined })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).not.toHaveProperty('contactId')
    })
  })

  describe('namespace propagation', () => {
    it('should include namespace in payload when provided', async () => {
      jwt.sign.mockResolvedValue('token-with-namespace')

      const session = { id: 'session-123', user: { id: 'user-123' } }
      const namespace = 'my-namespace'

      await getTemporaryUserSessionToken(session, { namespace })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).toHaveProperty('namespace')
      expect(payload.namespace).toBe('my-namespace')
    })

    it('should not include namespace when not provided', async () => {
      jwt.sign.mockResolvedValue('token-without-namespace')

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await getTemporaryUserSessionToken(session)

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).not.toHaveProperty('namespace')
    })

    it('should not include namespace when undefined', async () => {
      jwt.sign.mockResolvedValue('token-undefined-namespace')

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await getTemporaryUserSessionToken(session, { namespace: undefined })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).not.toHaveProperty('namespace')
    })
  })

  describe('combined options', () => {
    it('should include contactId, namespace, allowedRoutes together', async () => {
      jwt.sign.mockResolvedValue('token-all-options')

      const session = { id: 'session-123', user: { id: 'user-123' } }

      await getTemporaryUserSessionToken(session, {
        durationInSeconds: 1800,
        allowedRoutes: ['/api/v1/skillset/*/ability/*/exec'],
        contactId: 'contact-789',
        namespace: 'test-namespace',
      })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).toEqual({
        sub: 'session-123',
        userId: 'user-123',
        allowedRoutes: ['/api/v1/skillset/*/ability/*/exec'],
        contactId: 'contact-789',
        namespace: 'test-namespace',
      })
    })
  })
})

describe('getTemporaryAPISessionToken (unit tests with mocks)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jwt.sign.mockResolvedValue('mock-api-session-jwt-token')
  })

  it('should generate API-scoped token with default duration', async () => {
    const session = { id: 'session-api-123', user: { id: 'user-123' } }

    const result = await getTemporaryAPISessionToken(session)

    expect(result).toBe('mock-api-session-jwt-token')
    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: 'session-api-123', userId: 'user-123' },
      900,
      API_AUDIENCE
    )
  })

  it('should forward API session options into the payload', async () => {
    const session = { id: 'session-api-456', user: { id: 'user-456' } }

    await getTemporaryAPISessionToken(session, {
      durationInSeconds: 1800,
      allowedRoutes: ['/bot/**'],
      contactId: 'contact_1',
      namespace: 'unstable-ns',
    })

    expect(jwt.sign).toHaveBeenCalledWith(
      {
        sub: 'session-api-456',
        userId: 'user-456',
        allowedRoutes: ['/bot/**'],
        contactId: 'contact_1',
        namespace: 'unstable-ns',
      },
      1800,
      API_AUDIENCE
    )
  })
})

describe('getTemporaryUserToken path restrictions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('path restrictions', () => {
    it('should include allowedRoutes in payload when provided', async () => {
      jwt.sign.mockResolvedValue('token-with-paths')

      const userId = 'user-123'
      const allowedRoutes = ['/api/v1/bot/**', '/api/v1/dataset/**']

      await getTemporaryUserToken(userId, { allowedRoutes })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).toHaveProperty('allowedRoutes')
      expect(payload.allowedRoutes).toEqual([
        '/api/v1/bot/**',
        '/api/v1/dataset/**',
      ])
    })

    it('should not include allowedRoutes when not provided', async () => {
      jwt.sign.mockResolvedValue('token-without-paths')

      const userId = 'user-123'

      await getTemporaryUserToken(userId)

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).not.toHaveProperty('allowedRoutes')
    })

    it('should include empty allowedRoutes array when explicitly provided (secure default)', async () => {
      jwt.sign.mockResolvedValue('token-no-routes')

      const userId = 'user-123'
      const allowedRoutes = []

      await getTemporaryUserToken(userId, { allowedRoutes })

      const payload = jwt.sign.mock.calls[0][0]

      // @note empty array should be passed through to block all routes (security)
      expect(payload).toHaveProperty('allowedRoutes')
      expect(payload.allowedRoutes).toEqual([])
    })

    it('should handle single path pattern', async () => {
      jwt.sign.mockResolvedValue('token-single-path')

      const userId = 'user-123'
      const allowedRoutes = ['/api/v1/bot/**']

      await getTemporaryUserToken(userId, { allowedRoutes })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload.allowedRoutes).toEqual(['/api/v1/bot/**'])
    })

    it('should work with both duration and allowedRoutes', async () => {
      jwt.sign.mockResolvedValue('token-both-options')

      const userId = 'user-123'
      const customDuration = 1800
      const allowedRoutes = ['/api/v1/bot/**']

      await getTemporaryUserToken(userId, {
        durationInSeconds: customDuration,
        allowedRoutes,
      })

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user-123', allowedRoutes: ['/api/v1/bot/**'] },
        1800,
        expect.anything()
      )
    })
  })

  describe('contactId propagation', () => {
    it('should include contactId in payload when provided', async () => {
      jwt.sign.mockResolvedValue('token-with-contact')

      const userId = 'user-123'
      const contactId = 'contact-456'

      await getTemporaryUserToken(userId, { contactId })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).toHaveProperty('contactId')
      expect(payload.contactId).toBe('contact-456')
    })

    it('should not include contactId when not provided', async () => {
      jwt.sign.mockResolvedValue('token-without-contact')

      const userId = 'user-123'

      await getTemporaryUserToken(userId)

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).not.toHaveProperty('contactId')
    })

    it('should not include contactId when undefined', async () => {
      jwt.sign.mockResolvedValue('token-undefined-contact')

      const userId = 'user-123'

      await getTemporaryUserToken(userId, { contactId: undefined })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).not.toHaveProperty('contactId')
    })
  })

  describe('namespace propagation', () => {
    it('should include namespace in payload when provided', async () => {
      jwt.sign.mockResolvedValue('token-with-namespace')

      const userId = 'user-123'
      const namespace = 'my-namespace'

      await getTemporaryUserToken(userId, { namespace })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).toHaveProperty('namespace')
      expect(payload.namespace).toBe('my-namespace')
    })

    it('should not include namespace when not provided', async () => {
      jwt.sign.mockResolvedValue('token-without-namespace')

      const userId = 'user-123'

      await getTemporaryUserToken(userId)

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).not.toHaveProperty('namespace')
    })

    it('should not include namespace when undefined', async () => {
      jwt.sign.mockResolvedValue('token-undefined-namespace')

      const userId = 'user-123'

      await getTemporaryUserToken(userId, { namespace: undefined })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).not.toHaveProperty('namespace')
    })
  })

  describe('combined options', () => {
    it('should include contactId, namespace, allowedRoutes together', async () => {
      jwt.sign.mockResolvedValue('token-all-options')

      const userId = 'user-123'

      await getTemporaryUserToken(userId, {
        durationInSeconds: 1800,
        allowedRoutes: ['/api/v1/skillset/*/ability/*/exec'],
        contactId: 'contact-789',
        namespace: 'test-namespace',
      })

      const payload = jwt.sign.mock.calls[0][0]

      expect(payload).toEqual({
        userId: 'user-123',
        allowedRoutes: ['/api/v1/skillset/*/ability/*/exec'],
        contactId: 'contact-789',
        namespace: 'test-namespace',
      })
    })
  })
})

// @note unit tests without mocks - using real JWT to test end-to-end token flow
describe('Path-Restricted Temporary Session Tokens (unit tests without mocks)', () => {
  let realJwt, realGetPayloadVerifier, realGetTemporarySessionToken

  beforeAll(async () => {
    // @note use isolateModules to get unmocked versions
    await jest.isolateModulesAsync(async () => {
      // Clear the mock within this isolated context
      jest.unmock('@/lib/jwt')

      realJwt = await import('@/lib/jwt')

      const tokenModule = await import('@/lib/token')

      realGetPayloadVerifier = tokenModule.getPayloadVerifier

      const sessionModule = await import('@/lib/session.temp')

      realGetTemporarySessionToken = sessionModule.getTemporaryUserSessionToken
    })
  })

  describe('End-to-End Token Flow', () => {
    it('should create token with path restrictions and validate correctly', async () => {
      const session = {
        id: 'session-test',
        user: { id: 'user-test' },
      }

      const token = await realGetTemporarySessionToken(session, {
        durationInSeconds: 900,
        allowedRoutes: ['/api/v1/bot/**'],
      })

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')

      const payload = await realJwt.verify(token)

      expect(payload.allowedRoutes).toEqual(['/api/v1/bot/**'])
      expect(payload.userId).toBe('user-test')
      expect(payload.sub).toBe('session-test')
      expect(payload.aud).toBe(USER_AUDIENCE)

      const verifier = await realGetPayloadVerifier(payload)

      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/bot/list' })
      ).not.toThrow()
      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/bot/123/fetch' })
      ).not.toThrow()
      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/dataset/list' })
      ).toThrow()
      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/admin/users' })
      ).toThrow()
    })

    it('should support multiple path patterns', async () => {
      const session = {
        id: 'session-multi',
        user: { id: 'user-multi' },
      }

      const token = await realGetTemporarySessionToken(session, {
        allowedRoutes: ['/api/v1/bot/**', '/api/v1/dataset/**'],
      })

      const payload = await realJwt.verify(token)
      const verifier = await realGetPayloadVerifier(payload)

      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/bot/list' })
      ).not.toThrow()
      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/dataset/list' })
      ).not.toThrow()
      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/conversation/send' })
      ).toThrow()
    })

    it('should support negation patterns', async () => {
      const session = {
        id: 'session-negation',
        user: { id: 'user-negation' },
      }

      const token = await realGetTemporarySessionToken(session, {
        allowedRoutes: ['/api/v1/**', '!/api/v1/admin/**'],
      })

      const payload = await realJwt.verify(token)
      const verifier = await realGetPayloadVerifier(payload)

      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/bot/list' })
      ).not.toThrow()
      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/dataset/create' })
      ).not.toThrow()
      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/admin/users' })
      ).toThrow()
      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/admin/settings' })
      ).toThrow()
    })

    it('should maintain backward compatibility without restrictions', async () => {
      const session = {
        id: 'session-no-restrictions',
        user: { id: 'user-no-restrictions' },
      }

      const token = await realGetTemporarySessionToken(session, {
        durationInSeconds: 900,
      })

      const payload = await realJwt.verify(token)

      expect(payload.allowedRoutes).toBeUndefined()

      const verifier = await realGetPayloadVerifier(payload)

      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/bot/list' })
      ).not.toThrow()
      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/admin/users' })
      ).not.toThrow()
      expect(() =>
        verifier({ url: 'https://api.example.com/any/path/works' })
      ).not.toThrow()
    })

    it('should handle exact path matches', async () => {
      const session = {
        id: 'session-exact',
        user: { id: 'user-exact' },
      }

      const token = await realGetTemporarySessionToken(session, {
        allowedRoutes: ['/api/v1/bot/list', '/api/v1/bot/fetch'],
      })

      const payload = await realJwt.verify(token)
      const verifier = await realGetPayloadVerifier(payload)

      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/bot/list' })
      ).not.toThrow()
      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/bot/fetch' })
      ).not.toThrow()
      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/bot/create' })
      ).toThrow()
      expect(() =>
        verifier({ url: 'https://api.example.com/api/v1/bot/123/fetch' })
      ).toThrow()
    })

    it('should handle pathname-only URLs', async () => {
      const session = {
        id: 'session-pathname',
        user: { id: 'user-pathname' },
      }

      const token = await realGetTemporarySessionToken(session, {
        allowedRoutes: ['/api/v1/bot/**'],
      })

      const payload = await realJwt.verify(token)
      const verifier = await realGetPayloadVerifier(payload)

      expect(() => verifier({ url: '/api/v1/bot/list' })).not.toThrow()
      expect(() => verifier({ url: '/api/v1/dataset/list' })).toThrow()
    })

    it('should include path restrictions with custom duration', async () => {
      const session = {
        id: 'session-custom-duration',
        user: { id: 'user-custom-duration' },
      }

      const token = await realGetTemporarySessionToken(session, {
        durationInSeconds: 3600,
        allowedRoutes: ['/api/v1/bot/**'],
      })

      const payload = await realJwt.verify(token)

      expect(payload.allowedRoutes).toEqual(['/api/v1/bot/**'])
      expect(payload.exp).toBeGreaterThan(payload.iat)
      expect(payload.exp - payload.iat).toBeGreaterThanOrEqual(3600)
      expect(payload.exp - payload.iat).toBeLessThanOrEqual(3601)
    })
  })
})
