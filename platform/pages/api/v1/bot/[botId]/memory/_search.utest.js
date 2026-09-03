/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { searchMemories } from '@/lib/memory.search'

import handler from './search'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const mockSchema = {
    object: jest.fn((fields) => ({
      ...fields,
      validate: jest.fn((value) => ({ error: undefined, value })),
    })),
    string: jest.fn(() => mockSchema),
  }

  return {
    __esModule: true,
    default: mockSchema,
    withSchema: (schema, fn) => fn,
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

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (obj) => obj,
}))

jest.mock('@/lib/memory.search', () => ({
  searchMemories: jest.fn(),
}))

describe('/api/v1/bot/[botId]/memory/search', () => {
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
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should search bot memories with results', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      const mockMemories = [
        {
          id: 'mem_1',
          text: 'Customer asked about refund policy',
          meta: { timestamp: '2024-01-01' },
        },
        {
          id: 'mem_2',
          text: 'Discussed refund processing time',
          meta: { timestamp: '2024-01-02' },
        },
      ]

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      searchMemories.mockResolvedValue(mockMemories)

      const body = {
        search: 'refund policy',
      }

      const result = await handler(mockReq, mockSession, body)

      expect(prisma.bot.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'bot_abc123',
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

      expect(searchMemories).toHaveBeenCalledWith(
        mockSession.user,
        'refund policy',
        {
          botId: 'bot_abc123',
          take: 50,
          limit: 10,
        }
      )

      expect(result.status).toBe(200)
      expect(result.body.items).toHaveLength(2)
      expect(result.body.items[0]).toMatchObject({
        id: 'mem_1',
        text: 'Customer asked about refund policy',
      })
    })

    it('should return empty array when no memories found', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      searchMemories.mockResolvedValue([])

      const body = {
        search: 'nonexistent topic',
      }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.items).toEqual([])
    })

    it('should handle single memory result', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      const mockMemories = [
        {
          id: 'mem_single',
          text: 'Single memory match',
          meta: {},
        },
      ]

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      searchMemories.mockResolvedValue(mockMemories)

      const body = {
        search: 'unique query',
      }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.items).toHaveLength(1)
    })
  })

  describe('error handling', () => {
    it('should return 404 when bot is not found', async () => {
      prisma.bot.findUniqueByIdentifier.mockResolvedValue(null)

      const body = {
        search: 'test search',
      }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(404)
      expect(searchMemories).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the bot', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'other_user_456',
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)

      const body = {
        search: 'test search',
      }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(403)
      expect(searchMemories).not.toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      prisma.bot.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection failed')
      )

      const body = {
        search: 'test search',
      }

      await expect(handler(mockReq, mockSession, body)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle search service errors', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      searchMemories.mockRejectedValue(new Error('Search service unavailable'))

      const body = {
        search: 'test search',
      }

      await expect(handler(mockReq, mockSession, body)).rejects.toThrow(
        'Search service unavailable'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty search string', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      searchMemories.mockResolvedValue([])

      const body = {
        search: '',
      }

      const result = await handler(mockReq, mockSession, body)

      expect(searchMemories).toHaveBeenCalledWith(mockSession.user, '', {
        botId: 'bot_abc123',
        take: 50,
        limit: 10,
      })
      expect(result.status).toBe(200)
    })

    it('should handle very long search strings', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      const longSearchString = 'a'.repeat(1000)

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      searchMemories.mockResolvedValue([])

      const body = {
        search: longSearchString,
      }

      const result = await handler(mockReq, mockSession, body)

      expect(searchMemories).toHaveBeenCalledWith(
        mockSession.user,
        longSearchString,
        expect.any(Object)
      )
      expect(result.status).toBe(200)
    })

    it('should handle special characters in search', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      const mockMemories = [
        {
          id: 'mem_special',
          text: 'Memory with special chars: @#$%',
          meta: {},
        },
      ]

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      searchMemories.mockResolvedValue(mockMemories)

      const body = {
        search: 'special @#$% chars',
      }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.items).toHaveLength(1)
    })

    it('should handle bot with custom identifier', async () => {
      const mockReqWithCustomId = {
        query: {
          botId: 'custom-bot-slug',
        },
      }

      const mockBot = {
        id: 'bot_custom123',
        userId: 'user_123',
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      searchMemories.mockResolvedValue([])

      const body = {
        search: 'test',
      }

      const result = await handler(mockReqWithCustomId, mockSession, body)

      expect(prisma.bot.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'custom-bot-slug',
        expect.any(Object)
      )
      expect(result.status).toBe(200)
    })

    it('should enforce search limit parameters', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      searchMemories.mockResolvedValue([])

      const body = {
        search: 'test',
      }

      await handler(mockReq, mockSession, body)

      expect(searchMemories).toHaveBeenCalledWith(mockSession.user, 'test', {
        botId: 'bot_abc123',
        take: 50,
        limit: 10,
      })
    })

    it('should handle memories with null meta', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      const mockMemories = [
        {
          id: 'mem_nullmeta',
          text: 'Memory without meta',
          meta: null,
        },
      ]

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      searchMemories.mockResolvedValue(mockMemories)

      const body = {
        search: 'test',
      }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.items[0].meta).toBeNull()
    })
  })
})
