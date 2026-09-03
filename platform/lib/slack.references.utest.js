import { getChannelInfo } from '@/lib/slack.channel'
import { translateSlackReferences } from '@/lib/slack.references'
import { getUserInfo } from '@/lib/slack.user'

jest.mock('@/lib/slack.channel', () => ({
  getChannelInfo: jest.fn(),
}))

jest.mock('@/lib/slack.user', () => ({
  getUserInfo: jest.fn(),
}))

const mockGetChannelInfo = getChannelInfo
const mockGetUserInfo = getUserInfo

describe('translateSlackReferences', () => {
  const mockOptions = {
    token: 'xoxb-test-token',
    user: { id: 'user1', email: 'test@example.com' },
    slackIntegrationId: 'slack-integration-1',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('channel references', () => {
    it('should translate channel reference without existing name', async () => {
      mockGetChannelInfo.mockResolvedValue({
        id: 'C123456',
        name: 'general',
        topic: 'General discussion',
        purpose: 'Company updates',
      })

      const result = await translateSlackReferences(
        'Please check <#C123456|> for updates',
        mockOptions
      )

      expect(result).toBe('Please check #general for updates')
      expect(mockGetChannelInfo).toHaveBeenCalledWith('C123456', mockOptions)
    })

    it('should use existing channel name from reference', async () => {
      const result = await translateSlackReferences(
        'Please check <#C123456|general> for updates',
        mockOptions
      )

      expect(result).toBe('Please check #general for updates')
      expect(mockGetChannelInfo).not.toHaveBeenCalled()
    })

    it('should handle multiple channel references', async () => {
      mockGetChannelInfo
        .mockResolvedValueOnce({
          id: 'C123456',
          name: 'general',
        })
        .mockResolvedValueOnce({
          id: 'C789012',
          name: 'random',
        })

      const result = await translateSlackReferences(
        'Check <#C123456|> and <#C789012|> channels',
        mockOptions
      )

      expect(result).toBe('Check #general and #random channels')
      expect(mockGetChannelInfo).toHaveBeenCalledTimes(2)
    })

    it('should handle mixed channel references (with and without names)', async () => {
      mockGetChannelInfo.mockResolvedValue({
        id: 'C123456',
        name: 'general',
      })

      const result = await translateSlackReferences(
        'Check <#C123456|> and <#C789012|random> channels',
        mockOptions
      )

      expect(result).toBe('Check #general and #random channels')
      expect(mockGetChannelInfo).toHaveBeenCalledTimes(1)
      expect(mockGetChannelInfo).toHaveBeenCalledWith('C123456', mockOptions)
    })

    it('should fallback to unknown-channel when API fails', async () => {
      mockGetChannelInfo.mockRejectedValue(new Error('API Error'))

      const result = await translateSlackReferences(
        'Check <#C123456|> for updates',
        mockOptions
      )

      expect(result).toBe('Check #unknown-channel for updates')
    })

    it('should fallback to unknown-channel when channel not found', async () => {
      mockGetChannelInfo.mockResolvedValue(null)

      const result = await translateSlackReferences(
        'Check <#C123456|> for updates',
        mockOptions
      )

      expect(result).toBe('Check #unknown-channel for updates')
    })

    it('should handle channel with special characters in ID', async () => {
      mockGetChannelInfo.mockResolvedValue({
        id: 'C123#456$789',
        name: 'special-channel',
      })

      const result = await translateSlackReferences(
        'Check <#C123#456$789|> for updates',
        mockOptions
      )

      expect(result).toBe('Check #special-channel for updates')
    })
  })

  describe('user references', () => {
    it('should translate user reference without existing name', async () => {
      mockGetUserInfo.mockResolvedValue({
        id: 'U123456',
        name: 'john.doe',
        email: 'john@example.com',
        realName: 'John Doe',
      })

      const result = await translateSlackReferences(
        'Hey <@U123456>, can you help?',
        mockOptions
      )

      expect(result).toBe('Hey @john.doe, can you help?')
      expect(mockGetUserInfo).toHaveBeenCalledWith('U123456', mockOptions)
    })

    it('should use existing user name from reference', async () => {
      const result = await translateSlackReferences(
        'Hey <@U123456|john.doe>, can you help?',
        mockOptions
      )

      expect(result).toBe('Hey @john.doe, can you help?')
      expect(mockGetUserInfo).not.toHaveBeenCalled()
    })

    it('should handle multiple user references', async () => {
      mockGetUserInfo
        .mockResolvedValueOnce({
          id: 'U123456',
          name: 'john.doe',
        })
        .mockResolvedValueOnce({
          id: 'U789012',
          name: 'jane.smith',
        })

      const result = await translateSlackReferences(
        'Thanks <@U123456> and <@U789012> for your help',
        mockOptions
      )

      expect(result).toBe('Thanks @john.doe and @jane.smith for your help')
      expect(mockGetUserInfo).toHaveBeenCalledTimes(2)
    })

    it('should handle mixed user references (with and without names)', async () => {
      mockGetUserInfo.mockResolvedValue({
        id: 'U123456',
        name: 'john.doe',
      })

      const result = await translateSlackReferences(
        'Thanks <@U123456> and <@U789012|jane.smith> for your help',
        mockOptions
      )

      expect(result).toBe('Thanks @john.doe and @jane.smith for your help')
      expect(mockGetUserInfo).toHaveBeenCalledTimes(1)
      expect(mockGetUserInfo).toHaveBeenCalledWith('U123456', mockOptions)
    })

    it('should fallback to unknown-user when API fails', async () => {
      mockGetUserInfo.mockRejectedValue(new Error('API Error'))

      const result = await translateSlackReferences(
        'Hey <@U123456>, can you help?',
        mockOptions
      )

      expect(result).toBe('Hey @unknown-user, can you help?')
    })

    it('should fallback to unknown-user when user not found', async () => {
      mockGetUserInfo.mockResolvedValue(null)

      const result = await translateSlackReferences(
        'Hey <@U123456>, can you help?',
        mockOptions
      )

      expect(result).toBe('Hey @unknown-user, can you help?')
    })
  })

  describe('mixed references', () => {
    it('should handle both channel and user references', async () => {
      mockGetChannelInfo.mockResolvedValue({
        id: 'C123456',
        name: 'general',
      })

      mockGetUserInfo.mockResolvedValue({
        id: 'U123456',
        name: 'john.doe',
      })

      const result = await translateSlackReferences(
        'Hey <@U123456>, please check <#C123456|> channel',
        mockOptions
      )

      expect(result).toBe('Hey @john.doe, please check #general channel')
    })

    it('should handle complex text with multiple references', async () => {
      mockGetChannelInfo
        .mockResolvedValueOnce({
          id: 'C123456',
          name: 'general',
        })
        .mockResolvedValueOnce({
          id: 'C789012',
          name: 'random',
        })

      mockGetUserInfo
        .mockResolvedValueOnce({
          id: 'U123456',
          name: 'john.doe',
        })
        .mockResolvedValueOnce({
          id: 'U789012',
          name: 'jane.smith',
        })

      const result = await translateSlackReferences(
        'Message from <@U123456> in <#C123456|>: Please <@U789012> check <#C789012|random> for updates',
        mockOptions
      )

      expect(result).toBe(
        'Message from @john.doe in #general: Please @jane.smith check #random for updates'
      )
    })
  })

  describe('translateNamedReferences option', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should translate named references when translateNamedReferences is true (default)', async () => {
      const result = await translateSlackReferences(
        'Check <#C123456|general> and ask <@U123456|john>',
        { ...mockOptions, translateNamedReferences: true }
      )

      expect(result).toBe('Check #general and ask @john')
      expect(mockGetChannelInfo).not.toHaveBeenCalled()
      expect(mockGetUserInfo).not.toHaveBeenCalled()
    })

    it('should translate named references when translateNamedReferences is undefined (default)', async () => {
      const result = await translateSlackReferences(
        'Check <#C123456|general> and ask <@U123456|john>',
        mockOptions
      )

      expect(result).toBe('Check #general and ask @john')
      expect(mockGetChannelInfo).not.toHaveBeenCalled()
      expect(mockGetUserInfo).not.toHaveBeenCalled()
    })

    it('should not translate named references when translateNamedReferences is false', async () => {
      const result = await translateSlackReferences(
        'Check <#C123456|general> and ask <@U123456|john>',
        { ...mockOptions, translateNamedReferences: false }
      )

      expect(result).toBe('Check <#C123456|general> and ask <@U123456|john>')
      expect(mockGetChannelInfo).not.toHaveBeenCalled()
      expect(mockGetUserInfo).not.toHaveBeenCalled()
    })

    it('should translate unnamed references but preserve named references when translateNamedReferences is false', async () => {
      // clear all mocks including implementations

      jest.clearAllMocks()

      mockGetChannelInfo.mockReset()
      mockGetUserInfo.mockReset()

      // use completely different IDs that are unlikely to be cached

      const testChannelId = 'CAAATEST1'
      const testUserId = 'UAAATEST1'

      mockGetChannelInfo.mockImplementation((channelId) => {
        if (channelId === testChannelId) {
          return Promise.resolve({ id: testChannelId, name: 'dev-team' })
        }

        return Promise.resolve({ id: channelId, name: 'fallback-channel' })
      })

      mockGetUserInfo.mockImplementation((userId) => {
        if (userId === testUserId) {
          return Promise.resolve({ id: testUserId, name: 'jane.doe' })
        }

        return Promise.resolve({ id: userId, name: 'fallback-user' })
      })

      const testOptions = { ...mockOptions, translateNamedReferences: false }
      const result = await translateSlackReferences(
        `Check <#C123456|general> and <#${testChannelId}|> also ask <@U123456|john> and <@${testUserId}>`,
        testOptions
      )

      expect(result).toBe(
        'Check <#C123456|general> and #dev-team also ask <@U123456|john> and @jane.doe'
      )
      expect(mockGetChannelInfo).toHaveBeenCalledWith(
        testChannelId,
        testOptions
      )
      expect(mockGetUserInfo).toHaveBeenCalledWith(testUserId, testOptions)
    })
  })

  describe('edge cases', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should handle empty text', async () => {
      const result = await translateSlackReferences('', mockOptions)

      expect(result).toBe('')
    })

    it('should handle null text', async () => {
      const result = await translateSlackReferences(null, mockOptions)

      expect(result).toBe(null)
    })

    it('should handle undefined text', async () => {
      const result = await translateSlackReferences(undefined, mockOptions)

      expect(result).toBe(undefined)
    })

    it('should handle text without references', async () => {
      const result = await translateSlackReferences(
        'This is just regular text without any references',
        mockOptions
      )

      expect(result).toBe('This is just regular text without any references')
    })

    it('should handle truly malformed references', async () => {
      const result = await translateSlackReferences(
        'Check <#> and <@> for issues',
        mockOptions
      )

      // these should not match the pattern at all

      expect(result).toBe('Check <#> and <@> for issues')
    })

    it('should preserve other HTML-like tags', async () => {
      const result = await translateSlackReferences(
        'Check <span>this</span> and <div>that</div>',
        mockOptions
      )

      expect(result).toBe('Check <span>this</span> and <div>that</div>')
    })

    it('should handle references with empty names', async () => {
      await translateSlackReferences(
        'Check <#C123456|> and <@U123456|>',
        mockOptions
      )

      // should call API since names are empty

      expect(mockGetChannelInfo).toHaveBeenCalled()
      expect(mockGetUserInfo).toHaveBeenCalled()
    })
  })

  describe('performance and caching', () => {
    it('should use cached results for repeated references', async () => {
      mockGetChannelInfo.mockResolvedValue({
        id: 'C123456',
        name: 'general',
      })

      // First call
      await translateSlackReferences(
        'Check <#C123456|> for updates',
        mockOptions
      )

      // reset mocks to verify caching

      jest.clearAllMocks()

      // second call with same channel should use cache

      const result = await translateSlackReferences(
        'Also check <#C123456|> again',
        mockOptions
      )

      expect(result).toBe('Also check #general again')

      // @note the channel info function uses its own internal cache, so this
      // verifies that the caching is working

      expect(mockGetChannelInfo).toHaveBeenCalledTimes(1)
    })
  })
})
