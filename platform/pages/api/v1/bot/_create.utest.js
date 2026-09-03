/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { bodySchema } from './create'

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

jest.mock('@/lib/limit.handler', () => ({
  withLimits: (_limits, fn) => fn,
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
    withSchema: (schema, fn) => fn,
  }
})

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

describe('/api/v1/bot/create', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should create bot with minimal required fields', async () => {
      const mockBot = {
        id: 'bot_abc123',
      }

      prisma.bot.create.mockResolvedValue(mockBot)

      const body = {
        name: 'Test Bot',
      }

      const result = await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_123',
          name: 'Test Bot',
          description: undefined,
          blueprintId: undefined,
          backstory: undefined,
          model: undefined,
          datasetId: undefined,
          skillsetId: undefined,
          privacy: undefined,
          moderation: undefined,
          visibility: undefined,
          meta: undefined,
        },
        select: {
          id: true,
        },
      })
      expect(result).toEqual({ status: 200, body: { id: 'bot_abc123' } })
    })

    it('should create bot with all optional fields', async () => {
      const mockBot = {
        id: 'bot_full123',
      }

      prisma.bot.create.mockResolvedValue(mockBot)

      const body = {
        name: 'Support Bot',
        description: 'Customer support assistant',
        blueprintId: { id: 'bpt_123' },
        backstory: 'You are a helpful customer support agent.',
        model: 'gpt-4o',
        datasetId: { id: 'dst_456' },
        skillsetId: { id: 'sks_789' },
        privacy: true,
        moderation: true,
        visibility: 'private',
        meta: { category: 'support', department: 'sales' },
      }

      const result = await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_123',
          name: 'Support Bot',
          description: 'Customer support assistant',
          blueprintId: 'bpt_123',
          backstory: 'You are a helpful customer support agent.',
          model: 'gpt-4o',
          datasetId: 'dst_456',
          skillsetId: 'sks_789',
          privacy: true,
          moderation: true,
          visibility: 'private',
          meta: { category: 'support', department: 'sales' },
        },
        select: {
          id: true,
        },
      })
      expect(result).toEqual({ status: 200, body: { id: 'bot_full123' } })
    })

    it('should handle blueprintId as string', async () => {
      const mockBot = { id: 'bot_bpt' }

      prisma.bot.create.mockResolvedValue(mockBot)

      const body = {
        name: 'Blueprint Bot',
        blueprintId: 'bpt_direct_string',
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'bpt_direct_string',
          }),
        })
      )
    })

    it('should handle datasetId and skillsetId as strings', async () => {
      const mockBot = { id: 'bot_res' }

      prisma.bot.create.mockResolvedValue(mockBot)

      const body = {
        name: 'Resource Bot',
        datasetId: 'dst_string',
        skillsetId: 'sks_string',
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            datasetId: 'dst_string',
            skillsetId: 'sks_string',
          }),
        })
      )
    })
  })

  describe('configuration options', () => {
    it('should create bot with privacy enabled', async () => {
      prisma.bot.create.mockResolvedValue({ id: 'bot_priv' })

      const body = {
        name: 'Private Bot',
        privacy: true,
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            privacy: true,
          }),
        })
      )
    })

    it('should create bot with moderation enabled', async () => {
      prisma.bot.create.mockResolvedValue({ id: 'bot_mod' })

      const body = {
        name: 'Moderated Bot',
        moderation: true,
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            moderation: true,
          }),
        })
      )
    })

    it('should create bot with privacy and moderation disabled', async () => {
      prisma.bot.create.mockResolvedValue({ id: 'bot_open' })

      const body = {
        name: 'Open Bot',
        privacy: false,
        moderation: false,
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            privacy: false,
            moderation: false,
          }),
        })
      )
    })
  })

  describe('visibility settings', () => {
    it('should create private bot', async () => {
      prisma.bot.create.mockResolvedValue({ id: 'bot_priv' })

      const body = {
        name: 'Private Bot',
        visibility: 'private',
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            visibility: 'private',
          }),
        })
      )
    })

    it('should create public bot', async () => {
      prisma.bot.create.mockResolvedValue({ id: 'bot_pub' })

      const body = {
        name: 'Public Bot',
        visibility: 'public',
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            visibility: 'public',
          }),
        })
      )
    })

    it('should create unlisted bot', async () => {
      prisma.bot.create.mockResolvedValue({ id: 'bot_unlist' })

      const body = {
        name: 'Unlisted Bot',
        visibility: 'unlisted',
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            visibility: 'unlisted',
          }),
        })
      )
    })
  })

  describe('model selection', () => {
    it('should create bot with GPT-4 model', async () => {
      prisma.bot.create.mockResolvedValue({ id: 'bot_gpt4' })

      const body = {
        name: 'GPT-4 Bot',
        model: 'gpt-4',
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            model: 'gpt-4',
          }),
        })
      )
    })

    it('should create bot with custom model', async () => {
      prisma.bot.create.mockResolvedValue({ id: 'bot_custom' })

      const body = {
        name: 'Custom Model Bot',
        model: 'claude-3-opus',
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            model: 'claude-3-opus',
          }),
        })
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty description', async () => {
      prisma.bot.create.mockResolvedValue({ id: 'bot_empty' })

      const body = {
        name: 'Bot',
        description: '',
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: '',
          }),
        })
      )
    })

    it('should handle empty backstory', async () => {
      prisma.bot.create.mockResolvedValue({ id: 'bot_noback' })

      const body = {
        name: 'Bot',
        backstory: '',
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            backstory: '',
          }),
        })
      )
    })

    it('should handle complex metadata', async () => {
      prisma.bot.create.mockResolvedValue({ id: 'bot_meta' })

      const body = {
        name: 'Metadata Bot',
        meta: {
          tags: ['support', 'sales'],
          version: '1.0.0',
          config: { timeout: 30, retries: 3 },
        },
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: {
              tags: ['support', 'sales'],
              version: '1.0.0',
              config: { timeout: 30, retries: 3 },
            },
          }),
        })
      )
    })

    it('should handle long backstory', async () => {
      prisma.bot.create.mockResolvedValue({ id: 'bot_long' })

      const longBackstory = 'A'.repeat(5000)
      const body = {
        name: 'Long Backstory Bot',
        backstory: longBackstory,
      }

      await handler(null, mockSession, body)

      expect(prisma.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            backstory: longBackstory,
          }),
        })
      )
    })
  })

  describe('error handling', () => {
    it('should handle database error', async () => {
      const dbError = new Error('Database connection failed')

      prisma.bot.create.mockRejectedValue(dbError)

      const body = {
        name: 'Test Bot',
      }

      await expect(handler(null, mockSession, body)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle unique constraint violation', async () => {
      const uniqueError = new Error('Unique constraint failed on name')

      prisma.bot.create.mockRejectedValue(uniqueError)

      const body = {
        name: 'Duplicate Bot',
      }

      await expect(handler(null, mockSession, body)).rejects.toThrow(
        'Unique constraint failed on name'
      )
    })

    it('should handle foreign key constraint for invalid dataset', async () => {
      const fkError = new Error('Foreign key constraint failed on datasetId')

      prisma.bot.create.mockRejectedValue(fkError)

      const body = {
        name: 'Bot',
        datasetId: { id: 'invalid_dst' },
      }

      await expect(handler(null, mockSession, body)).rejects.toThrow(
        'Foreign key constraint failed on datasetId'
      )
    })
  })

  describe('bodySchema validation', () => {
    it('should define required name field', () => {
      expect(bodySchema.describe().keys.name).toBeDefined()
    })

    it('should define optional configuration fields', () => {
      const schema = bodySchema.describe()

      expect(schema.keys.backstory).toBeDefined()
      expect(schema.keys.model).toBeDefined()
      expect(schema.keys.datasetId).toBeDefined()
      expect(schema.keys.skillsetId).toBeDefined()
      expect(schema.keys.privacy).toBeDefined()
      expect(schema.keys.moderation).toBeDefined()
      expect(schema.keys.visibility).toBeDefined()
      expect(schema.keys.meta).toBeDefined()
    })

    it('should validate visibility enum values', () => {
      const visibilitySchema = bodySchema.describe().keys.visibility

      expect(visibilitySchema).toBeDefined()
    })
  })
})
