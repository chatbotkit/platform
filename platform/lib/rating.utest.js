import { slidingWindow } from '@/lib/ratelimit'
import { ratingLimitOK } from '@/lib/rating'

jest.mock('@/lib/ratelimit', () => ({
  slidingWindow: jest.fn(),
}))

describe('ratingLimitOK', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return true when rate limit check succeeds', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      const result = await ratingLimitOK({
        userId: 'user-123',
      })

      expect(result).toBe(true)
      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-123',
        1,
        '60 m'
      )
    })

    it('should return false when rate limit check fails', async () => {
      slidingWindow.mockResolvedValue({ success: false })

      const result = await ratingLimitOK({
        userId: 'user-123',
      })

      expect(result).toBe(false)
    })

    it('should call slidingWindow with correct parameters', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        userId: 'user-456',
      })

      expect(slidingWindow).toHaveBeenCalledTimes(1)
      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-456',
        1,
        '60 m'
      )
    })
  })

  describe('suffix generation with multiple parameters', () => {
    it('should include userId in suffix', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        userId: 'user-123',
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-123',
        1,
        '60 m'
      )
    })

    it('should include ipAddress and userId in suffix', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        ipAddress: '192.168.1.1',
        userId: 'user-123',
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-ip-192.168.1.1-user-user-123',
        1,
        '60 m'
      )
    })

    it('should include all parameters in suffix', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        ipAddress: '192.168.1.1',
        userId: 'user-123',
        botId: 'bot-456',
        conversationId: 'conv-789',
        messageId: 'msg-abc',
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-ip-192.168.1.1-user-user-123-bot-bot-456-conversation-conv-789-message-msg-abc',
        1,
        '60 m'
      )
    })

    it('should include botId when provided', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        userId: 'user-123',
        botId: 'bot-456',
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-123-bot-bot-456',
        1,
        '60 m'
      )
    })

    it('should include conversationId when provided', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        userId: 'user-123',
        conversationId: 'conv-789',
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-123-conversation-conv-789',
        1,
        '60 m'
      )
    })

    it('should include messageId when provided', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        userId: 'user-123',
        messageId: 'msg-abc',
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-123-message-msg-abc',
        1,
        '60 m'
      )
    })

    it('should maintain parameter order in suffix', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        messageId: 'msg-last',
        botId: 'bot-middle',
        ipAddress: 'ip-first',
        conversationId: 'conv-second-last',
        userId: 'user-second',
      })

      // @note order should be: ip, user, bot, conversation, message
      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-ip-ip-first-user-user-second-bot-bot-middle-conversation-conv-second-last-message-msg-last',
        1,
        '60 m'
      )
    })
  })

  describe('edge cases with null and undefined', () => {
    it('should handle undefined ipAddress', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        ipAddress: undefined,
        userId: 'user-123',
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-123',
        1,
        '60 m'
      )
    })

    it('should handle null ipAddress', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        ipAddress: null,
        userId: 'user-123',
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-123',
        1,
        '60 m'
      )
    })

    it('should handle undefined botId', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        userId: 'user-123',
        botId: undefined,
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-123',
        1,
        '60 m'
      )
    })

    it('should handle null conversationId', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        userId: 'user-123',
        conversationId: null,
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-123',
        1,
        '60 m'
      )
    })

    it('should handle undefined messageId', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        userId: 'user-123',
        messageId: undefined,
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-123',
        1,
        '60 m'
      )
    })

    it('should handle empty string parameters', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        ipAddress: '',
        userId: 'user-123',
        botId: '',
      })

      // @note empty strings are falsy and should be filtered out
      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-123',
        1,
        '60 m'
      )
    })

    it('should handle mix of null, undefined, and valid values', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        ipAddress: '192.168.1.1',
        userId: 'user-123',
        botId: null,
        conversationId: undefined,
        messageId: 'msg-abc',
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-ip-192.168.1.1-user-user-123-message-msg-abc',
        1,
        '60 m'
      )
    })
  })

  describe('special characters in parameters', () => {
    it('should handle special characters in userId', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        userId: 'user-123-test@example.com',
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-123-test@example.com',
        1,
        '60 m'
      )
    })

    it('should handle special characters in botId', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        userId: 'user-123',
        botId: 'bot_test-456',
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-123-bot-bot_test-456',
        1,
        '60 m'
      )
    })

    it('should handle IPv6 addresses', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        userId: 'user-123',
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-ip-2001:0db8:85a3:0000:0000:8a2e:0370:7334-user-user-123',
        1,
        '60 m'
      )
    })

    it('should handle dashes in IDs', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        userId: 'user-with-many-dashes-123',
        botId: 'bot-also-has-dashes-456',
      })

      expect(slidingWindow).toHaveBeenCalledWith(
        'rating-user-user-with-many-dashes-123-bot-bot-also-has-dashes-456',
        1,
        '60 m'
      )
    })
  })

  describe('error handling', () => {
    it('should propagate errors from slidingWindow', async () => {
      slidingWindow.mockRejectedValue(
        new Error('Rate limit service unavailable')
      )

      await expect(
        ratingLimitOK({
          userId: 'user-123',
        })
      ).rejects.toThrow('Rate limit service unavailable')
    })

    it('should handle unexpected response format', async () => {
      slidingWindow.mockResolvedValue({})

      const result = await ratingLimitOK({
        userId: 'user-123',
      })

      // @note success property is undefined, which is falsy
      expect(result).toBeUndefined()
    })

    it('should handle null response from slidingWindow', async () => {
      slidingWindow.mockResolvedValue(null)

      await expect(
        ratingLimitOK({
          userId: 'user-123',
        })
      ).rejects.toThrow()
    })
  })

  describe('rate limit configuration', () => {
    it('should use 1 request limit', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        userId: 'user-123',
      })

      const [, limit] = slidingWindow.mock.calls[0]

      expect(limit).toBe(1)
    })

    it('should use 60 minute window', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await ratingLimitOK({
        userId: 'user-123',
      })

      const [, , window] = slidingWindow.mock.calls[0]

      expect(window).toBe('60 m')
    })
  })

  describe('concurrent requests', () => {
    it('should handle multiple concurrent checks', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      const promises = [
        ratingLimitOK({ userId: 'user-1' }),
        ratingLimitOK({ userId: 'user-2' }),
        ratingLimitOK({ userId: 'user-3' }),
      ]

      const results = await Promise.all(promises)

      expect(results).toEqual([true, true, true])
      expect(slidingWindow).toHaveBeenCalledTimes(3)
    })

    it('should generate unique keys for different users', async () => {
      slidingWindow.mockResolvedValue({ success: true })

      await Promise.all([
        ratingLimitOK({ userId: 'user-1' }),
        ratingLimitOK({ userId: 'user-2' }),
      ])

      expect(slidingWindow).toHaveBeenNthCalledWith(
        1,
        'rating-user-user-1',
        1,
        '60 m'
      )
      expect(slidingWindow).toHaveBeenNthCalledWith(
        2,
        'rating-user-user-2',
        1,
        '60 m'
      )
    })
  })
})
