/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './downvote'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: jest.fn(),
    },
    message: {
      createMany: jest.fn(),
    },
    rating: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/rating', () => ({
  ratingLimitOK: jest.fn(),
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

const { ratingLimitOK } = require('@/lib/rating')

describe('bodySchema (message-level downvote)', () => {
  it('should accept a value in the valid range', () => {
    const result = bodySchema.validate({ value: -50 })

    expect(result.error).toBeUndefined()
  })

  it('should default value to -100 when omitted', () => {
    const result = bodySchema.validate({})

    expect(result.error).toBeUndefined()
    expect(result.value.value).toBe(-100)
  })

  it('should reject value of 0', () => {
    expect(bodySchema.validate({ value: 0 }).error).toBeDefined()
  })

  it('should reject positive values', () => {
    expect(bodySchema.validate({ value: 1 }).error).toBeDefined()
  })

  it('should reject values below -100', () => {
    expect(bodySchema.validate({ value: -101 }).error).toBeDefined()
  })

  it('should accept the maximum valid value of -1', () => {
    expect(bodySchema.validate({ value: -1 }).error).toBeUndefined()
  })

  it('should accept the minimum valid value of -100', () => {
    expect(bodySchema.validate({ value: -100 }).error).toBeUndefined()
  })

  it('should accept an optional reason string', () => {
    const result = bodySchema.validate({
      value: -80,
      reason: 'Inaccurate answer',
    })

    expect(result.error).toBeUndefined()
    expect(result.value.reason).toBe('Inaccurate answer')
  })

  it('should accept null reason', () => {
    expect(
      bodySchema.validate({ value: -100, reason: null }).error
    ).toBeUndefined()
  })

  it('should accept an empty string reason', () => {
    expect(
      bodySchema.validate({ value: -100, reason: '' }).error
    ).toBeUndefined()
  })
})

describe('/api/v1/conversation/[conversationId]/message/[messageId]/downvote', () => {
  const mockSession = {
    user: { id: 'user_123' },
  }

  const mockReq = {
    query: { conversationId: 'conv_abc', messageId: 'msg_xyz' },
  }

  const mockConversation = {
    id: 'conv_abc',
    userId: 'user_123',
    botId: 'bot_456',
    contactId: 'contact_789',
    messages: [{ id: 'msg_xyz' }],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.message.createMany.mockResolvedValue({ count: 2 })
    prisma.rating.create.mockResolvedValue({})
  })

  describe('basic functionality', () => {
    it('should downvote the message and return its id', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)

      const result = await handler(mockReq, mockSession, { value: -100 })

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({ id: 'msg_xyz' })
    })

    it('should create two activity messages when rate limit allows', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)

      await handler(mockReq, mockSession, { value: -100 })

      expect(prisma.message.createMany).toHaveBeenCalledTimes(1)

      const callData = prisma.message.createMany.mock.calls[0][0].data

      expect(callData).toHaveLength(2)
      expect(callData[0].conversationId).toBe('conv_abc')
      expect(callData[1].conversationId).toBe('conv_abc')
    })

    it('should create rating with all required fields', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)

      await handler(mockReq, mockSession, { value: -75 })

      expect(prisma.rating.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user_123',
          botId: 'bot_456',
          contactId: 'contact_789',
          conversationId: 'conv_abc',
          messageId: 'msg_xyz',
          value: -75,
        }),
      })
    })

    it('should pass messageId to ratingLimitOK - consistent with message-level upvote', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)

      await handler(mockReq, mockSession, { value: -100 })

      expect(ratingLimitOK).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_123',
          botId: 'bot_456',
          conversationId: 'conv_abc',
          messageId: 'msg_xyz',
        })
      )
    })

    it('should include reason in the rating when provided', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)

      await handler(mockReq, mockSession, {
        value: -100,
        reason: 'Unhelpful response',
      })

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reason: 'Unhelpful response' }),
        })
      )
    })

    it('should store a negative rating value', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)

      await handler(mockReq, mockSession, { value: -50 })

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ value: -50 }),
        })
      )
    })
  })

  describe('rate limiting', () => {
    it('should silently skip rating creation when rate limit is exceeded', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(false)

      const result = await handler(mockReq, mockSession, { value: -100 })

      // API returns 200 even when rate-limited
      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({ id: 'msg_xyz' })

      expect(prisma.message.createMany).not.toHaveBeenCalled()
      expect(prisma.rating.create).not.toHaveBeenCalled()
    })
  })

  describe('authorization', () => {
    it('should return 404 when the conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession, { value: -100 })

      expect(result.status).toBe(404)
      expect(ratingLimitOK).not.toHaveBeenCalled()
      expect(prisma.rating.create).not.toHaveBeenCalled()
    })

    it('should return 403 when the session user does not own the conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        userId: 'other_user_999',
      })

      const result = await handler(mockReq, mockSession, { value: -100 })

      expect(result.status).toBe(403)
      expect(ratingLimitOK).not.toHaveBeenCalled()
      expect(prisma.rating.create).not.toHaveBeenCalled()
    })

    it('should return 404 when the message is not in the conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        messages: [],
      })

      const result = await handler(mockReq, mockSession, { value: -100 })

      expect(result.status).toBe(404)
      expect(ratingLimitOK).not.toHaveBeenCalled()
      expect(prisma.rating.create).not.toHaveBeenCalled()
    })

    it('should not allow cross-user downvote: user B cannot downvote user A message', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        userId: 'user_A',
      })

      const sessionB = { user: { id: 'user_B' } }
      const result = await handler(mockReq, sessionB, { value: -100 })

      expect(result.status).toBe(403)
      expect(prisma.rating.create).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should propagate database errors from conversation findUnique', async () => {
      prisma.conversation.findUnique.mockRejectedValue(new Error('DB error'))

      await expect(
        handler(mockReq, mockSession, { value: -100 })
      ).rejects.toThrow('DB error')
    })

    it('should propagate errors from ratingLimitOK', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockRejectedValue(new Error('Redis unavailable'))

      await expect(
        handler(mockReq, mockSession, { value: -100 })
      ).rejects.toThrow('Redis unavailable')
    })

    it('should propagate errors from rating.create', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)
      prisma.message.createMany.mockResolvedValue({ count: 2 })
      prisma.rating.create.mockRejectedValue(new Error('Rating insert failed'))

      await expect(
        handler(mockReq, mockSession, { value: -100 })
      ).rejects.toThrow('Rating insert failed')
    })
  })
})
