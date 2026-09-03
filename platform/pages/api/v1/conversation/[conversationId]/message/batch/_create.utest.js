/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import prisma from '@/prisma/client'

import handler, { bodySchema } from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: jest.fn(),
    },
    message: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/message', () => ({
  getMessageType: jest.fn((type) => type),
}))

jest.mock('@/lib/pii', () => ({
  detectPiiEntities: jest.fn(() => Promise.resolve([])),
  getSafeTextAndEntities: jest.fn((text, _entities, knownEntities) => ({
    safeText: text,
    safeEntities: knownEntities,
  })),
}))

jest.mock('@/lib/usage.record', () => ({
  recordMessageUsage: jest.fn(() => Promise.resolve()),
}))

describe('POST /api/v1/conversation/{conversationId}/message/batch/create', () => {
  const { detectPiiEntities, getSafeTextAndEntities } = require('@/lib/pii')
  const { recordMessageUsage } = require('@/lib/usage.record')

  const mockSession = {
    user: { id: 'user_123' },
  }

  const mockReq = { query: { conversationId: 'conv_abc' } }

  const mockConversation = {
    id: 'conv_abc',
    userId: 'user_123',
  }

  let messageIdCounter = 0

  beforeEach(() => {
    jest.clearAllMocks()
    messageIdCounter = 0
    prisma.message.create.mockImplementation(() => {
      messageIdCounter++

      return Promise.resolve({ id: `msg_${messageIdCounter}` })
    })
  })

  describe('authorization', () => {
    it('should return 404 when conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession, {
        items: [{ type: 'user', text: 'hello' }],
      })

      expect(result.status).toBe(404)
      expect(prisma.message.create).not.toHaveBeenCalled()
    })

    it('should return 403 when conversation belongs to a different user', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_abc',
        userId: 'other_user_999',
      })

      const result = await handler(mockReq, mockSession, {
        items: [{ type: 'user', text: 'hello' }],
      })

      expect(result.status).toBe(403)
      expect(prisma.message.create).not.toHaveBeenCalled()
    })
  })

  describe('basic batch creation', () => {
    it('should create a single message and return its id', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const result = await handler(mockReq, mockSession, {
        items: [{ type: 'user', text: 'hello world' }],
      })

      expect(result.status).toBe(200)

      const body = await result.json()

      expect(body.items).toHaveLength(1)
      expect(body.items[0].id).toBe('msg_1')
    })

    it('should create multiple messages and return all ids in order', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const result = await handler(mockReq, mockSession, {
        items: [
          { type: 'user', text: 'first' },
          { type: 'bot', text: 'second' },
          { type: 'user', text: 'third' },
        ],
      })

      expect(result.status).toBe(200)

      const body = await result.json()

      expect(body.items).toHaveLength(3)
      expect(body.items[0].id).toBe('msg_1')
      expect(body.items[1].id).toBe('msg_2')
      expect(body.items[2].id).toBe('msg_3')
    })

    it('should preserve the originalId from each item in the response', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const result = await handler(mockReq, mockSession, {
        items: [
          { id: 'original_001', type: 'user', text: 'imported message' },
          { id: 'original_002', type: 'bot', text: 'imported reply' },
        ],
      })

      const body = await result.json()

      expect(body.items[0].originalId).toBe('original_001')
      expect(body.items[1].originalId).toBe('original_002')
    })

    it('should store messages with correct conversationId', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, {
        items: [{ type: 'user', text: 'test' }],
      })

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: 'conv_abc',
          }),
        })
      )
    })

    it('should store message type and text correctly', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, {
        items: [
          {
            type: 'bot',
            text: 'AI response here',
            name: 'msg-name',
            meta: { key: 'val' },
          },
        ],
      })

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'bot',
            text: 'AI response here',
            name: 'msg-name',
            meta: { key: 'val' },
          }),
        })
      )
    })

    it('should record usage for the total number of messages created', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, {
        items: [
          { type: 'user', text: 'one' },
          { type: 'bot', text: 'two' },
          { type: 'user', text: 'three' },
        ],
      })

      expect(recordMessageUsage).toHaveBeenCalledWith({
        user: mockSession.user,
        count: 3,
      })
    })

    it('should select only id from prisma.message.create', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, {
        items: [{ type: 'user', text: 'hello' }],
      })

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true },
        })
      )
    })
  })

  describe('PII handling', () => {
    it('should NOT run PII detection when no knownEntities are provided', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, {
        items: [{ type: 'user', text: 'my email is test@example.com' }],
      })

      expect(detectPiiEntities).not.toHaveBeenCalled()
      expect(getSafeTextAndEntities).not.toHaveBeenCalled()

      // text should be stored as-is
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            text: 'my email is test@example.com',
          }),
        })
      )
    })

    it('should return empty entities when no knownEntities are provided', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const result = await handler(mockReq, mockSession, {
        items: [{ type: 'user', text: 'plain message' }],
      })

      const body = await result.json()

      expect(body.items[0].entities).toEqual([])
    })

    it('should run PII detection when knownEntities are provided', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const knownEntities = [{ type: 'EMAIL', begin: 0, end: 16 }]

      detectPiiEntities.mockResolvedValue([
        { type: 'EMAIL', begin: 0, end: 16 },
      ])
      getSafeTextAndEntities.mockReturnValue({
        safeText: '[REDACTED] is my email',
        safeEntities: knownEntities,
      })

      await handler(mockReq, mockSession, {
        items: [
          {
            type: 'user',
            text: 'test@example.com is my email',
            entities: knownEntities,
          },
        ],
      })

      expect(detectPiiEntities).toHaveBeenCalledWith(
        'test@example.com is my email'
      )
      expect(getSafeTextAndEntities).toHaveBeenCalled()

      // stores redacted text
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ text: '[REDACTED] is my email' }),
        })
      )
    })

    it('should return safeEntities in the response when PII was processed', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const knownEntities = [{ type: 'PHONE', begin: 5, end: 13 }]
      const safeEntities = [{ type: 'PHONE', value: '[PHONE]' }]

      detectPiiEntities.mockResolvedValue([])
      getSafeTextAndEntities.mockReturnValue({
        safeText: 'call [PHONE]',
        safeEntities,
      })

      const result = await handler(mockReq, mockSession, {
        items: [
          {
            type: 'user',
            text: 'call 555-1234',
            entities: knownEntities,
          },
        ],
      })

      const body = await result.json()

      expect(body.items[0].entities).toEqual(safeEntities)
    })

    it('should process PII independently per message in the batch', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const knownEntities = [{ type: 'EMAIL', begin: 0, end: 5 }]

      detectPiiEntities.mockResolvedValue([])
      getSafeTextAndEntities.mockReturnValue({
        safeText: '[X]',
        safeEntities: [],
      })

      await handler(mockReq, mockSession, {
        items: [
          { type: 'user', text: 'msg with entities', entities: knownEntities },
          { type: 'bot', text: 'msg without entities' },
          {
            type: 'user',
            text: 'another with entities',
            entities: knownEntities,
          },
        ],
      })

      // PII detection only called for messages with known entities
      expect(detectPiiEntities).toHaveBeenCalledTimes(2)
    })
  })

  describe('bodySchema validation', () => {
    it('should allow empty body (items is optional at schema level)', () => {
      // @note items is validated as array with min(1) but not marked required,
      // so an empty object passes schema validation; the handler requires items via body
      const { error } = bodySchema.validate({})

      expect(error).toBeUndefined()
    })

    it('should reject an empty items array', () => {
      const { error } = bodySchema.validate({ items: [] })

      expect(error).toBeDefined()
    })

    it('should reject items array with more than 100 entries', () => {
      const items = Array.from({ length: 101 }, (_, i) => ({
        type: 'user',
        text: `message ${i}`,
      }))

      const { error } = bodySchema.validate({ items })

      expect(error).toBeDefined()
    })

    it('should accept items array with exactly 100 entries', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        type: 'user',
        text: `message ${i}`,
      }))

      const { error } = bodySchema.validate({ items })

      expect(error).toBeUndefined()
    })

    it('should accept a valid single-item batch', () => {
      const { error } = bodySchema.validate({
        items: [{ type: 'user', text: 'hello' }],
      })

      expect(error).toBeUndefined()
    })

    it('should require type on each item', () => {
      const { error } = bodySchema.validate({
        items: [{ text: 'hello' }],
      })

      expect(error).toBeDefined()
    })

    it('should require text on each item', () => {
      const { error } = bodySchema.validate({
        items: [{ type: 'user' }],
      })

      expect(error).toBeDefined()
    })

    it('should accept all optional item fields', () => {
      const { error } = bodySchema.validate({
        items: [
          {
            id: 'orig_001',
            name: 'msg-name',
            description: 'a description',
            type: 'bot',
            text: 'response text',
            entities: [],
            meta: { source: 'zendesk' },
          },
        ],
      })

      expect(error).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('should propagate database errors from findUnique', async () => {
      prisma.conversation.findUnique.mockRejectedValue(
        new Error('DB connection failed')
      )

      await expect(
        handler(mockReq, mockSession, {
          items: [{ type: 'user', text: 'hello' }],
        })
      ).rejects.toThrow('DB connection failed')

      expect(prisma.message.create).not.toHaveBeenCalled()
    })

    it('should propagate database errors from message.create', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.message.create.mockRejectedValue(new Error('Insert failed'))

      await expect(
        handler(mockReq, mockSession, {
          items: [{ type: 'user', text: 'hello' }],
        })
      ).rejects.toThrow('Insert failed')

      expect(recordMessageUsage).not.toHaveBeenCalled()
    })
  })
})
