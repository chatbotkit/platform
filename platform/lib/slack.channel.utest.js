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

describe('slack.channel', () => {
  const mockToken = 'xoxb-test-token'
  const mockChannelId = 'C1234567890'
  const mockUser = { id: 'user-123', email: 'test@example.com' }
  const mockSlackIntegrationId = 'slack-integration-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.resetModules()
  })

  describe('getChannelInfo', () => {
    it('should fetch and cache channel info for valid channel', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const mockChannelData = {
        id: mockChannelId,
        name: 'general',
        topic: { value: 'General discussion' },
        purpose: { value: 'Company-wide announcements' },
      }

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: mockChannelData,
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getChannelInfo(mockChannelId, { token: mockToken })

      expect(result).toEqual({
        id: mockChannelId,
        name: 'general',
        topic: 'General discussion',
        purpose: 'Company-wide announcements',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `https://slack.com/api/conversations.info?channel=${mockChannelId}`,
        }),
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      )
    })

    it('should handle channel with no topic or purpose', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const mockChannelData = {
        id: mockChannelId,
        name: 'random',
        // topic and purpose are missing
      }

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: mockChannelData,
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getChannelInfo(mockChannelId, { token: mockToken })

      expect(result).toEqual({
        id: mockChannelId,
        name: 'random',
        topic: undefined,
        purpose: undefined,
      })
    })

    it('should handle channel with empty topic and purpose values', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const mockChannelData = {
        id: mockChannelId,
        name: 'test-channel',
        topic: { value: '' },
        purpose: { value: '' },
      }

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: mockChannelData,
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getChannelInfo(mockChannelId, { token: mockToken })

      expect(result).toEqual({
        id: mockChannelId,
        name: 'test-channel',
        topic: '',
        purpose: '',
      })
    })

    it('should return cached result on subsequent calls', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const mockChannelData = {
        id: mockChannelId,
        name: 'cached-channel',
        topic: { value: 'Cached topic' },
        purpose: { value: 'Cached purpose' },
      }

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: mockChannelData,
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      // First call should hit the API
      const result1 = await getChannelInfo(mockChannelId, { token: mockToken })
      // Second call should use cache
      const result2 = await getChannelInfo(mockChannelId, { token: mockToken })

      expect(result1).toEqual(result2)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should make separate API calls for different channel IDs', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const channelId1 = 'C1111111111'
      const channelId2 = 'C2222222222'

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: { id: 'test', name: 'test' },
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      await getChannelInfo(channelId1, { token: mockToken })
      await getChannelInfo(channelId2, { token: mockToken })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          href: `https://slack.com/api/conversations.info?channel=${channelId1}`,
        }),
        expect.any(Object)
      )
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          href: `https://slack.com/api/conversations.info?channel=${channelId2}`,
        }),
        expect.any(Object)
      )
    })

    it('should return null for Slack API errors without logging when user is not provided', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: false,
          error: 'channel_not_found',
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getChannelInfo(mockChannelId, { token: mockToken })

      expect(result).toBeNull()
      expect(mockLogEvent).not.toHaveBeenCalled()
    })

    it('should return null and log error when user and slackIntegrationId are provided', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: false,
          error: 'missing_scope',
          needed: 'channels:read',
          provided: 'chat:write',
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getChannelInfo(mockChannelId, {
        token: mockToken,
        user: mockUser,
        slackIntegrationId: mockSlackIntegrationId,
      })

      expect(result).toBeNull()
      expect(mockLogEvent).toHaveBeenCalledWith({
        user: mockUser,
        name: 'Get Slack Channel Info Error',
        description: `Failed to get Slack channel info for channel ID ${mockChannelId}`,
        type: 'integration.slack.api.error',
        relations: {
          slackIntegrationId: mockSlackIntegrationId,
        },
        meta: {
          error: 'missing_scope',
          needed: 'channels:read',
          provided: 'chat:write',
        },
      })
    })

    it('should throw error when fetch fails', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const mockError = new Error('Network error')

      const mockResponse = {
        ok: false,
        status: 500,
      }

      mockFetch.mockResolvedValue(mockResponse)
      mockGetFetchError.mockResolvedValue(mockError)

      await expect(
        getChannelInfo(mockChannelId, { token: mockToken })
      ).rejects.toThrow(mockError)

      expect(mockGetFetchError).toHaveBeenCalledWith(mockResponse)
    })

    it('should handle malformed JSON response', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getChannelInfo(mockChannelId, { token: mockToken })

      expect(result).toBeNull()
    })

    it('should handle response with missing channel data', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          // channel is missing
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getChannelInfo(mockChannelId, { token: mockToken })

      expect(result).toBeNull()
    })

    it('should handle empty string channel ID', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: { id: '', name: '' },
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getChannelInfo('', { token: mockToken })

      expect(result).toEqual({
        id: '',
        name: '',
        topic: undefined,
        purpose: undefined,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: 'https://slack.com/api/conversations.info?channel=',
        }),
        expect.any(Object)
      )
    })

    it('should handle special characters in channel ID', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const specialChannelId = 'C123#456$789'

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: { id: specialChannelId, name: 'special-channel' },
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await getChannelInfo(specialChannelId, {
        token: mockToken,
      })

      expect(result).toEqual({
        id: specialChannelId,
        name: 'special-channel',
        topic: undefined,
        purpose: undefined,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `https://slack.com/api/conversations.info?channel=${encodeURIComponent(
            specialChannelId
          )}`,
        }),
        expect.any(Object)
      )
    })

    it('should use provided token in Authorization header', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const customToken = 'xoxb-custom-token-123'

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: { id: mockChannelId, name: 'test' },
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      await getChannelInfo(mockChannelId, { token: customToken })

      expect(mockFetch).toHaveBeenCalledWith(expect.any(Object), {
        headers: {
          Authorization: `Bearer ${customToken}`,
        },
      })
    })

    it('should construct correct API URL with channel parameter', async () => {
      const { getChannelInfo } = await import('@/lib/slack.channel')

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: { id: mockChannelId, name: 'test' },
        }),
      }

      mockFetch.mockResolvedValue(mockResponse)

      await getChannelInfo(mockChannelId, { token: mockToken })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: `https://slack.com/api/conversations.info?channel=${mockChannelId}`,
          protocol: 'https:',
          host: 'slack.com',
          pathname: '/api/conversations.info',
        }),
        expect.any(Object)
      )
    })
  })

  describe('inferChannelType', () => {
    it('should return "im" for D-prefixed channel IDs (direct messages)', async () => {
      const { inferChannelType } = await import('@/lib/slack.channel')

      expect(inferChannelType('D1234567890')).toBe('im')
      expect(inferChannelType('DABCDEFGHI')).toBe('im')
    })

    it('should return "im" for W-prefixed channel IDs (workspace-level DMs)', async () => {
      const { inferChannelType } = await import('@/lib/slack.channel')

      expect(inferChannelType('W1234567890')).toBe('im')
      expect(inferChannelType('WABCDEFGHI')).toBe('im')
    })

    it('should return "im" for @username references (addresses a person)', async () => {
      const { inferChannelType } = await import('@/lib/slack.channel')

      expect(inferChannelType('@nick')).toBe('im')
      expect(inferChannelType('@john.doe')).toBe('im')
    })

    it('should return "channel" for #channel-name references', async () => {
      const { inferChannelType } = await import('@/lib/slack.channel')

      expect(inferChannelType('#general')).toBe('channel')
      expect(inferChannelType('#chatbotkit-market')).toBe('channel')
    })

    it('should return "group" for G-prefixed channel IDs (private channels/multi-party DMs)', async () => {
      const { inferChannelType } = await import('@/lib/slack.channel')

      expect(inferChannelType('G1234567890')).toBe('group')
      expect(inferChannelType('GABCDEFGHI')).toBe('group')
    })

    it('should return "channel" for C-prefixed channel IDs (public channels)', async () => {
      const { inferChannelType } = await import('@/lib/slack.channel')

      expect(inferChannelType('C1234567890')).toBe('channel')
      expect(inferChannelType('CABCDEFGHI')).toBe('channel')
    })

    it('should default to "channel" for unknown prefixes', async () => {
      const { inferChannelType } = await import('@/lib/slack.channel')

      expect(inferChannelType('X1234567890')).toBe('channel')
      expect(inferChannelType('unknown')).toBe('channel')
    })

    it('should handle lowercase prefixes', async () => {
      const { inferChannelType } = await import('@/lib/slack.channel')

      expect(inferChannelType('d1234567890')).toBe('im')
      expect(inferChannelType('g1234567890')).toBe('group')
      expect(inferChannelType('c1234567890')).toBe('channel')
    })

    it('should handle empty string gracefully', async () => {
      const { inferChannelType } = await import('@/lib/slack.channel')

      expect(inferChannelType('')).toBe('channel')
    })
  })

  describe('resolveChannel', () => {
    const mockOptions = {
      token: mockToken,
      user: mockUser,
      slackIntegrationId: mockSlackIntegrationId,
    }

    it('should return channel ID directly when given a valid C-prefixed ID', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      const result = await resolveChannel('C1234567890', mockOptions)

      expect(result).toEqual({
        channelId: 'C1234567890',
        channelType: 'channel',
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return channel ID directly when given a valid D-prefixed ID', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      const result = await resolveChannel('D1234567890', mockOptions)

      expect(result).toEqual({
        channelId: 'D1234567890',
        channelType: 'im',
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return channel ID directly when given a valid G-prefixed ID', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      const result = await resolveChannel('G1234567890', mockOptions)

      expect(result).toEqual({
        channelId: 'G1234567890',
        channelType: 'group',
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should normalize lowercase channel IDs to uppercase', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      const result = await resolveChannel('c1234567890', mockOptions)

      expect(result).toEqual({
        channelId: 'C1234567890',
        channelType: 'channel',
      })
    })

    it('should trim whitespace from channel identifiers', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      const result = await resolveChannel('  C1234567890  ', mockOptions)

      expect(result).toEqual({
        channelId: 'C1234567890',
        channelType: 'channel',
      })
    })

    it('should resolve #channel-name format by calling conversations.list API', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channels: [
            { id: 'C9999999999', name: 'other-channel' },
            { id: 'C1234567890', name: 'general' },
          ],
        }),
      })

      const result = await resolveChannel('#general', mockOptions)

      expect(result).toEqual({
        channelId: 'C1234567890',
        channelType: 'channel',
      })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/api/conversations.list',
        }),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      )
    })

    it('should return null when #channel-name is not found', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channels: [{ id: 'C9999999999', name: 'other-channel' }],
        }),
      })

      const result = await resolveChannel('#nonexistent', mockOptions)

      expect(result).toBeNull()
    })

    it('should paginate conversations.list to find channel beyond first page', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      // First page: channel not found, but has a cursor for next page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channels: [{ id: 'C9999999999', name: 'other-channel' }],
          response_metadata: { next_cursor: 'cursor-page-2' },
        }),
      })

      // Second page: channel found
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channels: [{ id: 'C1234567890', name: 'general' }],
          response_metadata: { next_cursor: '' },
        }),
      })

      const result = await resolveChannel('#general', mockOptions)

      expect(result).toEqual({
        channelId: 'C1234567890',
        channelType: 'channel',
      })
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          searchParams: expect.objectContaining({ get: expect.any(Function) }),
        }),
        expect.any(Object)
      )
    })

    it('should stop pagination when all pages exhausted without finding channel', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      // First page: not found, has cursor
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channels: [{ id: 'C1111111111', name: 'channel-a' }],
          response_metadata: { next_cursor: 'cursor-page-2' },
        }),
      })

      // Second page: not found, no cursor
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channels: [{ id: 'C2222222222', name: 'channel-b' }],
          response_metadata: { next_cursor: '' },
        }),
      })

      const result = await resolveChannel('#nonexistent', mockOptions)

      expect(result).toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should resolve @username format by opening a DM', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      // First call: users.list to find user
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          members: [
            { id: 'U1234567890', name: 'john.doe', profile: {} },
            { id: 'U9999999999', name: 'other.user', profile: {} },
          ],
        }),
      })

      // Second call: conversations.open to open DM
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: { id: 'D5555555555' },
        }),
      })

      const result = await resolveChannel('@john.doe', mockOptions)

      expect(result).toEqual({
        channelId: 'D5555555555',
        channelType: 'im',
      })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should resolve a bare U-prefixed user ID by opening a DM', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      // @note only conversations.open should be called - no users.list lookup,
      // since we already have the user ID
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: { id: 'D5555555555' },
        }),
      })

      const result = await resolveChannel('U1234567890', mockOptions)

      expect(result).toEqual({
        channelId: 'D5555555555',
        channelType: 'im',
      })
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/api/conversations.open' }),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ users: 'U1234567890' }),
        })
      )
    })

    it('should normalize a lowercase user ID to uppercase before opening a DM', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: { id: 'D5555555555' },
        }),
      })

      const result = await resolveChannel('u1234567890', mockOptions)

      expect(result).toEqual({
        channelId: 'D5555555555',
        channelType: 'im',
      })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/api/conversations.open' }),
        expect.objectContaining({
          body: JSON.stringify({ users: 'U1234567890' }),
        })
      )
    })

    it('should return null when opening a DM for a U-prefixed user ID fails', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: false,
          error: 'cannot_dm_bot',
        }),
      })

      const result = await resolveChannel('U1234567890', mockOptions)

      expect(result).toBeNull()
      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Open Slack DM Error',
          type: 'integration.slack.api.error',
          meta: { error: 'cannot_dm_bot' },
        })
      )
    })

    it('should return null when @username is not found', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          members: [{ id: 'U9999999999', name: 'other.user', profile: {} }],
        }),
      })

      const result = await resolveChannel('@nonexistent', mockOptions)

      expect(result).toBeNull()
    })

    it('should paginate users.list to find user beyond first page', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      // First page of users.list: user not found, has cursor
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          members: [{ id: 'U9999999999', name: 'other.user', profile: {} }],
          response_metadata: { next_cursor: 'cursor-page-2' },
        }),
      })

      // Second page of users.list: user found
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          members: [{ id: 'U1234567890', name: 'john.doe', profile: {} }],
          response_metadata: { next_cursor: '' },
        }),
      })

      // conversations.open to open DM
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: { id: 'D5555555555' },
        }),
      })

      const result = await resolveChannel('@john.doe', mockOptions)

      expect(result).toEqual({
        channelId: 'D5555555555',
        channelType: 'im',
      })
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should match @username by display_name', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          members: [
            {
              id: 'U1234567890',
              name: 'john.doe',
              profile: { display_name: 'Johnny' },
            },
          ],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: { id: 'D5555555555' },
        }),
      })

      const result = await resolveChannel('@Johnny', mockOptions)

      expect(result).toEqual({
        channelId: 'D5555555555',
        channelType: 'im',
      })
    })

    it('should match @username by real_name', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          members: [
            {
              id: 'U1234567890',
              name: 'john.doe',
              profile: { real_name: 'John Doe' },
            },
          ],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: { id: 'D5555555555' },
        }),
      })

      const result = await resolveChannel('@John Doe', mockOptions)

      expect(result).toEqual({
        channelId: 'D5555555555',
        channelType: 'im',
      })
    })

    it('should treat unknown format as channel ID with fallback type inference', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      const result = await resolveChannel('random-string', mockOptions)

      expect(result).toEqual({
        channelId: 'random-string',
        channelType: 'channel',
      })
    })

    it('should log error when conversations.list API returns error', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: false,
          error: 'channel_not_found',
        }),
      })

      const result = await resolveChannel('#general', mockOptions)

      expect(result).toBeNull()
      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Find Slack Channel By Name Error',
          type: 'integration.slack.api.error',
          meta: { error: 'channel_not_found' },
        })
      )
    })

    it('should log error when users.list API returns error', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: false,
          error: 'user_not_found',
        }),
      })

      const result = await resolveChannel('@john.doe', mockOptions)

      expect(result).toBeNull()
      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Find Slack User By Username Error',
          type: 'integration.slack.api.error',
          meta: { error: 'user_not_found' },
        })
      )
    })

    it('should log error when conversations.open API returns error', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      // First call: users.list succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          members: [{ id: 'U1234567890', name: 'john.doe', profile: {} }],
        }),
      })

      // Second call: conversations.open fails
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: false,
          error: 'cannot_dm_bot',
        }),
      })

      const result = await resolveChannel('@john.doe', mockOptions)

      expect(result).toBeNull()
      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Open Slack DM Error',
          type: 'integration.slack.api.error',
          meta: { error: 'cannot_dm_bot' },
        })
      )
    })

    it('should throw when HTTP response is not ok for conversations.list', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      const mockError = new Error('API Error')

      mockGetFetchError.mockResolvedValue(mockError)

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      })

      await expect(resolveChannel('#general', mockOptions)).rejects.toThrow(
        'API Error'
      )
    })

    it('should throw when HTTP response is not ok for users.list', async () => {
      const { resolveChannel } = await import('@/lib/slack.channel')

      const mockError = new Error('API Error')

      mockGetFetchError.mockResolvedValue(mockError)

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      })

      await expect(resolveChannel('@john.doe', mockOptions)).rejects.toThrow(
        'API Error'
      )
    })
  })
})
