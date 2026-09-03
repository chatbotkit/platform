/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: jest.fn(),
    },
    message: {
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
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

describe('/api/v1/conversation/[conversationId]/message/[messageId]/delete', () => {
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

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.message.delete.mockResolvedValue({ id: 'msg_xyz' })
  })

  describe('basic functionality', () => {
    it('should delete the message and return its id', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        mockConversationWithMessage
      )

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'msg_xyz' })
    })

    it('should call prisma.message.delete with the resolved message id', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        mockConversationWithMessage
      )

      await handler(mockReq, mockSession)

      expect(prisma.message.delete).toHaveBeenCalledWith({
        where: { id: 'msg_xyz' },
      })
    })

    it('should query conversation by conversationId URL param', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        mockConversationWithMessage
      )

      await handler(mockReq, mockSession)

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv_abc' },
        })
      )
    })
  })

  describe('authorization', () => {
    it('should return 404 when the conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.message.delete).not.toHaveBeenCalled()
    })

    it('should return 403 when the session user does not own the conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversationWithMessage,
        userId: 'other_user_999',
      })

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.message.delete).not.toHaveBeenCalled()
    })

    it('should return 404 when the message is not in the conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_abc',
        userId: 'user_123',
        messages: [],
      })

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.message.delete).not.toHaveBeenCalled()
    })

    it('should not allow cross-user deletion: user B cannot delete user A message', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_abc',
        userId: 'user_A',
        messages: [{ id: 'msg_xyz' }],
      })

      const sessionB = { user: { id: 'user_B' } }
      const result = await handler(mockReq, sessionB)

      expect(result.status).toBe(403)
      expect(prisma.message.delete).not.toHaveBeenCalled()
    })

    it('should delete only the message belonging to the conversation, not by messageId directly', async () => {
      // The handler looks up the message via conversation.messages filter,
      // then deletes by the resolved id - not directly by the URL param.
      // This test verifies the resolved id is used.
      const resolvedId = 'resolved_msg_id'

      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_abc',
        userId: 'user_123',
        messages: [{ id: resolvedId }],
      })

      await handler(mockReq, mockSession)

      expect(prisma.message.delete).toHaveBeenCalledWith({
        where: { id: resolvedId },
      })
    })
  })

  describe('error handling', () => {
    it('should propagate database errors from conversation findUnique', async () => {
      prisma.conversation.findUnique.mockRejectedValue(
        new Error('DB connection failed')
      )

      await expect(handler(mockReq, mockSession)).rejects.toThrow(
        'DB connection failed'
      )
    })

    it('should propagate database errors from message delete', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        mockConversationWithMessage
      )
      prisma.message.delete.mockRejectedValue(new Error('Delete failed'))

      await expect(handler(mockReq, mockSession)).rejects.toThrow(
        'Delete failed'
      )
    })
  })
})
