/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    bot: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/bot.delete', () => ({
  deleteBot: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
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

const { deleteBot } = require('@/lib/bot.delete')

describe('/api/v1/bot/[botId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should delete bot and return its id', async () => {
      const mockBot = {
        id: 'bot_456',
        userId: 'user_123',
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      deleteBot.mockResolvedValue(undefined)

      const req = {
        query: { botId: 'bot_456' },
      }

      const result = await handler(req, mockSession)

      expect(prisma.bot.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'bot_456',
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )
      expect(deleteBot).toHaveBeenCalledWith(mockBot)
      expect(result).toEqual({ status: 200, body: { id: 'bot_456' } })
    })
  })

  describe('error handling', () => {
    it('should return 404 when bot not found', async () => {
      prisma.bot.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { botId: 'nonexistent_bot' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(deleteBot).not.toHaveBeenCalled()
    })

    it('should return 401 when user does not own bot', async () => {
      const mockBot = {
        id: 'bot_456',
        userId: 'other_user_999',
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)

      const req = {
        query: { botId: 'bot_456' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(deleteBot).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle database error gracefully', async () => {
      const dbError = new Error('Database connection failed')

      prisma.bot.findUniqueByIdentifier.mockRejectedValue(dbError)

      const req = {
        query: { botId: 'bot_456' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
      expect(deleteBot).not.toHaveBeenCalled()
    })

    it('should handle deleteBot failure', async () => {
      const mockBot = {
        id: 'bot_456',
        userId: 'user_123',
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      deleteBot.mockRejectedValue(new Error('Delete operation failed'))

      const req = {
        query: { botId: 'bot_456' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Delete operation failed'
      )
    })
  })
})
