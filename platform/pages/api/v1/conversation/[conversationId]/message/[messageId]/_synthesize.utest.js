/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './synthesize'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: jest.fn((limits, fn) => {
    fn.accountLimits = limits

    return fn
  }),
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/storage', () => ({
  getObjectDownloadUrl: jest.fn(),
  putObject: jest.fn(),
}))

jest.mock('@/lib/cache', () => ({
  ttlCache: jest.fn(async (_key, _ttl, fn) => fn()),
}))

jest.mock('@/lib/header', () => ({
  getAcceptHeader: jest.fn(() => 'application/json'),
}))

jest.mock('@/lib/model.provider.openai', () => ({
  createSpeech: jest.fn(),
  getSpeechUsage: jest.fn(),
}))

jest.mock('@/lib/webcrypto', () => ({
  sha256: jest.fn(() => Promise.resolve('testhash')),
}))

jest.mock('@/lib/usage.record', () => ({
  recordAudioTokenUsage: jest.fn().mockResolvedValue(undefined),
  recordAudioUsage: jest.fn().mockResolvedValue(undefined),
}))

describe('POST /api/v1/conversation/{conversationId}/message/{messageId}/synthesize', () => {
  const { getObjectDownloadUrl, putObject } = require('@/lib/storage')

  const { ttlCache } = require('@/lib/cache')
  const { getAcceptHeader } = require('@/lib/header')
  const { createSpeech, getSpeechUsage } = require('@/lib/model.provider.openai')
  const {
    recordAudioTokenUsage,
    recordAudioUsage,
  } = require('@/lib/usage.record')

  const mockSession = {
    user: { id: 'user_123' },
  }

  const mockReq = {
    query: {
      conversationId: 'conv_abc',
      messageId: 'msg_xyz',
    },
  }

  const mockConversation = {
    id: 'conv_abc',
    userId: 'user_123',
    botId: 'bot_111',
    messages: [
      {
        id: 'msg_xyz',
        text: 'Hello, this is the full message text.',
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()

    getAcceptHeader.mockReturnValue('application/json')
    createSpeech.mockResolvedValue({
      data: new ArrayBuffer(8),
      usage: {
        totalTokens: 37,
        promptTokens: 37,
        completionTokens: 0,
      },
    })
    getSpeechUsage.mockReturnValue({
      totalTokens: 37,
      promptTokens: 37,
      completionTokens: 0,
    })
    putObject.mockResolvedValue(undefined)
    getObjectDownloadUrl.mockResolvedValue('https://cdn.example.com/audio.mp3')
    ttlCache.mockImplementation(async (_key, _ttl, fn) => fn())
  })

  it('should guard synthesis with token and audio account limits', () => {
    expect(handler.accountLimits).toEqual(['token', 'audio'])
  })

  describe('authorization', () => {
    it('should return 404 when conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(404)
      expect(createSpeech).not.toHaveBeenCalled()
    })

    it('should return 403 when conversation belongs to a different user', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        userId: 'other_user_999',
      })

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(403)
      expect(createSpeech).not.toHaveBeenCalled()
    })

    it('should return 404 when message is not found in conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        messages: [],
      })

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(404)
      expect(createSpeech).not.toHaveBeenCalled()
    })
  })

  describe('JSON output format (default)', () => {
    it('should synthesize and return JSON with message id and url', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(200)

      const body = await result.json()

      expect(body).toMatchObject({
        id: 'msg_xyz',
        url: 'https://cdn.example.com/audio.mp3',
      })
    })

    it('should upload audio to S3 with content-addressed key', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, {})

      expect(putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(
          'conversation/conv_abc/message/msg_xyz/original'
        ),
        expect.any(Uint8Array)
      )
    })

    it('should pass the S3 key to getObjectDownloadUrl', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, {})

      expect(getObjectDownloadUrl).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('conversation/conv_abc/message/msg_xyz')
      )
    })

    it('should invoke createSpeech with full message text by default', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, {})

      expect(createSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'Hello, this is the full message text.',
          model: 'tts-1',
          voice: 'alloy',
        })
      )
    })
  })

  describe('audio/mpeg output format', () => {
    it('should return a redirect when Accept: audio/mpeg', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getAcceptHeader.mockReturnValue('audio/mpeg')

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(302)
      expect(result.headers.get('Location')).toBe(
        'https://cdn.example.com/audio.mp3'
      )
    })
  })

  describe('partial text synthesis', () => {
    it('should synthesize only the matched substring when text is provided', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, { text: 'full message' })

      expect(createSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'full message',
        })
      )
    })

    it('should use the full message text when the provided text is not found', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, {
        text: 'text not present in message',
      })

      expect(createSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'Hello, this is the full message text.',
        })
      )
    })
  })

  describe('caching', () => {
    it('should not call createSpeech on a cache hit', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const proposedKey =
        'conversation/conv_abc/message/msg_xyz/original.json:::testhash'

      // Simulate cache hit: return the key without calling the factory
      ttlCache.mockImplementation(async () => proposedKey)

      await handler(mockReq, mockSession, {})

      expect(createSpeech).not.toHaveBeenCalled()
      expect(putObject).not.toHaveBeenCalled()
    })

    it('should call createSpeech and putObject on a cache miss', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      // Simulate cache miss: call the factory
      ttlCache.mockImplementation(async (_key, _ttl, fn) => fn())

      await handler(mockReq, mockSession, {})

      expect(createSpeech).toHaveBeenCalledTimes(1)
      expect(putObject).toHaveBeenCalledTimes(1)
    })

    it('should use a content-addressed cache key based on sha256 of input', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const { sha256 } = require('@/lib/webcrypto')

      sha256.mockResolvedValue('contenthash')

      await handler(mockReq, mockSession, {})

      expect(ttlCache).toHaveBeenCalledWith(
        expect.stringContaining('synthesize:'),
        expect.any(Number),
        expect.any(Function)
      )

      const cacheKey = ttlCache.mock.calls[0][0]

      expect(cacheKey).toContain('contenthash')
    })
  })

  describe('usage recording', () => {
    it('should record token usage after synthesis', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, {})

      expect(recordAudioTokenUsage).toHaveBeenCalledTimes(1)
      expect(recordAudioTokenUsage).toHaveBeenCalledWith({
        user: { id: 'user_123' },
        count: expect.any(Number),
        model: 'tts-1',
        meta: { reason: 'message/synthesize' },
        references: {
          conversationId: 'conv_abc',
          messageId: 'msg_xyz',
        },
      })
      expect(recordAudioUsage).toHaveBeenCalledTimes(1)
      expect(recordAudioUsage).toHaveBeenCalledWith({
        user: { id: 'user_123' },
        count: 1,
        model: 'tts-1',
        meta: { reason: 'message/synthesize' },
        references: {
          conversationId: 'conv_abc',
          messageId: 'msg_xyz',
        },
      })
    })

    it('should record token usage returned by speech generation', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, {})

      expect(recordAudioTokenUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 37,
        })
      )
    })

    it('should still record usage even for a cache hit', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const proposedKey =
        'conversation/conv_abc/message/msg_xyz/original.json:::testhash'

      ttlCache.mockImplementation(async () => proposedKey)

      await handler(mockReq, mockSession, {})

      expect(recordAudioTokenUsage).toHaveBeenCalledTimes(1)
      expect(recordAudioTokenUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 37,
        })
      )
      expect(recordAudioUsage).toHaveBeenCalledTimes(1)
    })
  })

  describe('prisma query', () => {
    it('should query conversation with messages filtered by message id', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, {})

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv_abc' },
          select: expect.objectContaining({
            messages: expect.objectContaining({
              where: { id: 'msg_xyz' },
              take: 1,
            }),
          }),
        })
      )
    })
  })
})
