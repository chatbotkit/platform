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
  },
}))

jest.mock('@/lib/conversation.delete', () => ({
  deleteConversation: jest.fn(),
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

const { deleteConversation } = require('@/lib/conversation.delete')

describe('/api/v1/conversation/[conversationId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should delete conversation and return its id', async () => {
      const mockConversation = {
        id: 'conv_789',
        userId: 'user_123',
      }

      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      deleteConversation.mockResolvedValue(undefined)

      const req = {
        query: { conversationId: 'conv_789' },
      }

      const result = await handler(req, mockSession)

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'conv_789',
        },
      })
      expect(deleteConversation).toHaveBeenCalledWith('conv_789')
      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({ id: 'conv_789' })
    })
  })

  describe('error handling', () => {
    it('should return 404 when conversation not found', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const req = {
        query: { conversationId: 'nonexistent_conv' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(deleteConversation).not.toHaveBeenCalled()
    })

    it('should return 401 when user does not own conversation', async () => {
      const mockConversation = {
        id: 'conv_789',
        userId: 'other_user_999',
      }

      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const req = {
        query: { conversationId: 'conv_789' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(deleteConversation).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle database error gracefully', async () => {
      const dbError = new Error('Database connection failed')

      prisma.conversation.findUnique.mockRejectedValue(dbError)

      const req = {
        query: { conversationId: 'conv_789' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
      expect(deleteConversation).not.toHaveBeenCalled()
    })

    it('should handle deleteConversation failure', async () => {
      const mockConversation = {
        id: 'conv_789',
        userId: 'user_123',
      }

      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      deleteConversation.mockRejectedValue(new Error('Delete operation failed'))

      const req = {
        query: { conversationId: 'conv_789' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Delete operation failed'
      )
    })
  })
})
