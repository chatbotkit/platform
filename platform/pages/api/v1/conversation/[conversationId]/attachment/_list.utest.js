/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { listConversationAttachments } from '@/lib/conversation.attachment'

import handler from './list'

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

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (req, session) => fn(req.query.cursor, req, {}, session),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
  queryParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: jest.fn((message) => {
    const error = new Error(message)

    error.status = 404

    throw error
  }),
  throwNotAuthorized: jest.fn(() => {
    const error = new Error('Not authorized')

    error.status = 403

    throw error
  }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((x) => x),
}))

jest.mock('@/lib/conversation.attachment', () => ({
  listConversationAttachments: jest.fn(),
}))

describe('GET /api/v1/conversation/{conversationId}/attachment/list', () => {
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

  it('lists attachments for the conversation owner', async () => {
    prisma.conversation.findUnique.mockResolvedValue(mockConversation)
    listConversationAttachments.mockResolvedValue({
      items: [
        {
          id: 'att_123',
          name: 'att_123.pdf',
          type: 'application/pdf',
          size: 123,
        },
      ],
      cursor: null,
    })

    const req = {
      query: { conversationId: 'conv_abc' },
    }

    const result = await handler(req, mockSession)

    expect(result.items).toHaveLength(1)
    expect(result.items[0].name).toBe('att_123.pdf')
    expect(result.cursor).toBeNull()
    expect(listConversationAttachments).toHaveBeenCalledWith('conv_abc', {
      continuationToken: undefined,
      maxKeys: undefined,
    })
  })

  it('passes cursor and take to the storage listing helper', async () => {
    prisma.conversation.findUnique.mockResolvedValue(mockConversation)
    listConversationAttachments.mockResolvedValue({
      items: [],
      cursor: 'next-token',
    })

    const req = {
      query: {
        conversationId: 'conv_abc',
        cursor: 'token-1',
        take: '25',
      },
    }

    await handler(req, mockSession)

    expect(listConversationAttachments).toHaveBeenCalledWith('conv_abc', {
      continuationToken: 'token-1',
      maxKeys: 25,
    })
  })

  it('throws not found when conversation does not exist', async () => {
    prisma.conversation.findUnique.mockResolvedValue(null)

    const req = {
      query: { conversationId: 'conv_missing' },
    }

    await expect(handler(req, mockSession)).rejects.toMatchObject({
      status: 404,
    })
    expect(listConversationAttachments).not.toHaveBeenCalled()
  })

  it('throws not authorized when user does not own the conversation', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_abc',
      userId: 'user_other',
    })

    const req = {
      query: { conversationId: 'conv_abc' },
    }

    await expect(handler(req, mockSession)).rejects.toMatchObject({
      status: 403,
    })
    expect(listConversationAttachments).not.toHaveBeenCalled()
  })
})
