/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: jest.fn(),
    },
    message: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (obj) => obj,
}))

describe('/api/v1/conversation/[conversationId]/message/[messageId]/fetch', () => {
  const mockSession = {
    user: { id: 'user_123' },
  }

  const mockReq = {
    query: { conversationId: 'conv_abc', messageId: 'msg_xyz' },
  }

  const mockConversationWithMessage = {
    id: 'conv_abc',
    userId: 'user_123',
    messages: [{ id: 'msg_xyz' }],
  }

  const mockMessageFull = {
    id: 'msg_xyz',
    type: 'user',
    text: 'Hello, world!',
    meta: null,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return the message when conversation and message exist and user owns the conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        mockConversationWithMessage
      )
      prisma.message.findUnique.mockResolvedValue(mockMessageFull)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toEqual(mockMessageFull)
    })

    it('should query conversation by conversationId from URL params', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        mockConversationWithMessage
      )
      prisma.message.findUnique.mockResolvedValue(mockMessageFull)

      await handler(mockReq, mockSession)

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv_abc' },
        })
      )
    })

    it('should query message by ID resolved from the conversation lookup', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        mockConversationWithMessage
      )
      prisma.message.findUnique.mockResolvedValue(mockMessageFull)

      await handler(mockReq, mockSession)

      expect(prisma.message.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg_xyz' },
        })
      )
    })
  })

  describe('authorization', () => {
    it('should return 404 when the conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.message.findUnique).not.toHaveBeenCalled()
    })

    it('should return 403 when the session user does not own the conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversationWithMessage,
        userId: 'other_user_999',
      })

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.message.findUnique).not.toHaveBeenCalled()
    })

    it('should return 404 when the message is not found in the conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_abc',
        userId: 'user_123',
        messages: [], // message not found inside this conversation
      })

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.message.findUnique).not.toHaveBeenCalled()
    })

    it('should return 404 when the message record itself is not found on second query', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        mockConversationWithMessage
      )
      prisma.message.findUnique.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
    })

    it('should not allow cross-user access: user B cannot fetch user A message', async () => {
      // Conversation belongs to user A; session is user B
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_abc',
        userId: 'user_A',
        messages: [{ id: 'msg_xyz' }],
      })

      const sessionB = { user: { id: 'user_B' } }
      const result = await handler(mockReq, sessionB)

      expect(result.status).toBe(403)
      expect(prisma.message.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should propagate database errors from conversation findUnique', async () => {
      prisma.conversation.findUnique.mockRejectedValue(new Error('DB error'))

      await expect(handler(mockReq, mockSession)).rejects.toThrow('DB error')
    })

    it('should propagate database errors from message findUnique', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        mockConversationWithMessage
      )
      prisma.message.findUnique.mockRejectedValue(new Error('Message DB error'))

      await expect(handler(mockReq, mockSession)).rejects.toThrow(
        'Message DB error'
      )
    })
  })
})
