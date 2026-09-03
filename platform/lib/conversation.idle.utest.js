import {
  CONVERSATIONS_IDLE_KEY,
  getIdleConversations,
  trackIdlingConversation,
  untrackIdlingConversations,
} from '@/lib/conversation.idle'
import memcache from '@/lib/memcache'

jest.mock('@/lib/memcache', () => ({
  zrange: jest.fn(),
  zadd: jest.fn(),
  zrem: jest.fn(),
}))

describe('idle', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    jest.spyOn(Date, 'now').mockReturnValue(1000000)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getIdleConversations', () => {
    it('should return idle conversations with default timeOffset', async () => {
      const mockConversations = ['conv1', 'conv2', 'conv3']

      memcache.zrange.mockResolvedValue(mockConversations)

      const result = await getIdleConversations()

      expect(result).toEqual(mockConversations)
      expect(memcache.zrange).toHaveBeenCalledWith(
        CONVERSATIONS_IDLE_KEY,
        0,
        1000000,
        {
          byScore: true,
        }
      )
    })

    it('should return idle conversations with positive timeOffset', async () => {
      const mockConversations = ['conv1', 'conv2']

      memcache.zrange.mockResolvedValue(mockConversations)

      const timeOffset = 5000

      const result = await getIdleConversations(timeOffset)

      expect(result).toEqual(mockConversations)
      expect(memcache.zrange).toHaveBeenCalledWith(
        CONVERSATIONS_IDLE_KEY,
        0,
        1005000,
        {
          byScore: true,
        }
      )
    })

    it('should return idle conversations with negative timeOffset', async () => {
      const mockConversations = ['conv1']

      memcache.zrange.mockResolvedValue(mockConversations)

      const timeOffset = -2000

      const result = await getIdleConversations(timeOffset)

      expect(result).toEqual(mockConversations)
      expect(memcache.zrange).toHaveBeenCalledWith(
        CONVERSATIONS_IDLE_KEY,
        0,
        998000,
        {
          byScore: true,
        }
      )
    })

    it('should return empty array when no idle conversations', async () => {
      memcache.zrange.mockResolvedValue([])

      const result = await getIdleConversations()

      expect(result).toEqual([])
      expect(memcache.zrange).toHaveBeenCalledWith(
        CONVERSATIONS_IDLE_KEY,
        0,
        1000000,
        {
          byScore: true,
        }
      )
    })

    it('should handle Redis errors gracefully', async () => {
      const redisError = new Error('Redis connection failed')

      memcache.zrange.mockRejectedValue(redisError)

      await expect(getIdleConversations()).rejects.toThrow(
        'Redis connection failed'
      )

      expect(memcache.zrange).toHaveBeenCalledWith(
        CONVERSATIONS_IDLE_KEY,
        0,
        1000000,
        {
          byScore: true,
        }
      )
    })

    it('should handle zero timeOffset correctly', async () => {
      const mockConversations = ['conv1']

      memcache.zrange.mockResolvedValue(mockConversations)

      const result = await getIdleConversations(0)

      expect(result).toEqual(mockConversations)
      expect(memcache.zrange).toHaveBeenCalledWith(
        CONVERSATIONS_IDLE_KEY,
        0,
        1000000,
        {
          byScore: true,
        }
      )
    })
  })

  describe('trackIdlingConversation', () => {
    it('should track conversation with default timeOffset', async () => {
      memcache.zadd.mockResolvedValue(1)

      const conversationId = 'conv123'

      await trackIdlingConversation(conversationId)

      expect(memcache.zadd).toHaveBeenCalledWith(CONVERSATIONS_IDLE_KEY, {
        score: 1000000,
        member: conversationId,
      })
    })

    it('should track conversation with positive timeOffset', async () => {
      memcache.zadd.mockResolvedValue(1)

      const conversationId = 'conv456'
      const timeOffset = 3000

      await trackIdlingConversation(conversationId, timeOffset)

      expect(memcache.zadd).toHaveBeenCalledWith(CONVERSATIONS_IDLE_KEY, {
        score: 1003000,
        member: conversationId,
      })
    })

    it('should track conversation with negative timeOffset', async () => {
      memcache.zadd.mockResolvedValue(1)

      const conversationId = 'conv789'
      const timeOffset = -1500

      await trackIdlingConversation(conversationId, timeOffset)

      expect(memcache.zadd).toHaveBeenCalledWith(CONVERSATIONS_IDLE_KEY, {
        score: 998500,
        member: conversationId,
      })
    })

    it('should handle Redis errors gracefully', async () => {
      const redisError = new Error('Redis write failed')

      memcache.zadd.mockRejectedValue(redisError)

      const conversationId = 'conv999'

      await expect(trackIdlingConversation(conversationId)).rejects.toThrow(
        'Redis write failed'
      )

      expect(memcache.zadd).toHaveBeenCalledWith(CONVERSATIONS_IDLE_KEY, {
        score: 1000000,
        member: conversationId,
      })
    })

    it('should handle empty string conversationId', async () => {
      memcache.zadd.mockResolvedValue(1)

      const conversationId = ''

      await trackIdlingConversation(conversationId)

      expect(memcache.zadd).toHaveBeenCalledWith(CONVERSATIONS_IDLE_KEY, {
        score: 1000000,
        member: '',
      })
    })

    it('should handle zero timeOffset correctly', async () => {
      memcache.zadd.mockResolvedValue(1)

      const conversationId = 'conv000'

      await trackIdlingConversation(conversationId, 0)

      expect(memcache.zadd).toHaveBeenCalledWith(CONVERSATIONS_IDLE_KEY, {
        score: 1000000,
        member: conversationId,
      })
    })
  })

  describe('untrackIdlingConversations', () => {
    it('should untrack single conversation', async () => {
      memcache.zrem.mockResolvedValue(1)

      const conversationIds = ['conv123']

      await untrackIdlingConversations(conversationIds)

      expect(memcache.zrem).toHaveBeenCalledWith(CONVERSATIONS_IDLE_KEY, 'conv123')
    })

    it('should untrack multiple conversations', async () => {
      memcache.zrem.mockResolvedValue(3)

      const conversationIds = ['conv1', 'conv2', 'conv3']

      await untrackIdlingConversations(conversationIds)

      expect(memcache.zrem).toHaveBeenCalledWith(
        CONVERSATIONS_IDLE_KEY,
        'conv1',
        'conv2',
        'conv3'
      )
    })

    it('should handle empty array gracefully', async () => {
      memcache.zrem.mockResolvedValue(0)

      const conversationIds = []

      await untrackIdlingConversations(conversationIds)

      expect(memcache.zrem).toHaveBeenCalledWith(CONVERSATIONS_IDLE_KEY)
    })

    it('should handle Redis errors gracefully', async () => {
      const redisError = new Error('Redis delete failed')

      memcache.zrem.mockRejectedValue(redisError)

      const conversationIds = ['conv456']

      await expect(untrackIdlingConversations(conversationIds)).rejects.toThrow(
        'Redis delete failed'
      )

      expect(memcache.zrem).toHaveBeenCalledWith(CONVERSATIONS_IDLE_KEY, 'conv456')
    })

    it('should handle array with empty string', async () => {
      memcache.zrem.mockResolvedValue(1)

      const conversationIds = ['']

      await untrackIdlingConversations(conversationIds)

      expect(memcache.zrem).toHaveBeenCalledWith(CONVERSATIONS_IDLE_KEY, '')
    })

    it('should handle mixed valid and empty conversation IDs', async () => {
      memcache.zrem.mockResolvedValue(2)

      const conversationIds = ['conv1', '', 'conv2']

      await untrackIdlingConversations(conversationIds)

      expect(memcache.zrem).toHaveBeenCalledWith(
        CONVERSATIONS_IDLE_KEY,
        'conv1',
        '',
        'conv2'
      )
    })
  })

  describe('CONVERSATIONS_IDLE_KEY constant', () => {
    it('should use test-specific key in test environment', () => {
      expect(CONVERSATIONS_IDLE_KEY).toBe('conversations:idle:test')
    })
  })
})
