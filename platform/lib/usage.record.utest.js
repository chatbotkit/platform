/**
 * @jest-environment node
 */
import { mockDeep } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import memcache from '@/lib/memcache'
import {
  audioModelToUseType,
  getBaseImageModelTokenCount,
  getBaseLanguageModelTokenCount,
  getBaseRerankModelTokenCount,
  getBaseVideoModelTokenCount,
  imageModelToUseType,
  languageModelToUseType,
  rerankModelToUseType,
  videoModelToUseType,
} from '@/lib/model.utils'
import queue from '@/lib/queue'
import {
  captureUsage,
  convertUseTypeToBaseType,
  getCalibratedBaseCount,
  getUsageKey,
  queueUsage,
  recordAudioTokenUsage,
  recordAudioUsage,
  recordConversationUsage,
  recordEmailUsage,
  recordFetchUsage,
  recordImageTokenUsage,
  recordImageUsage,
  recordLanguageTokenUsage,
  recordMessageUsage,
  recordRerankTokenUsage,
  recordUsage,
  recordVideoTokenUsage,
  recordVideoUsage,
  resetUsage,
} from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'

jest.mock('@/prisma/client', () => ({
  __esModule: true,

  default: mockDeep(),
}))

jest.mock('@/lib/usage.types', () => ({
  UseType: {
    CHATBOTKIT_CONVERSATION: 'CHATBOTKIT_CONVERSATION',
    CHATBOTKIT_MESSAGE: 'CHATBOTKIT_MESSAGE',
    CHATBOTKIT_IMAGE: 'CHATBOTKIT_IMAGE',
    CHATBOTKIT_VIDEO: 'CHATBOTKIT_VIDEO',
    CHATBOTKIT_AUDIO: 'CHATBOTKIT_AUDIO',
    CHATBOTKIT_FETCH: 'CHATBOTKIT_FETCH',
    CHATBOTKIT_EMAIL: 'CHATBOTKIT_EMAIL',
    CHATBOTKIT_BASE_TOKEN: 'CHATBOTKIT_BASE_TOKEN',
    CHATBOTKIT_CUSTOM_TOKEN: 'CHATBOTKIT_CUSTOM_TOKEN',
  },
}))

jest.mock('@/lib/memcache', () => ({
  __esModule: true,

  default: mockDeep(),
}))

jest.mock('@/lib/model.utils', () => ({
  ...jest.requireActual('@/lib/model.utils'),

  getBaseLanguageModelTokenCount: jest.fn((model, count) => count * 1.2),

  getBaseVideoModelTokenCount: jest.fn((model, count) => count * 2),

  getBaseImageModelTokenCount: jest.fn((model, count) => count * 3),

  getBaseRerankModelTokenCount: jest.fn((model, count) => count * 4),

  languageModelToUseType: jest.fn((model) => {
    const mapping = {
      'gpt-4': 'OPENAI_GPT_4_TOKEN',
      'gpt-3.5-turbo': 'OPENAI_GPT_3_5_TURBO_TOKEN',
    }

    return mapping[model] || 'OPENAI_GPT_4_TOKEN'
  }),

  imageModelToUseType: jest.fn(() => 'OPENAI_GPT_IMAGE_2_TOKEN'),

  videoModelToUseType: jest.fn(() => 'VERCEL_GROK_IMAGINE_VIDEO_TOKEN'),

  rerankModelToUseType: jest.fn(() => 'VERCEL_RERANK_V4_FAST_TOKEN'),

  audioModelToUseType: jest.fn((model) => {
    const mapping = {
      'gpt-4o-transcribe': 'OPENAI_GPT_4O_TRANSCRIBE_TOKEN',
      'tts-1': 'OPENAI_TTS_1_TOKEN',
    }

    return mapping[model]
  }),

  useTypeToLanguageModelMapping: {
    OPENAI_GPT_4_TOKEN: 'gpt-4',
    OPENAI_GPT_3_5_TURBO_TOKEN: 'gpt-3.5-turbo',
  },

  useTypeToImageModelMapping: {
    OPENAI_GPT_IMAGE_2_TOKEN: 'dall-e-2',
  },

  useTypeToVideoModelMapping: {
    VERCEL_GROK_IMAGINE_VIDEO_TOKEN: 'grok-imagine-video',
  },

  useTypeToRerankModelMapping: {
    VERCEL_RERANK_V4_FAST_TOKEN: 'rerank-v4-fast',
  },
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/queue', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  getContextRequestIpAddress: jest.fn(() => '192.168.1.1'),
  getContextConversation: jest.fn(() => ({ id: 'conv123' })),
  getContextContact: jest.fn(() => ({ id: 'contact456' })),
  getContextBot: jest.fn(() => ({ id: 'bot789' })),
}))

jest.mock('@/lib/job', () => ({
  runTasks: jest.fn((tasks) => Promise.all(tasks)),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,

  ...jest.requireActual('@/lib/debug'),

  default: jest.fn(() => {
    const debugObj = { log: jest.fn(() => debugObj) }

    return debugObj
  }),
  createSpan: jest.fn(() => ({ finish: jest.fn() })),
}))

describe('recording is independent of enforcement', () => {
  // @note metering must survive in the planless deployment while entitlement
  // refusal does not: usage recording therefore may not depend on the limit
  // resolution or enforcement modules. This guards the separation
  // structurally - if recording ever grows such an import, decide where the
  // logic actually belongs before extending this list.
  it('imports neither the limits catalogue nor the limit enforcement', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')

    const source = fs.readFileSync(
      require.resolve('@/lib/usage.record'),
      'utf8'
    )

    expect(source).not.toMatch(/@\/config\/limits/)
    expect(source).not.toMatch(/@\/lib\/limit\.core/)
    expect(source).not.toMatch(/@\/lib\/limit\.handler/)
    expect(source).not.toMatch(/@\/lib\/user\.plan/)
  })
})

describe('usage.record', () => {
  afterEach(() => {
    jest.clearAllMocks()

    delete process.env.SKIP_USAGE_RECORDING
  })

  describe('getUsageKey', () => {
    it('should generate correct usage key format', () => {
      const result = getUsageKey('user123', 'token')

      expect(result).toBe('usage-user123-token')
    })

    it('should handle different user IDs and types', () => {
      expect(getUsageKey('abc-def', 'conversation')).toBe(
        'usage-abc-def-conversation'
      )
      expect(getUsageKey('user_456', 'message')).toBe('usage-user_456-message')
      expect(getUsageKey('123', 'fetch')).toBe('usage-123-fetch')
    })

    it('should handle empty strings', () => {
      expect(getUsageKey('', '')).toBe('usage--')
      expect(getUsageKey('user', '')).toBe('usage-user-')
      expect(getUsageKey('', 'type')).toBe('usage--type')
    })
  })

  describe('convertUseTypeToBaseType', () => {
    it('should extract base type from use type', () => {
      expect(convertUseTypeToBaseType('OPENAI_GPT_4_TOKEN')).toBe('token')
      expect(convertUseTypeToBaseType('CHATBOTKIT_CONVERSATION')).toBe(
        'conversation'
      )
      expect(convertUseTypeToBaseType('CHATBOTKIT_MESSAGE')).toBe('message')
      expect(convertUseTypeToBaseType('CHATBOTKIT_IMAGE')).toBe('image')
      expect(convertUseTypeToBaseType('CHATBOTKIT_VIDEO')).toBe('video')
      expect(convertUseTypeToBaseType('CHATBOTKIT_AUDIO')).toBe('audio')
      expect(convertUseTypeToBaseType('CHATBOTKIT_FETCH')).toBe('fetch')
    })

    it('should handle edge cases', () => {
      expect(convertUseTypeToBaseType('SINGLE_WORD')).toBe('word')
      expect(convertUseTypeToBaseType('A_B_C_TOKEN')).toBe('token')
    })

    it('should handle invalid input gracefully', () => {
      expect(() => convertUseTypeToBaseType('')).not.toThrow()
      expect(() => convertUseTypeToBaseType('NO_UNDERSCORE')).not.toThrow()
    })
  })

  describe('getCalibratedBaseCount', () => {
    it('should calibrate language model token counts', () => {
      // mock getBaseLanguageModelTokenCount returns count * 1.2
      expect(getCalibratedBaseCount('OPENAI_GPT_4_TOKEN', 100)).toBe(120)
    })

    it('should calibrate image model token counts', () => {
      // mock getBaseImageModelTokenCount returns count * 3
      expect(getCalibratedBaseCount('OPENAI_GPT_IMAGE_2_TOKEN', 4)).toBe(12)
    })

    it('should calibrate video model token counts', () => {
      // mock getBaseVideoModelTokenCount returns count * 2
      expect(getCalibratedBaseCount('VERCEL_GROK_IMAGINE_VIDEO_TOKEN', 5)).toBe(
        10
      )
    })

    it('should calibrate rerank model token counts', () => {
      // mock getBaseRerankModelTokenCount returns count * 4
      expect(getCalibratedBaseCount('VERCEL_RERANK_V4_FAST_TOKEN', 3)).toBe(12)
    })

    it('should pass through counts for non-calibrated types', () => {
      expect(getCalibratedBaseCount('CHATBOTKIT_CONVERSATION', 7)).toBe(7)
      expect(getCalibratedBaseCount('CHATBOTKIT_EMAIL', 3)).toBe(3)
    })
  })

  describe('resetUsage', () => {
    it('should delete usage key from redis', async () => {
      memcache.del.mockResolvedValue(1)

      await resetUsage('user123', 'OPENAI_GPT_4_TOKEN')

      expect(memcache.del).toHaveBeenCalledWith('usage-user123-token')
    })

    it('should handle different use types', async () => {
      memcache.del.mockResolvedValue(1)

      await resetUsage('user456', 'CHATBOTKIT_CONVERSATION')

      expect(memcache.del).toHaveBeenCalledWith('usage-user456-conversation')
    })
  })

  describe('captureUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})

      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should throw error if not confirmed', async () => {
      await expect(
        captureUsage({
          confirm: false,
          user: { id: 'user123' },
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
        })
      ).rejects.toThrow('Usage not confirmed')
    })

    it('should return early if count is zero', async () => {
      await captureUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 0,
      })

      expect(prisma.usage.create).not.toHaveBeenCalled()
      expect(memcache.incrementInWindow).not.toHaveBeenCalled()
    })

    it('should create usage record in database', async () => {
      await captureUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 100,
        meta: { test: 'meta' },
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            test: 'meta',
          },
        },
      })
    })

    it('should increment usage count in redis', async () => {
      await captureUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 100,
      })

      expect(memcache.incrementInWindow).toHaveBeenCalledWith(
        'usage-user123-token',
        120,
        2678400
      )
    })

    it('should handle language model token conversion', async () => {
      await captureUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 100,
      })

      expect(getBaseLanguageModelTokenCount).toHaveBeenCalledWith('gpt-4', 100)
    })

    it('should handle image model token conversion', async () => {
      await captureUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'OPENAI_GPT_IMAGE_2_TOKEN',
        count: 4,
      })

      expect(getBaseImageModelTokenCount).toHaveBeenCalledWith('dall-e-2', 4)
      expect(memcache.incrementInWindow).toHaveBeenCalledWith(
        'usage-user123-token',
        12,
        2678400
      )
    })

    it('should handle video model token conversion', async () => {
      await captureUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'VERCEL_GROK_IMAGINE_VIDEO_TOKEN',
        count: 5,
      })

      expect(getBaseVideoModelTokenCount).toHaveBeenCalledWith(
        'grok-imagine-video',
        5
      )
      expect(memcache.incrementInWindow).toHaveBeenCalledWith(
        'usage-user123-token',
        10,
        2678400
      )
    })

    it('should handle non-language model types without conversion', async () => {
      await captureUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'CHATBOTKIT_CONVERSATION',
        count: 1,
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'CHATBOTKIT_CONVERSATION',
          count: 1,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
    })

    it('should handle undefined meta gracefully', async () => {
      await captureUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 50,
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'OPENAI_GPT_4_TOKEN',
          count: 50,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
    })

    it('should handle negative token counts', async () => {
      await captureUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: -100,
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'OPENAI_GPT_4_TOKEN',
          count: -100,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })

      expect(memcache.incrementInWindow).toHaveBeenCalledWith(
        'usage-user123-token',
        -120,
        2678400
      )
    })

    it('should handle negative counts with meta', async () => {
      await captureUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: -50,
        meta: {
          reason: 'credit',
          transactionId: 'txn-456',
        },
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'OPENAI_GPT_4_TOKEN',
          count: -50,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            reason: 'credit',
            transactionId: 'txn-456',
          },
        },
      })

      expect(memcache.incrementInWindow).toHaveBeenCalledWith(
        'usage-user123-token',
        -60,
        2678400
      )
    })

    it('should handle negative counts for non-language model types', async () => {
      await captureUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'CHATBOTKIT_CONVERSATION',
        count: -2,
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'CHATBOTKIT_CONVERSATION',
          count: -2,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })

      expect(memcache.incrementInWindow).toHaveBeenCalledWith(
        'usage-user123-conversation',
        -2,
        2678400
      )
    })

    it('should set parentUserId when user has a parent', async () => {
      fastGetUserById.mockResolvedValue({
        id: 'child123',
        parentId: 'parent456',
      })

      await captureUsage({
        confirm: true,
        user: { id: 'child123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 100,
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'child123',
          parentUserId: 'parent456',
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
    })

    it('should not set parentUserId when user has no parent', async () => {
      fastGetUserById.mockResolvedValue({
        id: 'user123',
        parentId: null,
      })

      await captureUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 100,
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          parentUserId: undefined,
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
    })

    it('should not set parentUserId when user lookup fails', async () => {
      fastGetUserById.mockResolvedValue(null)

      await captureUsage({
        confirm: true,
        user: { id: 'unknown' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 100,
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'unknown',
          parentUserId: undefined,
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
    })

    it('should throw UnexpectedStateError if baseCount is not finite', async () => {
      getBaseLanguageModelTokenCount.mockReturnValueOnce(NaN)

      await expect(
        captureUsage({
          confirm: true,
          user: { id: 'user123' },
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
        })
      ).rejects.toThrow('Invalid baseCount: expected finite number')
    })

    it('should throw UnexpectedStateError if baseCount is not an integer', async () => {
      getBaseLanguageModelTokenCount.mockReturnValueOnce(100.5)

      await expect(
        captureUsage({
          confirm: true,
          user: { id: 'user123' },
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
        })
      ).rejects.toThrow('Invalid baseCount: expected integer')
    })

    it('should throw UnexpectedStateError if baseCount exceeds MAX_SAFE_INTEGER', async () => {
      getBaseLanguageModelTokenCount.mockReturnValueOnce(
        Number.MAX_SAFE_INTEGER + 1
      )

      await expect(
        captureUsage({
          confirm: true,
          user: { id: 'user123' },
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
        })
      ).rejects.toThrow('Invalid baseCount: exceeds safe integer range')
    })

    it('should throw UnexpectedStateError if baseCount is Infinity', async () => {
      getBaseLanguageModelTokenCount.mockReturnValueOnce(Infinity)

      await expect(
        captureUsage({
          confirm: true,
          user: { id: 'user123' },
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
        })
      ).rejects.toThrow('Invalid baseCount: expected finite number')
    })
  })

  describe('queueUsage', () => {
    it('should throw error if not confirmed', async () => {
      await expect(
        queueUsage({
          confirm: false,
          user: { id: 'user123' },
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
        })
      ).rejects.toThrow('Usage not confirmed')
    })

    it('should return early if count is zero', async () => {
      await queueUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 0,
      })

      expect(queue).not.toHaveBeenCalled()
    })

    it('should skip if SKIP_USAGE_RECORDING is set', async () => {
      process.env.SKIP_USAGE_RECORDING = 'true'

      await queueUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 100,
      })

      expect(queue).not.toHaveBeenCalled()
    })

    it('should queue usage with correct data structure', async () => {
      await queueUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 100,
        meta: {
          custom: 'data',
        },
      })

      expect(queue).toHaveBeenCalledWith('/api/v1/usage/queue', {
        type: 'record',
        payload: {
          userId: 'user123',
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
          meta: {
            ipAddress: '192.168.1.1',
            conversationId: 'conv123',
            contactId: 'contact456',
            custom: 'data',
          },
          references: undefined,
        },
      })
    })

    it('should handle meta as undefined', async () => {
      await queueUsage({
        confirm: true,
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 50,
      })

      expect(queue).toHaveBeenCalledWith('/api/v1/usage/queue', {
        type: 'record',
        payload: {
          userId: 'user123',
          type: 'OPENAI_GPT_4_TOKEN',
          count: 50,
          meta: {
            ipAddress: '192.168.1.1',
            conversationId: 'conv123',
            contactId: 'contact456',
          },
          references: undefined,
        },
      })
    })
  })

  describe('recordUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})

      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should return early if count is zero', async () => {
      await recordUsage({
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 0,
      })

      expect(fastGetUserById).not.toHaveBeenCalled()
    })

    it('should skip if SKIP_USAGE_RECORDING is set', async () => {
      process.env.SKIP_USAGE_RECORDING = 'true'

      await recordUsage({
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 100,
      })

      expect(fastGetUserById).not.toHaveBeenCalled()
    })

    it('should throw error if user not found', async () => {
      fastGetUserById.mockResolvedValue(null)

      await expect(
        recordUsage({
          user: { id: 'nonexistent' },
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
        })
      ).rejects.toThrow('User not found: nonexistent')
    })

    it('should record usage for user without parent', async () => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      await recordUsage({
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 100,
        meta: {
          test: 'meta',
        },
      })

      expect(prisma.usage.create).toHaveBeenCalledTimes(1)
      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            test: 'meta',
          },
        },
      })
    })

    it('should record usage for both user and parent', async () => {
      fastGetUserById.mockImplementation((id) => {
        if (id === 'child123') {
          return Promise.resolve({ id: 'child123', parentId: 'parent456' })
        }

        if (id === 'parent456') {
          return Promise.resolve({ id: 'parent456', parentId: null })
        }

        return Promise.resolve(null)
      })

      await recordUsage({
        user: { id: 'child123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 100,
        meta: {
          test: 'meta',
        },
      })

      expect(prisma.usage.create).toHaveBeenCalledTimes(2)

      expect(prisma.usage.create).toHaveBeenNthCalledWith(1, {
        data: {
          userId: 'child123',
          parentUserId: 'parent456',
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            test: 'meta',
          },
        },
      })

      expect(prisma.usage.create).toHaveBeenNthCalledWith(2, {
        data: {
          userId: 'parent456',
          parentUserId: undefined,
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            test: 'meta',
            userId: 'child123',
            childId: 'child123',
          },
        },
      })
    })

    const platformEvalCalls = () =>
      memcache.incrementInWindow.mock.calls.filter(
        ([key]) => key === 'usage-platform-token'
      )

    it('should increment the platform token counter once for token usage', async () => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      await recordUsage({
        user: { id: 'user123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 100,
      })

      const calls = platformEvalCalls()

      expect(calls).toHaveLength(1)

      // calibrated via mocked getBaseLanguageModelTokenCount (count * 1.2)
      expect(calls[0]).toEqual(['usage-platform-token', 120, 2678400])
    })

    it('should increment the platform token counter only once for child Users', async () => {
      fastGetUserById.mockImplementation((id) => {
        if (id === 'child123') {
          return Promise.resolve({ id: 'child123', parentId: 'parent456' })
        }

        if (id === 'parent456') {
          return Promise.resolve({ id: 'parent456', parentId: null })
        }

        return Promise.resolve(null)
      })

      await recordUsage({
        user: { id: 'child123' },
        type: 'OPENAI_GPT_4_TOKEN',
        count: 100,
      })

      // the parent/child mirror records the per-user counter twice, but the
      // platform counter must only be incremented once
      expect(platformEvalCalls()).toHaveLength(1)
    })

    it('should not increment the platform token counter for non-token usage', async () => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      await recordUsage({
        user: { id: 'user123' },
        type: 'CHATBOTKIT_CONVERSATION',
        count: 1,
      })

      expect(platformEvalCalls()).toHaveLength(0)
    })
  })

  describe('recordConversationUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})
      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should record with default count of 1', async () => {
      await recordConversationUsage({ user: { id: 'user123' } })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'CHATBOTKIT_CONVERSATION',
          count: 1,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
    })

    it('should record with custom count and meta', async () => {
      await recordConversationUsage({
        user: { id: 'user123' },
        count: 5,
        meta: { sessionId: 'abc123' },
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'CHATBOTKIT_CONVERSATION',
          count: 5,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            sessionId: 'abc123',
          },
        },
      })
    })
  })

  describe('recordMessageUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})

      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should record with default count of 1', async () => {
      await recordMessageUsage({ user: { id: 'user123' } })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'CHATBOTKIT_MESSAGE',
          count: 1,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
    })

    it('should record with custom count and meta', async () => {
      await recordMessageUsage({
        user: { id: 'user123' },
        count: 3,
        meta: { messageType: 'system' },
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'CHATBOTKIT_MESSAGE',
          count: 3,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            messageType: 'system',
          },
        },
      })
    })
  })

  describe('recordLanguageTokenUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})

      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should convert model to use type', async () => {
      await recordLanguageTokenUsage({
        user: { id: 'user123' },
        count: 100,
        model: 'gpt-4',
      })

      expect(languageModelToUseType).toHaveBeenCalledWith('gpt-4')
      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'OPENAI_GPT_4_TOKEN',
          count: 100,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
    })

    it('should handle different models', async () => {
      await recordLanguageTokenUsage({
        user: { id: 'user123' },
        count: 50,
        model: 'gpt-3.5-turbo',
        meta: {
          modelVersion: '0301',
        },
      })

      expect(languageModelToUseType).toHaveBeenCalledWith('gpt-3.5-turbo')
    })

    it('should handle negative token counts', async () => {
      await recordLanguageTokenUsage({
        user: { id: 'user123' },
        count: -50,
        model: 'gpt-4',
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'OPENAI_GPT_4_TOKEN',
          count: -50,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
    })

    it('should handle negative token counts with meta', async () => {
      await recordLanguageTokenUsage({
        user: { id: 'user123' },
        count: -100,
        model: 'gpt-3.5-turbo',
        meta: {
          reason: 'refund',
          originalRequestId: 'req-123',
        },
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'OPENAI_GPT_3_5_TURBO_TOKEN',
          count: -100,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            reason: 'refund',
            originalRequestId: 'req-123',
          },
        },
      })
    })

    it('should handle negative tokens for user with parent', async () => {
      fastGetUserById.mockImplementation((id) => {
        if (id === 'child123') {
          return Promise.resolve({ id: 'child123', parentId: 'parent456' })
        }

        if (id === 'parent456') {
          return Promise.resolve({ id: 'parent456', parentId: null })
        }

        return Promise.resolve(null)
      })

      await recordLanguageTokenUsage({
        user: { id: 'child123' },
        count: -75,
        model: 'gpt-4',
        meta: {
          adjustment: 'correction',
        },
      })

      expect(prisma.usage.create).toHaveBeenCalledTimes(2)

      expect(prisma.usage.create).toHaveBeenNthCalledWith(1, {
        data: {
          userId: 'child123',
          parentUserId: 'parent456',
          type: 'OPENAI_GPT_4_TOKEN',
          count: -75,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            adjustment: 'correction',
          },
        },
      })

      expect(prisma.usage.create).toHaveBeenNthCalledWith(2, {
        data: {
          userId: 'parent456',
          parentUserId: undefined,
          type: 'OPENAI_GPT_4_TOKEN',
          count: -75,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            adjustment: 'correction',
            userId: 'child123',
            childId: 'child123',
          },
        },
      })
    })
  })

  describe('recordImageTokenUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})

      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should convert model to use type', async () => {
      await recordImageTokenUsage({
        user: { id: 'user123' },
        count: 1000,
        model: 'dall-e-2',
      })

      expect(imageModelToUseType).toHaveBeenCalledWith('dall-e-2')
      expect(getBaseImageModelTokenCount).toHaveBeenCalledWith('dall-e-2', 1000)
      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'OPENAI_GPT_IMAGE_2_TOKEN',
          count: 1000,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
      expect(memcache.incrementInWindow).toHaveBeenCalledWith(
        'usage-user123-token',
        3000,
        2678400
      )
    })
  })

  describe('recordImageUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})
      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should use fixed image use type', async () => {
      await recordImageUsage({
        user: { id: 'user123' },
        count: 1,
        model: 'image-model',
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'CHATBOTKIT_IMAGE',
          count: 1,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            model: 'image-model',
          },
        },
      })
    })
  })

  describe('recordAudioTokenUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})
      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should convert speech-to-text model to use type', async () => {
      await recordAudioTokenUsage({
        user: { id: 'user123' },
        count: 1000,
        model: 'gpt-4o-transcribe',
      })

      expect(audioModelToUseType).toHaveBeenCalledWith('gpt-4o-transcribe')
      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'OPENAI_GPT_4O_TRANSCRIBE_TOKEN',
          count: 1000,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
    })

    it('should convert text-to-speech model to use type', async () => {
      await recordAudioTokenUsage({
        user: { id: 'user123' },
        count: 1000,
        model: 'tts-1',
      })

      expect(audioModelToUseType).toHaveBeenCalledWith('tts-1')
      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'OPENAI_TTS_1_TOKEN',
          count: 1000,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
    })
  })

  describe('recordVideoTokenUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})

      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should convert model to use type and calibrate base token usage', async () => {
      await recordVideoTokenUsage({
        user: { id: 'user123' },
        count: 5,
        model: 'grok-imagine-video',
      })

      expect(videoModelToUseType).toHaveBeenCalledWith('grok-imagine-video')
      expect(getBaseVideoModelTokenCount).toHaveBeenCalledWith(
        'grok-imagine-video',
        5
      )
      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'VERCEL_GROK_IMAGINE_VIDEO_TOKEN',
          count: 5,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
      expect(memcache.incrementInWindow).toHaveBeenCalledWith(
        'usage-user123-token',
        10,
        2678400
      )
    })
  })

  describe('recordRerankTokenUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})

      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should convert model to use type and calibrate base token usage', async () => {
      await recordRerankTokenUsage({
        user: { id: 'user123' },
        count: 1,
        model: 'rerank-v4-fast',
      })

      expect(rerankModelToUseType).toHaveBeenCalledWith('rerank-v4-fast')
      expect(getBaseRerankModelTokenCount).toHaveBeenCalledWith(
        'rerank-v4-fast',
        1
      )
      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'VERCEL_RERANK_V4_FAST_TOKEN',
          count: 1,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
      expect(memcache.incrementInWindow).toHaveBeenCalledWith(
        'usage-user123-token',
        4,
        2678400
      )
    })
  })

  describe('recordVideoUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})
      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should use fixed video use type', async () => {
      await recordVideoUsage({
        user: { id: 'user123' },
        count: 2,
        model: 'video-model',
        meta: { reason: 'video/create' },
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'CHATBOTKIT_VIDEO',
          count: 2,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            model: 'video-model',
            reason: 'video/create',
          },
        },
      })
    })
  })

  describe('recordAudioUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})
      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should use fixed audio use type', async () => {
      await recordAudioUsage({
        user: { id: 'user123' },
        count: 60,
        model: 'gpt-4o-transcribe',
        meta: { duration: '1min' },
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'CHATBOTKIT_AUDIO',
          count: 60,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            duration: '1min',
            model: 'gpt-4o-transcribe',
          },
        },
      })
    })
  })

  describe('recordFetchUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})
      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should use fetch use type', async () => {
      await recordFetchUsage({
        user: { id: 'user123' },
        count: 1,
        meta: { url: 'https://example.com' },
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'CHATBOTKIT_FETCH',
          count: 1,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            url: 'https://example.com',
          },
        },
      })
    })
  })

  describe('recordEmailUsage', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user123', parentId: null })

      prisma.usage.create.mockResolvedValue({})

      memcache.incrementInWindow.mockResolvedValue(1)
    })

    it('should use email use type', async () => {
      await recordEmailUsage({
        user: { id: 'user123' },
        count: 1,
        meta: { recipient: 'test@example.com' },
      })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'CHATBOTKIT_EMAIL',
          count: 1,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
            recipient: 'test@example.com',
          },
        },
      })
    })

    it('should handle undefined meta', async () => {
      await recordEmailUsage({ user: { id: 'user123' }, count: 2 })

      expect(prisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'CHATBOTKIT_EMAIL',
          count: 2,
          conversationId: 'conv123',
          messageId: undefined,
          contactId: 'contact456',
          botId: 'bot789',
          datasetId: undefined,
          skillsetId: undefined,
          meta: {
            ipAddress: '192.168.1.1',
          },
        },
      })
    })
  })
})
