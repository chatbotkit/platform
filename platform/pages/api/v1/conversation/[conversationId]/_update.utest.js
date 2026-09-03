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
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/conversation.idle', () => ({
  untrackIdlingConversations: jest.fn(),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((newMeta, _existingMeta) => newMeta),
}))

describe('POST /api/v1/conversation/{conversationId}/update', () => {
  const { untrackIdlingConversations } = require('@/lib/conversation.idle')
  const { getMeta } = require('@/lib/meta')

  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockConversation = {
    id: 'conv_789',
    userId: 'user_123',
    name: 'Old Name',
    meta: { existing: 'value' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.conversation.update.mockResolvedValue({ id: 'conv_789' })
  })

  describe('authorization', () => {
    it('should return 404 when conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const req = { query: { conversationId: 'conv_missing' } }
      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(404)
      expect(prisma.conversation.update).not.toHaveBeenCalled()
      expect(untrackIdlingConversations).not.toHaveBeenCalled()
    })

    it('should return 403 when conversation belongs to a different user', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_789',
        userId: 'other_user_999',
      })

      const req = { query: { conversationId: 'conv_789' } }
      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(403)
      expect(prisma.conversation.update).not.toHaveBeenCalled()
      expect(untrackIdlingConversations).not.toHaveBeenCalled()
    })
  })

  describe('basic functionality', () => {
    it('should update conversation and return its id', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const req = { query: { conversationId: 'conv_789' } }
      const result = await handler(req, mockSession, { name: 'New Name' })

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({ id: 'conv_789' })
    })

    it('should call untrackIdlingConversations after a successful update', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession, { name: 'Updated' })

      expect(untrackIdlingConversations).toHaveBeenCalledWith(['conv_789'])
    })

    it('should update name and description fields', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession, {
        name: 'New Name',
        description: 'New Description',
      })

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv_789' },
          data: expect.objectContaining({
            name: 'New Name',
            description: 'New Description',
          }),
        })
      )
    })

    it('should update model and backstory fields', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession, {
        backstory: 'You are a helpful assistant',
        model: 'gpt-4',
      })

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            backstory: 'You are a helpful assistant',
            model: 'gpt-4',
          }),
        })
      )
    })

    it('should set contactId from contact object', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession, {
        contactId: { id: 'contact_abc' },
      })

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contactId: 'contact_abc',
          }),
        })
      )
    })

    it('should set taskId from task object', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession, {
        taskId: { id: 'task_xyz' },
      })

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskId: 'task_xyz',
          }),
        })
      )
    })

    it('should call getMeta to merge metadata', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getMeta.mockReturnValue({ merged: true })

      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession, { meta: { newKey: 'newValue' } })

      expect(getMeta).toHaveBeenCalledWith(
        { newKey: 'newValue' },
        mockConversation.meta
      )

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: { merged: true },
          }),
        })
      )
    })

    it('should look up conversation by conversationId from URL param', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession, {})

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'conv_789' },
      })
    })
  })

  describe('error handling', () => {
    it('should propagate database errors from findUnique', async () => {
      prisma.conversation.findUnique.mockRejectedValue(
        new Error('DB connection failed')
      )

      const req = { query: { conversationId: 'conv_789' } }

      await expect(handler(req, mockSession, {})).rejects.toThrow(
        'DB connection failed'
      )
    })

    it('should propagate database errors from update', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.conversation.update.mockRejectedValue(new Error('Update failed'))

      const req = { query: { conversationId: 'conv_789' } }

      await expect(handler(req, mockSession, { name: 'New' })).rejects.toThrow(
        'Update failed'
      )

      // untrack should not be called if update fails
      expect(untrackIdlingConversations).not.toHaveBeenCalled()
    })
  })
})
