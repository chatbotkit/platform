/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './update'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: jest.fn(),
    },
    message: {
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/pii', () => ({
  detectPiiEntities: jest.fn(),
  getSafeTextAndEntities: jest.fn(),
}))

jest.mock('@/lib/message', () => ({
  getMessageType: jest.fn((t) => t),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((newMeta, existingMeta) => ({
    ...existingMeta,
    ...newMeta,
  })),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/schemas/description', () =>
  jest.requireActual('@/lib/joi.schema').default.string().optional()
)
jest.mock('@/schemas/messageText', () =>
  jest.requireActual('@/lib/joi.schema').default.string().optional()
)
jest.mock('@/schemas/messageType', () =>
  jest.requireActual('@/lib/joi.schema').default.string().optional()
)
jest.mock('@/schemas/meta', () =>
  jest
    .requireActual('@/lib/joi.schema')
    .default.object()
    .unknown(true)
    .optional()
)
jest.mock('@/schemas/name', () =>
  jest.requireActual('@/lib/joi.schema').default.string().optional()
)

const { detectPiiEntities, getSafeTextAndEntities } = require('@/lib/pii')
const { getMessageType } = require('@/lib/message')
const { getMeta } = require('@/lib/meta')

describe('/api/v1/conversation/[conversationId]/message/[messageId]/update', () => {
  const mockSession = {
    user: { id: 'user_123' },
  }

  const mockReq = {
    query: { conversationId: 'conv_abc', messageId: 'msg_xyz' },
  }

  const mockConversation = {
    id: 'conv_abc',
    userId: 'user_123',
    messages: [{ id: 'msg_xyz', meta: { existingKey: 'existingValue' } }],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.message.update.mockResolvedValue({ id: 'msg_xyz' })
  })

  describe('basic functionality', () => {
    it('should update the message and return its id with empty entities', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const result = await handler(mockReq, mockSession, {
        text: 'Updated text',
      })

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({ id: 'msg_xyz', entities: [] })
    })

    it('should update only the provided fields - text only', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, { text: 'New content' })

      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg_xyz' },
          data: expect.objectContaining({ text: 'New content' }),
        })
      )
    })

    it('should use the resolved message id from the conversation lookup for the update', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        messages: [{ id: 'resolved_msg_id', meta: {} }],
      })

      await handler(
        { query: { conversationId: 'conv_abc', messageId: 'resolved_msg_id' } },
        mockSession,
        {}
      )

      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'resolved_msg_id' } })
      )
    })

    it('should pass type through getMessageType when provided', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getMessageType.mockReturnValue('bot')

      await handler(mockReq, mockSession, { type: 'bot' })

      expect(getMessageType).toHaveBeenCalledWith('bot')
      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'bot' }),
        })
      )
    })

    it('should leave type as undefined when not provided', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, {})

      const updateData = prisma.message.update.mock.calls[0][0].data

      expect(updateData.type).toBeUndefined()
    })

    it('should call getMeta with new meta and existing message meta', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const newMeta = { newKey: 'newValue' }

      await handler(mockReq, mockSession, { meta: newMeta })

      expect(getMeta).toHaveBeenCalledWith(newMeta, {
        existingKey: 'existingValue',
      })
    })
  })

  describe('PII detection', () => {
    it('should run PII detection when both text and knownEntities are provided', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      detectPiiEntities.mockResolvedValue([{ begin: 5, end: 20 }])
      getSafeTextAndEntities.mockReturnValue({
        safeText: 'safe text',
        safeEntities: [{ begin: 5, end: 20 }],
      })

      const result = await handler(mockReq, mockSession, {
        text: 'hello john@example.com',
        entities: [{ begin: 6, end: 21 }],
      })

      expect(detectPiiEntities).toHaveBeenCalledWith('hello john@example.com')
      expect(getSafeTextAndEntities).toHaveBeenCalledWith(
        'hello john@example.com',
        [{ begin: 5, end: 20 }],
        [{ begin: 6, end: 21 }]
      )
      expect(result.status).toBe(200)

      const body = await result.json()

      expect(body.entities).toEqual([{ begin: 5, end: 20 }])
    })

    it('should not run PII detection when text is provided without knownEntities', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const result = await handler(mockReq, mockSession, { text: 'plain text' })

      expect(detectPiiEntities).not.toHaveBeenCalled()
      expect(getSafeTextAndEntities).not.toHaveBeenCalled()

      const body = await result.json()

      expect(body.entities).toEqual([])
    })

    it('should not run PII detection when knownEntities is empty', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      await handler(mockReq, mockSession, { text: 'plain text', entities: [] })

      expect(detectPiiEntities).not.toHaveBeenCalled()
    })

    it('should save the safe (redacted) text to the database', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      detectPiiEntities.mockResolvedValue([])
      getSafeTextAndEntities.mockReturnValue({
        safeText: 'hello [REDACTED]',
        safeEntities: [{ begin: 6, end: 16 }],
      })

      await handler(mockReq, mockSession, {
        text: 'hello john@example.com',
        entities: [{ begin: 6, end: 21 }],
      })

      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ text: 'hello [REDACTED]' }),
        })
      )
    })

    it('should return safeEntities from PII detection in the response', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      detectPiiEntities.mockResolvedValue([])
      getSafeTextAndEntities.mockReturnValue({
        safeText: 'redacted text',
        safeEntities: [{ begin: 0, end: 5, type: 'EMAIL' }],
      })

      const result = await handler(mockReq, mockSession, {
        text: 'sensitive',
        entities: [{ begin: 0, end: 9 }],
      })

      const body = await result.json()

      expect(body.entities).toEqual([{ begin: 0, end: 5, type: 'EMAIL' }])
    })
  })

  describe('authorization', () => {
    it('should return 404 when the conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(404)
      expect(prisma.message.update).not.toHaveBeenCalled()
    })

    it('should return 403 when the session user does not own the conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        userId: 'other_user_999',
      })

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(403)
      expect(prisma.message.update).not.toHaveBeenCalled()
    })

    it('should return 404 when the message is not in the conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        messages: [],
      })

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(404)
      expect(prisma.message.update).not.toHaveBeenCalled()
    })

    it('should not allow cross-user update: user B cannot update user A message', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        userId: 'user_A',
      })

      const sessionB = { user: { id: 'user_B' } }
      const result = await handler(mockReq, sessionB, { text: 'hijacked' })

      expect(result.status).toBe(403)
      expect(prisma.message.update).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should propagate database errors from conversation findUnique', async () => {
      prisma.conversation.findUnique.mockRejectedValue(
        new Error('DB connection failed')
      )

      await expect(handler(mockReq, mockSession, {})).rejects.toThrow(
        'DB connection failed'
      )
    })

    it('should propagate database errors from message update', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.message.update.mockRejectedValue(new Error('Update failed'))

      await expect(
        handler(mockReq, mockSession, { text: 'updated' })
      ).rejects.toThrow('Update failed')
    })

    it('should propagate PII detection errors', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      detectPiiEntities.mockRejectedValue(new Error('PII service unavailable'))

      await expect(
        handler(mockReq, mockSession, {
          text: 'sensitive',
          entities: [{ begin: 0, end: 9 }],
        })
      ).rejects.toThrow('PII service unavailable')
    })
  })
})
