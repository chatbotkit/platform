/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './update'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/prisma/types', () => ({
  BotVisibility: {
    private: 'private',
    public: 'public',
    unlisted: 'unlisted',
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const createChainableMock = () => {
    const mock = {
      required: () => mock,
      optional: () => mock,
      allow: () => mock,
      valid: () => mock,
      min: () => mock,
      max: () => mock,
      describe: () => ({ keys: {} }),
    }
    
return mock
  }

  const mockSchema = {
    object: (fields) => ({
      ...createChainableMock(),
      describe: () => ({ keys: fields || {} }),
    }),
    string: () => createChainableMock(),
    number: () => createChainableMock(),
    boolean: () => createChainableMock(),
    array: () => createChainableMock(),
  }

  return {
    __esModule: true,
    default: mockSchema,
    withSchema: (_schema, fn) => fn,
  }
})

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((newMeta, _oldMeta) => newMeta),
}))

const { getMeta } = require('@/lib/meta')

describe('/api/v1/bot/[botId]/update', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockReq = {
    query: { botId: 'bot_abc123' },
  }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should update bot and return its id', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
        meta: { existing: 'value' },
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.bot.update.mockResolvedValue({ id: 'bot_abc123' })
      getMeta.mockReturnValue({ name: 'Updated Bot' })

      const body = {
        name: 'Updated Bot',
        description: 'New description',
      }

      const result = await handler(mockReq, mockSession, body)

      expect(result).toEqual({ status: 200, body: { id: 'bot_abc123' } })
      expect(prisma.bot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bot_abc123' },
          data: expect.objectContaining({
            name: 'Updated Bot',
            description: 'New description',
          }),
        })
      )
    })

    it('should pass all optional fields to the update', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
        meta: null,
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.bot.update.mockResolvedValue({ id: 'bot_abc123' })

      const body = {
        alias: 'my-bot',
        name: 'Full Bot',
        description: 'A fully configured bot',
        backstory: 'You are a helpful assistant.',
        model: 'gpt-4o',
        privacy: true,
        moderation: false,
        visibility: 'public',
        meta: { custom: 'data' },
      }

      await handler(mockReq, mockSession, body)

      expect(prisma.bot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alias: 'my-bot',
            name: 'Full Bot',
            backstory: 'You are a helpful assistant.',
            model: 'gpt-4o',
            privacy: true,
            moderation: false,
            visibility: 'public',
          }),
        })
      )
    })
  })

  describe('blueprint, dataset, and skillset linking', () => {
    it('should link blueprint when passed as an object with id', async () => {
      const mockBot = { id: 'bot_abc123', userId: 'user_123', meta: null }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.bot.update.mockResolvedValue({ id: 'bot_abc123' })

      const body = { blueprintId: { id: 'bp_xyz789' } }

      await handler(mockReq, mockSession, body)

      expect(prisma.bot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'bp_xyz789',
          }),
        })
      )
    })

    it('should link blueprint when passed as a plain string id', async () => {
      const mockBot = { id: 'bot_abc123', userId: 'user_123', meta: null }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.bot.update.mockResolvedValue({ id: 'bot_abc123' })

      const body = { blueprintId: 'bp_string_id' }

      await handler(mockReq, mockSession, body)

      expect(prisma.bot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'bp_string_id',
          }),
        })
      )
    })

    it('should link dataset when passed as an object with id', async () => {
      const mockBot = { id: 'bot_abc123', userId: 'user_123', meta: null }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.bot.update.mockResolvedValue({ id: 'bot_abc123' })

      const body = { datasetId: { id: 'dts_xyz789' } }

      await handler(mockReq, mockSession, body)

      expect(prisma.bot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            datasetId: 'dts_xyz789',
          }),
        })
      )
    })

    it('should link skillset when passed as an object with id', async () => {
      const mockBot = { id: 'bot_abc123', userId: 'user_123', meta: null }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.bot.update.mockResolvedValue({ id: 'bot_abc123' })

      const body = { skillsetId: { id: 'sks_xyz789' } }

      await handler(mockReq, mockSession, body)

      expect(prisma.bot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            skillsetId: 'sks_xyz789',
          }),
        })
      )
    })

    it('should pass undefined when blueprint is not provided', async () => {
      const mockBot = { id: 'bot_abc123', userId: 'user_123', meta: null }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.bot.update.mockResolvedValue({ id: 'bot_abc123' })

      const body = { name: 'Bot Without Blueprint' }

      await handler(mockReq, mockSession, body)

      expect(prisma.bot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: undefined,
            datasetId: undefined,
            skillsetId: undefined,
          }),
        })
      )
    })
  })

  describe('meta merging', () => {
    it('should call getMeta to merge new meta with existing meta', async () => {
      const existingMeta = { version: 1, tags: ['old'] }
      const newMeta = { version: 2, tags: ['new'] }

      const mockBot = { id: 'bot_abc123', userId: 'user_123', meta: existingMeta }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.bot.update.mockResolvedValue({ id: 'bot_abc123' })
      getMeta.mockReturnValue({ version: 2, tags: ['new'] })

      await handler(mockReq, mockSession, { meta: newMeta })

      expect(getMeta).toHaveBeenCalledWith(newMeta, existingMeta)
    })
  })

  describe('error handling', () => {
    it('should return 404 when bot is not found', async () => {
      prisma.bot.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession, { name: 'New Name' })

      expect(result.status).toBe(404)
      expect(prisma.bot.update).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the bot', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'other_user_999',
        meta: null,
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)

      const result = await handler(mockReq, mockSession, { name: 'New Name' })

      expect(result.status).toBe(403)
      expect(prisma.bot.update).not.toHaveBeenCalled()
    })

    it('should handle database error from findUniqueByIdentifier', async () => {
      prisma.bot.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection lost')
      )

      await expect(
        handler(mockReq, mockSession, { name: 'New Name' })
      ).rejects.toThrow('Database connection lost')

      expect(prisma.bot.update).not.toHaveBeenCalled()
    })

    it('should handle database error from update', async () => {
      const mockBot = { id: 'bot_abc123', userId: 'user_123', meta: null }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.bot.update.mockRejectedValue(new Error('Update failed'))

      await expect(
        handler(mockReq, mockSession, { name: 'New Name' })
      ).rejects.toThrow('Update failed')
    })
  })

  describe('edge cases', () => {
    it('should look up the bot using the URL param', async () => {
      const reqWithCustomId = { query: { botId: 'my-custom-bot-slug' } }
      const mockBot = { id: 'bot_internal_id', userId: 'user_123', meta: null }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.bot.update.mockResolvedValue({ id: 'bot_internal_id' })

      await handler(reqWithCustomId, mockSession, {})

      expect(prisma.bot.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'my-custom-bot-slug'
      )
    })

    it('should use the resolved bot id (not the URL param) for the update', async () => {
      const mockBot = { id: 'bot_real_id', userId: 'user_123', meta: null }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.bot.update.mockResolvedValue({ id: 'bot_real_id' })

      await handler(mockReq, mockSession, { name: 'Renamed' })

      expect(prisma.bot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bot_real_id' },
        })
      )
    })

    it('should update bot with empty body without error', async () => {
      const mockBot = { id: 'bot_abc123', userId: 'user_123', meta: null }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.bot.update.mockResolvedValue({ id: 'bot_abc123' })

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'bot_abc123' })
    })
  })
})
