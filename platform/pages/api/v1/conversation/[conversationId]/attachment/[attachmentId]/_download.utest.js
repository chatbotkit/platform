/**
 * @jest-environment node
 */
import prismaMock from '@/prisma/client'

import { getConversationAttachmentDownloadURL } from '@/lib/conversation.attachment'

import handler from './download'

/* eslint-disable @typescript-eslint/no-require-imports */
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

jest.mock('@/lib/response', () => ({
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
  redirect: (url) => ({ status: 302, location: url.toString() }),
}))

jest.mock('@/lib/conversation.attachment', () => ({
  getConversationAttachmentDownloadURL: jest.fn(),
}))

const prisma = prismaMock

describe('/api/v1/conversation/[conversationId]/attachment/[attachmentId]/download', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockConversation = {
    id: 'conv_abc',
    userId: 'user_123',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return a redirect to the download URL', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getConversationAttachmentDownloadURL.mockResolvedValue(
        'https://storage.example.com/file.pdf'
      )

      const req = {
        query: { conversationId: 'conv_abc', attachmentId: 'att_xyz' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(302)
      expect(result.location).toBe('https://storage.example.com/file.pdf')
    })

    it('should call getConversationAttachmentDownloadURL with correct arguments', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getConversationAttachmentDownloadURL.mockResolvedValue(
        'https://storage.example.com/file.pdf'
      )

      const req = {
        query: { conversationId: 'conv_abc', attachmentId: 'att_xyz' },
      }

      await handler(req, mockSession)

      expect(getConversationAttachmentDownloadURL).toHaveBeenCalledWith(
        'conv_abc',
        'att_xyz',
        false
      )
    })

    it('should look up conversation by conversationId URL param', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getConversationAttachmentDownloadURL.mockResolvedValue(
        'https://storage.example.com/file.pdf'
      )

      const req = {
        query: { conversationId: 'conv_abc', attachmentId: 'att_xyz' },
      }

      await handler(req, mockSession)

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'conv_abc' },
      })
    })
  })

  describe('authorization', () => {
    it('should return 404 when conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const req = {
        query: { conversationId: 'conv_missing', attachmentId: 'att_xyz' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(getConversationAttachmentDownloadURL).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the conversation', async () => {
      const otherUserConversation = { id: 'conv_abc', userId: 'user_other' }

      prisma.conversation.findUnique.mockResolvedValue(otherUserConversation)

      const req = {
        query: { conversationId: 'conv_abc', attachmentId: 'att_xyz' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(getConversationAttachmentDownloadURL).not.toHaveBeenCalled()
    })

    it('should allow access when user owns the conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getConversationAttachmentDownloadURL.mockResolvedValue(
        'https://storage.example.com/file.pdf'
      )

      const req = {
        query: { conversationId: 'conv_abc', attachmentId: 'att_xyz' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(302)
    })
  })

  describe('error handling', () => {
    it('should propagate errors from getConversationAttachmentDownloadURL', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getConversationAttachmentDownloadURL.mockRejectedValue(
        new Error('Storage unavailable')
      )

      const req = {
        query: { conversationId: 'conv_abc', attachmentId: 'att_xyz' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Storage unavailable'
      )
    })

    it('should propagate database errors from findUnique', async () => {
      prisma.conversation.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      )

      const req = {
        query: { conversationId: 'conv_abc', attachmentId: 'att_xyz' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })
})
