import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './export'

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/prisma/client', () => {
  const { mockDeep } = require('jest-mock-extended')

  return {
    __esModule: true,
    default: mockDeep(),
  }
})

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (cursor, req, stream, session) =>
    fn(cursor, req, stream, session),
}))

describe('/api/v1/usage/export', () => {
  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should retrieve usage records for user', async () => {
      const mockSession = {
        user: { id: 'user_123' },
      }

      const mockUsage = [
        {
          id: 'usage_1',
          type: 'MESSAGE_TOKEN',
          count: 100,
          conversationId: 'conv_1',
          messageId: 'msg_1',
          taskId: null,
          contactId: null,
          blueprintId: null,
          botId: 'bot_1',
          datasetId: null,
          skillsetId: null,
          abilityId: null,
          meta: { model: 'gpt-4' },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      prisma.usage.findMany.mockResolvedValue(mockUsage)

      const result = await handler(null, { query: {} }, null, mockSession)

      expect(prisma.usage.findMany).toHaveBeenCalled()

      const callArgs = prisma.usage.findMany.mock.calls[0][0]

      expect(callArgs.where.AND).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: 'user_123' }),
          expect.objectContaining({ createdAt: expect.any(Object) }),
        ])
      )

      expect(result).toHaveProperty('items')
      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({
        id: 'usage_1',
        type: 'MESSAGE_TOKEN',
        count: 100,
        botId: 'bot_1',
      })
    })

    it('should filter by 90-day lookback period', async () => {
      const mockSession = {
        user: { id: 'user_456' },
      }

      prisma.usage.findMany.mockResolvedValue([])

      await handler(null, { query: {} }, null, mockSession)

      const callArgs = prisma.usage.findMany.mock.calls[0][0]
      const timeConstraint = callArgs.where.AND.find(
        (constraint) => constraint.createdAt
      )

      expect(timeConstraint).toBeDefined()
      expect(timeConstraint.createdAt).toHaveProperty('gte')

      // @note verify it's a Date object (dates are passed as Date, not timestamps)
      expect(timeConstraint.createdAt.gte).toBeInstanceOf(Date)

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

      expect(timeConstraint.createdAt.gte.getTime()).toBeGreaterThan(
        ninetyDaysAgo.getTime() - 86400000
      )
    })

    it('should return empty array when no usage records', async () => {
      const mockSession = {
        user: { id: 'user_empty' },
      }

      prisma.usage.findMany.mockResolvedValue([])

      const result = await handler(null, { query: {} }, null, mockSession)

      expect(result.items).toEqual([])
    })
  })

  describe('meta field handling', () => {
    it('should handle meta field with yaml toString proxy', async () => {
      const mockSession = {
        user: { id: 'user_meta' },
      }

      const mockUsage = [
        {
          id: 'usage_meta',
          type: 'ACTION_TOKEN',
          count: 50,
          conversationId: null,
          messageId: null,
          taskId: null,
          contactId: null,
          blueprintId: null,
          botId: null,
          datasetId: null,
          skillsetId: null,
          abilityId: 'ability_1',
          meta: { action: 'search', provider: 'brave' },
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
        },
      ]

      prisma.usage.findMany.mockResolvedValue(mockUsage)

      const result = await handler(null, { query: {} }, null, mockSession)

      expect(result.items[0].meta).toBeDefined()
      expect(result.items[0].meta.action).toBe('search')
      expect(result.items[0].meta.toString()).toContain('action')
      expect(result.items[0].meta.toString()).toContain('search')
    })

    it('should handle null meta field', async () => {
      const mockSession = {
        user: { id: 'user_no_meta' },
      }

      const mockUsage = [
        {
          id: 'usage_no_meta',
          type: 'MESSAGE_TOKEN',
          count: 25,
          conversationId: 'conv_2',
          messageId: 'msg_2',
          taskId: null,
          contactId: null,
          blueprintId: null,
          botId: 'bot_2',
          datasetId: null,
          skillsetId: null,
          abilityId: null,
          meta: null,
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date('2024-01-20'),
        },
      ]

      prisma.usage.findMany.mockResolvedValue(mockUsage)

      const result = await handler(null, { query: {} }, null, mockSession)

      expect(result.items[0].meta).toBeDefined()
      // @note null meta becomes empty object with toString proxy
      expect(result.items[0].meta.toString()).toContain('{}')
    })

    it('should handle empty meta object', async () => {
      const mockSession = {
        user: { id: 'user_empty_meta' },
      }

      const mockUsage = [
        {
          id: 'usage_empty_meta',
          type: 'DATASET_TOKEN',
          count: 10,
          conversationId: null,
          messageId: null,
          taskId: null,
          contactId: null,
          blueprintId: null,
          botId: null,
          datasetId: 'dataset_1',
          skillsetId: null,
          abilityId: null,
          meta: {},
          createdAt: new Date('2024-01-25'),
          updatedAt: new Date('2024-01-25'),
        },
      ]

      prisma.usage.findMany.mockResolvedValue(mockUsage)

      const result = await handler(null, { query: {} }, null, mockSession)

      expect(result.items[0].meta).toBeDefined()
      expect(typeof result.items[0].meta.toString).toBe('function')
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const mockSession = {
        user: { id: 'user_error' },
      }

      const dbError = new Error('Database connection failed')

      prisma.usage.findMany.mockRejectedValue(dbError)

      await expect(
        handler(null, { query: {} }, null, mockSession)
      ).rejects.toThrow('Database connection failed')
    })
  })
})
