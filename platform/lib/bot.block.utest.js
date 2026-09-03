/**
 * @jest-environment node
 */
import { mockDeep } from 'jest-mock-extended'

import { ONE_MONTH_IN_SECONDS } from '@chatbotkit-dev/time'

import {
  blockBot,
  botBlockOk,
  getBotBlock,
  getBotBlockKey,
  getBotsBlockedByPolicy,
  unblockBot,
} from '@/lib/bot.block'
import memcache from '@/lib/memcache'

jest.mock('@/lib/memcache', () => ({
  __esModule: true,

  default: mockDeep(),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,

  default: jest.fn(() => {
    const debugObj = { log: jest.fn(() => debugObj) }

    return debugObj
  }),
}))

describe('bot.block', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getBotBlockKey', () => {
    it('namespaces the key by bot id', () => {
      expect(getBotBlockKey('bot-abc')).toBe('block-bot-bot-abc')
    })
  })

  describe('blockBot', () => {
    it('sets the block with a TTL and indexes the bot under its policy', async () => {
      await blockBot('bot-abc', {
        reason: 'too many tokens',
        durationInSeconds: 600,
        policyId: 'policy-1',
      })

      expect(memcache.set).toHaveBeenCalledWith(
        'block-bot-bot-abc',
        { reason: 'too many tokens', policyId: 'policy-1' },
        { ex: 600 }
      )
      expect(memcache.sadd).toHaveBeenCalledWith(
        'block-policy-policy-1',
        'bot-abc'
      )
      // index TTL is refreshed and never shorter than the block's own life
      expect(memcache.expire).toHaveBeenCalledWith(
        'block-policy-policy-1',
        ONE_MONTH_IN_SECONDS
      )
    })

    it('covers a block that outlives the default index TTL', async () => {
      await blockBot('bot-abc', {
        reason: 'long block',
        durationInSeconds: ONE_MONTH_IN_SECONDS * 2,
        policyId: 'policy-1',
      })

      expect(memcache.expire).toHaveBeenCalledWith(
        'block-policy-policy-1',
        ONE_MONTH_IN_SECONDS * 2
      )
    })

    it('does not touch the policy index when there is no policy', async () => {
      await blockBot('bot-abc', {
        reason: 'manual disable',
        durationInSeconds: 600,
      })

      expect(memcache.set).toHaveBeenCalled()
      expect(memcache.sadd).not.toHaveBeenCalled()
      expect(memcache.expire).not.toHaveBeenCalled()
    })
  })

  describe('unblockBot', () => {
    it('deletes the block key', async () => {
      await unblockBot('bot-abc')

      expect(memcache.del).toHaveBeenCalledWith('block-bot-bot-abc')
    })
  })

  describe('botBlockOk', () => {
    it('returns true when no botId is provided without touching redis', async () => {
      expect(await botBlockOk('')).toBe(true)
      expect(memcache.get).not.toHaveBeenCalled()
    })

    it('returns true when the bot is not blocked', async () => {
      memcache.get.mockResolvedValue(null)

      expect(await botBlockOk('bot-abc')).toBe(true)
      expect(memcache.get).toHaveBeenCalledWith('block-bot-bot-abc')
    })

    it('returns false when the bot is blocked', async () => {
      memcache.get.mockResolvedValue({ reason: 'blocked', policyId: 'policy-1' })

      expect(await botBlockOk('bot-abc')).toBe(false)
    })

    it('fails open (returns true) on a redis error', async () => {
      memcache.get.mockRejectedValue(new Error('redis down'))

      expect(await botBlockOk('bot-abc')).toBe(true)
    })
  })

  describe('getBotBlock', () => {
    it('returns null when the bot is not blocked', async () => {
      memcache.get.mockResolvedValue(null)

      expect(await getBotBlock('bot-abc')).toBeNull()
      expect(memcache.ttl).not.toHaveBeenCalled()
    })

    it('returns the block with its remaining ttl', async () => {
      memcache.get.mockResolvedValue({ reason: 'too many tokens', policyId: 'p1' })
      memcache.ttl.mockResolvedValue(540)

      expect(await getBotBlock('bot-abc')).toEqual({
        reason: 'too many tokens',
        policyId: 'p1',
        ttl: 540,
      })
    })

    it('clamps a non-positive ttl to zero', async () => {
      memcache.get.mockResolvedValue({ reason: 'blocked' })
      memcache.ttl.mockResolvedValue(-1)

      const block = await getBotBlock('bot-abc')

      expect(block.ttl).toBe(0)
    })

    it('fails open (returns null) on a redis error', async () => {
      memcache.get.mockRejectedValue(new Error('redis down'))

      expect(await getBotBlock('bot-abc')).toBeNull()
    })
  })

  describe('getBotsBlockedByPolicy', () => {
    it('returns an empty array without reading redis when no policyId is given', async () => {
      expect(await getBotsBlockedByPolicy('')).toEqual([])
      expect(memcache.smembers).not.toHaveBeenCalled()
    })

    it('returns the indexed bots whose block is still owned by the policy', async () => {
      memcache.smembers.mockResolvedValue(['bot-1', 'bot-2', 'bot-3'])
      memcache.get
        .mockResolvedValueOnce({ policyId: 'policy-1' })
        .mockResolvedValueOnce({ policyId: 'other' })
        .mockResolvedValueOnce({ policyId: 'policy-1' })

      expect(await getBotsBlockedByPolicy('policy-1')).toEqual([
        'bot-1',
        'bot-3',
      ])
      expect(memcache.smembers).toHaveBeenCalledWith('block-policy-policy-1')
    })

    it('prunes stale index members (expired or re-owned blocks)', async () => {
      memcache.smembers.mockResolvedValue(['bot-1', 'bot-2', 'bot-3'])
      memcache.get
        .mockResolvedValueOnce({ policyId: 'policy-1' }) // active
        .mockResolvedValueOnce(null) // expired
        .mockResolvedValueOnce({ policyId: 'other' }) // re-owned

      expect(await getBotsBlockedByPolicy('policy-1')).toEqual(['bot-1'])
      expect(memcache.srem).toHaveBeenCalledWith(
        'block-policy-policy-1',
        'bot-2',
        'bot-3'
      )
    })

    it('does not call srem when nothing is stale', async () => {
      memcache.smembers.mockResolvedValue(['bot-1'])
      memcache.get.mockResolvedValueOnce({ policyId: 'policy-1' })

      expect(await getBotsBlockedByPolicy('policy-1')).toEqual(['bot-1'])
      expect(memcache.srem).not.toHaveBeenCalled()
    })

    it('returns an empty array when the index is empty', async () => {
      memcache.smembers.mockResolvedValue([])

      expect(await getBotsBlockedByPolicy('policy-1')).toEqual([])
      expect(memcache.get).not.toHaveBeenCalled()
    })

    it('fails open (returns []) on a redis error', async () => {
      memcache.smembers.mockRejectedValue(new Error('redis down'))

      expect(await getBotsBlockedByPolicy('policy-1')).toEqual([])
    })
  })
})
