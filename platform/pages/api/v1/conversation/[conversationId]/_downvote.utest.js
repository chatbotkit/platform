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
  withSchema: (schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

const { ratingLimitOK } = require('@/lib/rating')

describe('bodySchema', () => {
  it('should accept valid downvote value in range', () => {
    const result = bodySchema.validate({ value: -50 })

    expect(result.error).toBeUndefined()
  })

  it('should default value to -100 when not provided', () => {
    const result = bodySchema.validate({})

    expect(result.error).toBeUndefined()

    expect(result.value.value).toBe(-100)
  })

  it('should reject value of 0', () => {
    const result = bodySchema.validate({ value: 0 })

    expect(result.error).toBeDefined()
  })

  it('should reject positive values', () => {
    const result = bodySchema.validate({ value: 1 })

    expect(result.error).toBeDefined()
  })

  it('should reject value below -100', () => {
    const result = bodySchema.validate({ value: -101 })

    expect(result.error).toBeDefined()
  })

  it('should accept maximum valid value of -1', () => {
    const result = bodySchema.validate({ value: -1 })

    expect(result.error).toBeUndefined()
  })

  it('should accept minimum valid value of -100', () => {
    const result = bodySchema.validate({ value: -100 })

    expect(result.error).toBeUndefined()
  })

  it('should accept optional reason string', () => {
    const result = bodySchema.validate({ value: -50, reason: 'Unhelpful' })

    expect(result.error).toBeUndefined()

    expect(result.value.reason).toBe('Unhelpful')
  })

  it('should accept null reason', () => {
    const result = bodySchema.validate({ value: -50, reason: null })

    expect(result.error).toBeUndefined()
  })

  it('should accept empty string reason', () => {
    const result = bodySchema.validate({ value: -50, reason: '' })

    expect(result.error).toBeUndefined()
  })
})

describe('/api/v1/conversation/[conversationId]/downvote', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockConversation = {
    id: 'conv_789',
    userId: 'user_123',
    botId: 'bot_456',
    contactId: 'contact_101',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.message.createMany.mockResolvedValue({ count: 2 })
    prisma.rating.create.mockResolvedValue({})
  })

  describe('basic functionality', () => {
    it('should downvote conversation and return its id', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)

      const req = { query: { conversationId: 'conv_789' } }
      const result = await handler(req, mockSession, { value: -100 })

      expect(result.status).toBe(200)

      expect(await result.json()).toEqual({ id: 'conv_789' })
    })

    it('should create activity messages when rate limit allows', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)

      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession, { value: -100 })

      expect(prisma.message.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ conversationId: 'conv_789' }),

            expect.objectContaining({ conversationId: 'conv_789' }),
          ]),
        })
      )

      expect(prisma.message.createMany.mock.calls[0][0].data).toHaveLength(2)
    })

    it('should create rating record with correct data', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)

      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession, { value: -75 })

      expect(prisma.rating.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_123',
          botId: 'bot_456',
          contactId: 'contact_101',
          conversationId: 'conv_789',
          value: -75,
          reason: undefined,
        },
      })
    })

    it('should include reason in rating when provided', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)

      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession, {
        value: -100,
        reason: 'Very unhelpful response',
      })

      expect(prisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: 'Very unhelpful response',
          }),
        })
      )
    })

    it('should pass ratingLimitOK check with correct identifiers', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)

      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession, { value: -100 })

      expect(ratingLimitOK).toHaveBeenCalledWith({
        userId: 'user_123',
        botId: 'bot_456',
        conversationId: 'conv_789',
      })
    })
  })

  describe('rate limiting', () => {
    it('should silently skip rating creation when rate limit is exceeded', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(false)

      const req = { query: { conversationId: 'conv_789' } }
      const result = await handler(req, mockSession, { value: -100 })

      // Still returns success - rate limiting is silent

      expect(result.status).toBe(200)

      expect(await result.json()).toEqual({ id: 'conv_789' })

      // But nothing is stored

      expect(prisma.message.createMany).not.toHaveBeenCalled()

      expect(prisma.rating.create).not.toHaveBeenCalled()
    })
  })

  describe('authorization', () => {
    it('should return 404 when conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const req = { query: { conversationId: 'nonexistent_conv' } }
      const result = await handler(req, mockSession, { value: -100 })

      expect(result.status).toBe(404)

      expect(ratingLimitOK).not.toHaveBeenCalled()

      expect(prisma.rating.create).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        userId: 'other_user_999',
      })

      const req = { query: { conversationId: 'conv_789' } }
      const result = await handler(req, mockSession, { value: -100 })

      expect(result.status).toBe(403)

      expect(ratingLimitOK).not.toHaveBeenCalled()

      expect(prisma.rating.create).not.toHaveBeenCalled()
    })

    it('should look up conversation by id from URL param', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)

      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession, { value: -100 })

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'conv_789' },
        select: {
          id: true,
          userId: true,
          botId: true,
          contactId: true,
        },
      })
    })
  })

  describe('error handling', () => {
    it('should propagate database errors from findUnique', async () => {
      prisma.conversation.findUnique.mockRejectedValue(
        new Error('DB connection failed')
      )

      const req = { query: { conversationId: 'conv_789' } }

      await expect(handler(req, mockSession, { value: -100 })).rejects.toThrow(
        'DB connection failed'
      )
    })

    it('should propagate errors from rating.create', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockResolvedValue(true)
      prisma.message.createMany.mockResolvedValue({ count: 2 })
      prisma.rating.create.mockRejectedValue(new Error('Rating insert failed'))

      const req = { query: { conversationId: 'conv_789' } }

      await expect(handler(req, mockSession, { value: -100 })).rejects.toThrow(
        'Rating insert failed'
      )
    })

    it('should propagate errors from ratingLimitOK', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ratingLimitOK.mockRejectedValue(new Error('Redis unavailable'))

      const req = { query: { conversationId: 'conv_789' } }

      await expect(handler(req, mockSession, { value: -100 })).rejects.toThrow(
        'Redis unavailable'
      )
    })
  })
})
