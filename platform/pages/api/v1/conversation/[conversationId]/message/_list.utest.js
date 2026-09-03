/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './list'

import { createMocks } from 'node-mocks-http'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: jest.fn(),
    },
    message: {
      findMyriad: jest.fn(),
    },
  },
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (handler) => handler,
}))

jest.mock('@/lib/method', () => ({
  withGet: (handler) => handler,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (handler) => (req) =>
    handler(null, req, null, { user: { id: 'user123' } }),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: (message) => {
    throw new Error(message || 'Not Found')
  },
  throwNotAuthorized: () => {
    throw new Error('Not Authorized')
  },
}))

jest.mock('@/lib/filter', () => ({
  getCursorConstraints: () => ({}),
  getMetaQueryFilter: () => [],
  getTakeConstraints: () => ({ take: 100 }),
}))

jest.mock('@/lib/message', () => ({
  getSortedMessages: jest.fn((messages) => messages),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('GET /api/v1/conversation/[conversationId]/message/list', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle conversation not found', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { conversationId: 'nonexistent' },
    })

    prisma.conversation.findUnique.mockResolvedValue(null)

    await expect(handler(req, res)).rejects.toThrow('Conversation not found')
  })

  it('should handle unauthorized access', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { conversationId: 'conv123' },
    })

    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv123',
      userId: 'different-user',
    })

    await expect(handler(req, res)).rejects.toThrow('Not Authorized')
  })

  it('should successfully list messages for authorized user', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { conversationId: 'conv123' },
    })

    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv123',
      userId: 'user123',
    })

    const mockMessages = [
      { id: 'msg1', text: 'Hello', type: 'user', meta: {} },
      { id: 'msg2', text: 'Hi', type: 'bot', meta: {} },
    ]

    prisma.message.findMyriad.mockResolvedValue(mockMessages)

    const result = await handler(req, res)

    expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
      where: { id: 'conv123' },
      select: {
        id: true,
        userId: true,
      },
    })
    expect(prisma.message.findMyriad).toHaveBeenCalled()
    expect(result).toBeDefined()
  })
})
