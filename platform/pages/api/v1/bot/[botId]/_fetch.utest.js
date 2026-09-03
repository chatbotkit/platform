/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
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
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (obj) => obj,
}))

describe('/api/v1/bot/[botId]/fetch', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockReq = {
    query: {
      botId: 'bot_abc123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should fetch bot with all fields', async () => {
      const mockBot = {
        id: 'bot_abc123',
        alias: 'test-bot',
        name: 'Test Bot',
        description: 'A test bot',
        userId: 'user_123',
        blueprintId: 'bpt_123',
        datasetId: 'dst_456',
        skillsetId: 'sks_789',
        backstory: 'You are a helpful assistant.',
        model: 'gpt-4o',
        visibility: 'private',
        meta: { category: 'test' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)

      const result = await handler(mockReq, mockSession)

      expect(prisma.bot.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'bot_abc123',
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            alias: true,
            name: true,
            description: true,
            userId: true,
            blueprintId: true,
            datasetId: true,
            skillsetId: true,
            backstory: true,
            model: true,
            visibility: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          }),
        })
      )

      expect(result.status).toBe(200)
      expect(result.body).toMatchObject({
        id: 'bot_abc123',
        alias: 'test-bot',
        name: 'Test Bot',
        description: 'A test bot',
      })
      expect(result.body.userId).toBeUndefined()
    })

    it('should fetch bot with minimal fields', async () => {
      const mockBot = {
        id: 'bot_min123',
        name: 'Minimal Bot',
        description: '',
        userId: 'user_123',
        blueprintId: null,
        datasetId: null,
        skillsetId: null,
        backstory: '',
        model: 'gpt-4o',
        visibility: 'private',
        meta: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toMatchObject({
        id: 'bot_min123',
        name: 'Minimal Bot',
      })
      expect(result.body.userId).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('should return 404 when bot is not found', async () => {
      prisma.bot.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user does not own the bot', async () => {
      const mockBot = {
        id: 'bot_abc123',
        name: 'Other User Bot',
        description: '',
        userId: 'other_user_456',
        blueprintId: null,
        datasetId: null,
        skillsetId: null,
        backstory: '',
        model: 'gpt-4o',
        visibility: 'private',
        meta: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(403)
    })

    it('should handle database errors', async () => {
      prisma.bot.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(handler(mockReq, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle bot with custom identifier', async () => {
      const mockReqWithCustomId = {
        query: {
          botId: 'custom-bot-slug',
        },
      }

      const mockBot = {
        id: 'bot_custom123',
        name: 'Custom ID Bot',
        description: '',
        userId: 'user_123',
        blueprintId: null,
        datasetId: null,
        skillsetId: null,
        backstory: '',
        model: 'gpt-4o',
        visibility: 'private',
        meta: { identifier: 'custom-bot-slug' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)

      const result = await handler(mockReqWithCustomId, mockSession)

      expect(result.status).toBe(200)
      expect(prisma.bot.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'custom-bot-slug',
        expect.any(Object)
      )
    })

    it('should remove userId from response', async () => {
      const mockBot = {
        id: 'bot_abc123',
        name: 'Test Bot',
        description: '',
        userId: 'user_123',
        blueprintId: null,
        datasetId: null,
        skillsetId: null,
        backstory: '',
        model: 'gpt-4o',
        visibility: 'private',
        meta: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)

      const result = await handler(mockReq, mockSession)

      expect(result.body).not.toHaveProperty('userId')
    })

    it('should handle bot with complex meta object', async () => {
      const complexMeta = {
        tags: ['support', 'sales'],
        config: {
          theme: 'dark',
          language: 'en',
        },
        customFields: {
          department: 'customer-service',
        },
      }

      const mockBot = {
        id: 'bot_complex123',
        name: 'Complex Bot',
        description: '',
        userId: 'user_123',
        blueprintId: null,
        datasetId: null,
        skillsetId: null,
        backstory: '',
        model: 'gpt-4o',
        visibility: 'private',
        meta: complexMeta,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.meta).toEqual(complexMeta)
    })
  })
})
