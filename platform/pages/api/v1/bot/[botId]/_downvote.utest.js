/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { ratingLimitOK } from '@/lib/rating'

import handler, { bodySchema } from './downvote'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    bot: {
      findUniqueByIdentifier: jest.fn(),
    },
    rating: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/rating', () => ({
  ratingLimitOK: jest.fn(),
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (schema, fn) => fn,
}))

describe('/api/v1/bot/[botId]/downvote', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  const mockBot = {
    id: 'bot-456',
    userId: 'user-123',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('bodySchema', () => {
    it('should accept default value', () => {
      const { error, value } = bodySchema.validate({})

      expect(error).toBeUndefined()
      expect(value.value).toBe(-100)
    })

    it('should accept value in valid range', () => {
      const { error, value } = bodySchema.validate({ value: -50 })

      expect(error).toBeUndefined()
      expect(value.value).toBe(-50)
    })

    it('should accept minimum value', () => {
      const { error, value } = bodySchema.validate({ value: -100 })

      expect(error).toBeUndefined()
      expect(value.value).toBe(-100)
    })

    it('should accept maximum value', () => {
      const { error, value } = bodySchema.validate({ value: -1 })

      expect(error).toBeUndefined()
      expect(value.value).toBe(-1)
    })

    it('should reject value below minimum', () => {
      const { error } = bodySchema.validate({ value: -101 })

      expect(error).toBeDefined()
    })

    it('should reject value above maximum', () => {
      const { error } = bodySchema.validate({ value: 0 })

      expect(error).toBeDefined()
    })

    it('should reject positive values', () => {
      const { error } = bodySchema.validate({ value: 10 })

      expect(error).toBeDefined()
    })

    it('should accept optional reason', () => {
      const { error, value } = bodySchema.validate({ reason: 'Bad response' })

      expect(error).toBeUndefined()
      expect(value.reason).toBe('Bad response')
    })

    it('should accept null reason', () => {
      const { error, value } = bodySchema.validate({ reason: null })

      expect(error).toBeUndefined()
      expect(value.reason).toBeNull()
    })

    it('should accept empty string reason', () => {
      const { error, value } = bodySchema.validate({ reason: '' })

      expect(error).toBeUndefined()
      expect(value.reason).toBe('')
    })
  })

  describe('successful downvote', () => {
    it('should create rating with default value', async () => {
      const req = { query: { botId: 'bot-456' } }
      const body = { value: -100 }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      ratingLimitOK.mockResolvedValue(true)
      prisma.rating.create.mockResolvedValue({ id: 'rating-1' })

      const result = await handler(req, mockSession, body)

      expect(prisma.rating.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          botId: 'bot-456',
          value: -100,
          reason: undefined,
        },
      })
      expect(result.status).toBe(200)

      const responseBody = await result.json()

      expect(responseBody).toEqual({ id: 'bot-456' })
    })

    it('should create rating with custom value and reason', async () => {
      const req = { query: { botId: 'bot-456' } }
      const body = { value: -75, reason: 'Inaccurate information' }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      ratingLimitOK.mockResolvedValue(true)
      prisma.rating.create.mockResolvedValue({ id: 'rating-2' })

      const result = await handler(req, mockSession, body)

      expect(prisma.rating.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          botId: 'bot-456',
          value: -75,
          reason: 'Inaccurate information',
        },
      })
      expect(result.status).toBe(200)

      const responseBody = await result.json()

      expect(responseBody).toEqual({ id: 'bot-456' })
    })

    it('should not create rating when rate limit exceeded', async () => {
      const req = { query: { botId: 'bot-456' } }
      const body = { value: -50 }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      ratingLimitOK.mockResolvedValue(false)

      const result = await handler(req, mockSession, body)

      expect(prisma.rating.create).not.toHaveBeenCalled()
      expect(result.status).toBe(200)

      const responseBody = await result.json()

      expect(responseBody).toEqual({ id: 'bot-456' })
    })
  })

  describe('error cases', () => {
    it('should return 404 when bot not found', async () => {
      const req = { query: { botId: 'nonexistent' } }
      const body = {}

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(prisma.rating.create).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own bot', async () => {
      const req = { query: { botId: 'bot-other' } }
      const body = {}

      const otherUserBot = { id: 'bot-other', userId: 'other-user' }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(otherUserBot)

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(403)
      expect(prisma.rating.create).not.toHaveBeenCalled()
    })
  })

  describe('ratingLimitOK integration', () => {
    it('should call ratingLimitOK with correct parameters', async () => {
      const req = { query: { botId: 'bot-456' } }
      const body = {}

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      ratingLimitOK.mockResolvedValue(true)
      prisma.rating.create.mockResolvedValue({ id: 'rating-3' })

      await handler(req, mockSession, body)

      expect(ratingLimitOK).toHaveBeenCalledWith({
        userId: 'user-123',
        botId: 'bot-456',
      })
    })
  })
})
