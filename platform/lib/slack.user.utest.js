const mockFetch = jest.fn()
const mockGetFetchError = jest.fn()
const mockLogEvent = jest.fn()

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: mockFetch,
  getFetchError: mockGetFetchError,
}))

jest.mock('@/lib/log', () => ({
  logEvent: mockLogEvent,
}))

describe('slack.user', () => {
  const mockToken = 'xoxb-test-token'
  const mockUserId = 'U1234567890'
  const mockUser = { id: 'user-123', email: 'test@example.com' }
  const mockSlackIntegrationId = 'slack-integration-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.resetModules()
  })

  describe('getBotUserId', () => {
    it('should return null when token is missing', async () => {
      const { getBotUserId } = await import('@/lib/slack.user')

      await expect(getBotUserId()).resolves.toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should fetch and cache bot user id for valid token', async () => {
      const { getBotUserId } = await import('@/lib/slack.user')

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          user_id: 'UBOT123',
          bot_id: 'B123',
        }),
      })

      const result1 = await getBotUserId(mockToken)
      const result2 = await getBotUserId(mockToken)

      expect(result1).toBe('UBOT123')
      expect(result2).toBe('UBOT123')
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/auth.test',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mockToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )
    })

    it('should return null when auth.test response is unsuccessful', async () => {
      const { getBotUserId } = await import('@/lib/slack.user')

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: false,
          error: 'invalid_auth',
        }),
      })

      await expect(getBotUserId(mockToken)).resolves.toBeNull()
    })

    it('should return null when auth.test request fails', async () => {
      const { getBotUserId } = await import('@/lib/slack.user')

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      })

      await expect(getBotUserId(mockToken)).resolves.toBeNull()
    })
  })

  describe('getUserInfo', () => {
    it('should fetch and cache user info for valid user', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockUserData = {
        id: mockUserId,
        name: 'john.doe',
        profile: {
          email: 'john.doe@example.com',
          real_name: 'John Doe',
        },
      }

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          user: mockUserData,
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getUserInfo(mockUserId, { token: mockToken })

      expect(result).toEqual({
        id: mockUserId,
        name: 'john.doe',
        email: 'john.doe@example.com',
        realName: 'John Doe',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `https://slack.com/api/users.info?user=${mockUserId}`,
        }),
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      )
    })

    it('should handle user with minimal profile data', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockUserData = {
        id: mockUserId,
        name: 'minimal.user',
        profile: {
          // email and real_name are missing
        },
      }

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          user: mockUserData,
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getUserInfo(mockUserId, { token: mockToken })

      expect(result).toEqual({
        id: mockUserId,
        name: 'minimal.user',
        email: undefined,
        realName: undefined,
      })
    })

    it('should handle user with no profile object', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockUserData = {
        id: mockUserId,
        name: 'no.profile',
        // profile is missing
      }

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          user: mockUserData,
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getUserInfo(mockUserId, { token: mockToken })

      expect(result).toEqual({
        id: mockUserId,
        name: 'no.profile',
        email: undefined,
        realName: undefined,
      })
    })

    it('should handle user with empty profile values', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockUserData = {
        id: mockUserId,
        name: 'empty.profile',
        profile: {
          email: '',
          real_name: '',
        },
      }

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          user: mockUserData,
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getUserInfo(mockUserId, { token: mockToken })

      expect(result).toEqual({
        id: mockUserId,
        name: 'empty.profile',
        email: '',
        realName: '',
      })
    })

    it('should return cached result on subsequent calls', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockUserData = {
        id: mockUserId,
        name: 'cached.user',
        profile: {
          email: 'cached@example.com',
          real_name: 'Cached User',
        },
      }

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          user: mockUserData,
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      // First call should hit the API
      const result1 = await getUserInfo(mockUserId, { token: mockToken })
      // Second call should use cache
      const result2 = await getUserInfo(mockUserId, { token: mockToken })

      expect(result1).toEqual(result2)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should make separate API calls for different user IDs', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const userId1 = 'U1111111111'
      const userId2 = 'U2222222222'

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          user: { id: 'test', name: 'test' },
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      await getUserInfo(userId1, { token: mockToken })
      await getUserInfo(userId2, { token: mockToken })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          href: `https://slack.com/api/users.info?user=${userId1}`,
        }),
        expect.any(Object)
      )
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          href: `https://slack.com/api/users.info?user=${userId2}`,
        }),
        expect.any(Object)
      )
    })

    it('should return null for Slack API errors without logging when user is not provided', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: false,
          error: 'user_not_found',
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getUserInfo(mockUserId, { token: mockToken })

      expect(result).toBeNull()
      expect(mockLogEvent).not.toHaveBeenCalled()
    })

    it('should return null and log error when user and slackIntegrationId are provided', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: false,
          error: 'missing_scope',
          needed: 'users:read',
          provided: 'chat:write',
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getUserInfo(mockUserId, {
        token: mockToken,
        user: mockUser,
        slackIntegrationId: mockSlackIntegrationId,
      })

      expect(result).toBeNull()
      expect(mockLogEvent).toHaveBeenCalledWith({
        user: mockUser,
        name: 'Get Slack User Info Error',
        description: `Failed to get Slack user info for user ID ${mockUserId}`,
        type: 'integration.slack.api.error',
        relations: {
          slackIntegrationId: mockSlackIntegrationId,
        },
        meta: {
          error: 'missing_scope',
          needed: 'users:read',
          provided: 'chat:write',
        },
      })
    })

    it('should throw error when fetch fails', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockError = new Error('Network error')

      const mockResponse = {
        ok: false,
        status: 500,
      }

      mockFetch.mockResolvedValue(mockResponse)
      mockGetFetchError.mockResolvedValue(mockError)

      await expect(
        getUserInfo(mockUserId, { token: mockToken })
      ).rejects.toThrow(mockError)

      expect(mockGetFetchError).toHaveBeenCalledWith(mockResponse)
    })

    it('should handle malformed JSON response', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getUserInfo(mockUserId, { token: mockToken })

      expect(result).toBeNull()
    })

    it('should handle response with missing user data', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          // user is missing
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getUserInfo(mockUserId, { token: mockToken })

      expect(result).toBeNull()
    })

    it('should handle empty string user ID', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          user: { id: '', name: '' },
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getUserInfo('', { token: mockToken })

      expect(result).toEqual({
        id: '',
        name: '',
        email: undefined,
        realName: undefined,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: 'https://slack.com/api/users.info?user=',
        }),
        expect.any(Object)
      )
    })

    it('should handle special characters in user ID', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const specialUserId = 'U123#456$789'

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          user: { id: specialUserId, name: 'special.user' },
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getUserInfo(specialUserId, { token: mockToken })

      expect(result).toEqual({
        id: specialUserId,
        name: 'special.user',
        email: undefined,
        realName: undefined,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `https://slack.com/api/users.info?user=${encodeURIComponent(
            specialUserId
          )}`,
        }),
        expect.any(Object)
      )
    })

    it('should use provided token in Authorization header', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const customToken = 'xoxb-custom-token-123'

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          user: { id: mockUserId, name: 'test' },
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      await getUserInfo(mockUserId, { token: customToken })

      expect(mockFetch).toHaveBeenCalledWith(expect.any(Object), {
        headers: {
          Authorization: `Bearer ${customToken}`,
        },
      })
    })

    it('should construct correct API URL with user parameter', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          user: { id: mockUserId, name: 'test' },
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      await getUserInfo(mockUserId, { token: mockToken })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `https://slack.com/api/users.info?user=${mockUserId}`,
          protocol: 'https:',
          host: 'slack.com',
          pathname: '/api/users.info',
        }),
        expect.any(Object)
      )
    })

    it('should correctly extract profile data from complex user object', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockUserData = {
        id: mockUserId,
        name: 'complex.user',
        profile: {
          email: 'complex@example.com',
          real_name: 'Complex User',
          display_name: 'ComplexUser',
          first_name: 'Complex',
          last_name: 'User',
          phone: '+1234567890',
          title: 'Senior Developer',
          // many other profile fields that should be ignored
        },
        deleted: false,
        is_admin: false,
        is_bot: false,
        // many other user fields that should be ignored
      }

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          user: mockUserData,
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getUserInfo(mockUserId, { token: mockToken })

      // Should only extract the fields we care about
      expect(result).toEqual({
        id: mockUserId,
        name: 'complex.user',
        email: 'complex@example.com',
        realName: 'Complex User',
      })
    })

    it('should handle null values in profile', async () => {
      const { getUserInfo } = await import('@/lib/slack.user')

      const mockUserData = {
        id: mockUserId,
        name: 'null.profile',
        profile: {
          email: null,
          real_name: null,
        },
      }

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          user: mockUserData,
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getUserInfo(mockUserId, { token: mockToken })

      expect(result).toEqual({
        id: mockUserId,
        name: 'null.profile',
        email: null,
        realName: null,
      })
    })
  })
})
