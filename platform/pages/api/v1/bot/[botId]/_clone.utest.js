/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './clone'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    bot: {
      findUniqueByIdentifier: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
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

describe('/api/v1/bot/[botId]/clone', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  const mockBot = {
    id: 'bot-original',
    userId: 'user-123',
    name: 'Test Bot',
    description: 'Test Description',
    backstory: 'Test Backstory',
    model: 'gpt-4',
    datasetId: 'dataset-123',
    skillsetId: 'skillset-123',
    privacy: 'private',
    moderation: false,
    meta: { custom: 'data' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('bodySchema', () => {
    it('should accept empty object', () => {
      const { error } = bodySchema.validate({})

      expect(error).toBeUndefined()
    })
  })

  describe('successful clone', () => {
    it('should clone bot with all properties', async () => {
      const req = { query: { botId: 'bot-original' } }
      const body = {}

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.bot.create.mockResolvedValue({ id: 'bot-cloned' })

      const result = await handler(req, mockSession, body)

      expect(prisma.bot.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'bot-original'
      )
      expect(prisma.bot.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          name: 'Test Bot',
          description: 'Test Description',
          backstory: 'Test Backstory',
          model: 'gpt-4',
          datasetId: 'dataset-123',
          skillsetId: 'skillset-123',
          privacy: 'private',
          moderation: false,
          meta: { custom: 'data' },
        },
      })
      expect(result.status).toBe(200)

      const responseData = await result.json()

      expect(responseData).toEqual({ id: 'bot-cloned' })
    })

    it('should clone bot without optional fields', async () => {
      const req = { query: { botId: 'bot-original' } }
      const body = {}

      const minimalBot = {
        id: 'bot-minimal',
        userId: 'user-123',
        name: 'Minimal Bot',
        description: '',
        backstory: '',
        model: 'gpt-3.5-turbo',
        datasetId: null,
        skillsetId: null,
        privacy: 'private',
        moderation: false,
        meta: {},
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(minimalBot)
      prisma.bot.create.mockResolvedValue({ id: 'bot-cloned-minimal' })

      const result = await handler(req, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          name: 'Minimal Bot',
          description: '',
          backstory: '',
          model: 'gpt-3.5-turbo',
          datasetId: null,
          skillsetId: null,
          privacy: 'private',
          moderation: false,
          meta: {},
        },
      })
      expect(result.status).toBe(200)

      const responseData = await result.json()

      expect(responseData).toEqual({ id: 'bot-cloned-minimal' })
    })
  })

  describe('error cases', () => {
    it('should return 404 when bot not found', async () => {
      const req = { query: { botId: 'nonexistent' } }
      const body = {}

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(prisma.bot.create).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own bot', async () => {
      const req = { query: { botId: 'bot-other' } }
      const body = {}

      const otherUserBot = { ...mockBot, userId: 'other-user' }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(otherUserBot)

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(403)
      expect(prisma.bot.create).not.toHaveBeenCalled()
    })
  })

  describe('blueprintId handling', () => {
    it('should not copy blueprintId to cloned bot', async () => {
      const req = { query: { botId: 'bot-original' } }
      const body = {}

      const botWithBlueprint = {
        ...mockBot,
        blueprintId: 'blueprint-123',
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(botWithBlueprint)
      prisma.bot.create.mockResolvedValue({ id: 'bot-cloned' })

      await handler(req, mockSession, body)

      const createCall = prisma.bot.create.mock.calls[0][0]

      expect(createCall.data).not.toHaveProperty('blueprintId')
    })
  })
})
