/**
 * @jest-environment node
 */
/* eslint-disable no-undef */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/prisma/sql', () => ({
  getBotUsageStats: jest.fn((...args) => ['getBotUsageStats', ...args]),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
  queryParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (obj) => obj,
}))

describe('/api/v1/bot/[botId]/usage/fetch', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockReq = {
    query: {
      botId: 'bot_abc123',
    },
    headers: {},
  }

  const mockUsageStats = {
    totalTokens: BigInt(45230),
    totalConversations: BigInt(892),
    totalMessages: BigInt(4521),
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('JSON format (default)', () => {
    it('should return usage stats in JSON format by default', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.$queryRawTyped.mockResolvedValue([mockUsageStats])

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        tokens: 45230,
        conversations: 892,
        messages: 4521,
      })
    })

    it('should return zeros when no stats exist', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.$queryRawTyped.mockResolvedValue([])

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        tokens: 0,
        conversations: 0,
        messages: 0,
      })
    })
  })

  describe('Prometheus format', () => {
    it('should return Prometheus format when Accept header includes application/openmetrics-text', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      const reqWithPrometheusAccept = {
        ...mockReq,
        headers: {
          accept: 'application/openmetrics-text; version=1.0.0',
        },
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.$queryRawTyped.mockResolvedValue([mockUsageStats])

      const result = await handler(reqWithPrometheusAccept, mockSession)

      expect(result).toBeInstanceOf(Response)
      expect(result.status).toBe(200)
      expect(result.headers.get('Content-Type')).toBe(
        'text/plain; version=0.0.4; charset=utf-8'
      )

      const body = await result.text()

      expect(body).toContain('# HELP cbk_bot_tokens_total')
      expect(body).toContain('# TYPE cbk_bot_tokens_total counter')
      expect(body).toContain('cbk_bot_tokens_total{bot_id="bot_abc123"} 45230')
      expect(body).toContain(
        'cbk_bot_conversations_total{bot_id="bot_abc123"} 892'
      )
      expect(body).toContain('cbk_bot_messages_total{bot_id="bot_abc123"} 4521')
    })

    it('should return Prometheus format when Accept header includes text/plain; version=0.0.4', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      const reqWithPlainTextAccept = {
        ...mockReq,
        headers: {
          accept: 'text/plain; version=0.0.4',
        },
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.$queryRawTyped.mockResolvedValue([mockUsageStats])

      const result = await handler(reqWithPlainTextAccept, mockSession)

      expect(result).toBeInstanceOf(Response)
      expect(result.status).toBe(200)

      const body = await result.text()

      expect(body).toContain('cbk_bot_tokens_total{bot_id="bot_abc123"}')
    })

    it('should return Prometheus format when User-Agent indicates Prometheus', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      const reqWithPrometheusUA = {
        ...mockReq,
        headers: {
          'user-agent': 'Prometheus/2.45.0',
        },
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.$queryRawTyped.mockResolvedValue([mockUsageStats])

      const result = await handler(reqWithPrometheusUA, mockSession)

      expect(result).toBeInstanceOf(Response)
      expect(result.status).toBe(200)

      const body = await result.text()

      expect(body).toContain('# TYPE cbk_bot_tokens_total counter')
    })

    it('should return zeros in Prometheus format when no stats exist', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      const reqWithPrometheusAccept = {
        ...mockReq,
        headers: {
          accept: 'application/openmetrics-text',
        },
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.$queryRawTyped.mockResolvedValue([])

      const result = await handler(reqWithPrometheusAccept, mockSession)

      expect(result).toBeInstanceOf(Response)

      const body = await result.text()

      expect(body).toContain('cbk_bot_tokens_total{bot_id="bot_abc123"} 0')
      expect(body).toContain(
        'cbk_bot_conversations_total{bot_id="bot_abc123"} 0'
      )
      expect(body).toContain('cbk_bot_messages_total{bot_id="bot_abc123"} 0')
    })

    it('should include proper Prometheus metric format with HELP and TYPE', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      const reqWithPrometheusAccept = {
        ...mockReq,
        headers: {
          accept: 'application/openmetrics-text',
        },
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.$queryRawTyped.mockResolvedValue([mockUsageStats])

      const result = await handler(reqWithPrometheusAccept, mockSession)
      const body = await result.text()

      // Check tokens metric
      expect(body).toContain(
        '# HELP cbk_bot_tokens_total Total tokens consumed by the bot'
      )
      expect(body).toContain('# TYPE cbk_bot_tokens_total counter')

      // Check conversations metric
      expect(body).toContain(
        '# HELP cbk_bot_conversations_total Total conversations initiated with the bot'
      )
      expect(body).toContain('# TYPE cbk_bot_conversations_total counter')

      // Check messages metric
      expect(body).toContain(
        '# HELP cbk_bot_messages_total Total messages exchanged with the bot'
      )
      expect(body).toContain('# TYPE cbk_bot_messages_total counter')
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
        userId: 'other_user_456',
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

  describe('content negotiation edge cases', () => {
    it('should return JSON when Accept header is application/json', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      const reqWithJsonAccept = {
        ...mockReq,
        headers: {
          accept: 'application/json',
        },
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.$queryRawTyped.mockResolvedValue([mockUsageStats])

      const result = await handler(reqWithJsonAccept, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toBeDefined()
      expect(result.body.tokens).toBe(45230)
    })

    it('should return JSON when Accept header is */*', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      const reqWithWildcardAccept = {
        ...mockReq,
        headers: {
          accept: '*/*',
        },
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.$queryRawTyped.mockResolvedValue([mockUsageStats])

      const result = await handler(reqWithWildcardAccept, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toBeDefined()
    })

    it('should return JSON when no Accept header is present', async () => {
      const mockBot = {
        id: 'bot_abc123',
        userId: 'user_123',
      }

      const reqWithoutAccept = {
        ...mockReq,
        headers: {},
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
      prisma.$queryRawTyped.mockResolvedValue([mockUsageStats])

      const result = await handler(reqWithoutAccept, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toBeDefined()
    })
  })
})
