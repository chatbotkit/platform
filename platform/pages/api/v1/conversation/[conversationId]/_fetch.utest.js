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

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((x) => x),
}))

describe('GET /api/v1/conversation/{conversationId}/fetch', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('authorization', () => {
    it('should return 404 when conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const req = { query: { conversationId: 'conv_missing' } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when conversation belongs to a different user', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_789',
        userId: 'other_user_999',
        name: 'Some Conversation',
      })

      const req = { query: { conversationId: 'conv_789' } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })
  })

  describe('basic functionality', () => {
    it('should return conversation data for the owner', async () => {
      const mockConversation = {
        id: 'conv_789',
        userId: 'user_123',
        name: 'Test Conversation',
        description: 'A test',
        contactId: null,
        taskId: null,
        botId: 'bot_456',
        datasetId: null,
        skillsetId: null,
        backstory: null,
        model: null,
        privacy: false,
        moderation: false,
        meta: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const req = { query: { conversationId: 'conv_789' } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const body = await result.json()

      expect(body.id).toBe('conv_789')
      expect(body.name).toBe('Test Conversation')
      expect(body.botId).toBe('bot_456')
    })

    it('should remove userId from the returned conversation object', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_789',
        userId: 'user_123',
        name: 'My Conversation',
      })

      const req = { query: { conversationId: 'conv_789' } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const body = await result.json()

      expect(body.userId).toBeUndefined()
    })

    it('should query conversation by conversationId from URL params', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_abc',
        userId: 'user_123',
        name: 'Conversation',
      })

      const req = { query: { conversationId: 'conv_abc' } }

      await handler(req, mockSession)

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv_abc' },
        })
      )
    })

    it('should select the expected set of fields', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_789',
        userId: 'user_123',
      })

      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession)

      const selectArg = prisma.conversation.findUnique.mock.calls[0][0].select

      expect(selectArg).toMatchObject({
        id: true,
        userId: true,
        name: true,
        description: true,
        contactId: true,
        taskId: true,
        botId: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      })
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      prisma.conversation.findUnique.mockRejectedValue(
        new Error('DB connection failed')
      )

      const req = { query: { conversationId: 'conv_789' } }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'DB connection failed'
      )
    })
  })
})
