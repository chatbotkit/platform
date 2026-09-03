import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './list'

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

describe('/api/v1/integration/trigger/list', () => {
  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should retrieve trigger integrations for user', async () => {
      const mockSession = {
        user: { id: 'user_123' },
      }

      const mockTriggers = [
        {
          id: 'trigger_1',
          name: 'Test Trigger',
          description: 'A test trigger',
          blueprintId: 'blueprint_1',
          botId: 'bot_1',
          secret: 'secret_abc123',
          authenticate: true,
          schedule: '0 0 * * *',
          timezone: 'America/New_York',
          sessionDuration: 3600000,
          meta: { env: 'production' },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      prisma.triggerIntegration.findMany.mockResolvedValue(mockTriggers)

      const result = await handler(null, { query: {} }, null, mockSession)

      expect(prisma.triggerIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                userId: 'user_123',
              }),
            ]),
          }),
          select: {
            id: true,
            alias: true,
            name: true,
            description: true,
            blueprintId: true,
            botId: true,
            secret: true,
            authenticate: true,
            schedule: true,
            timezone: true,
            sessionDuration: true,
            lastTriggerAt: true,
            nextTriggerAt: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      )

      expect(result).toHaveProperty('items')
      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({
        id: 'trigger_1',
        name: 'Test Trigger',
        secret: 'secret_abc123',
        botId: 'bot_1',
        timezone: 'America/New_York',
      })
    })

    it('should return empty array when no triggers exist', async () => {
      const mockSession = {
        user: { id: 'user_empty' },
      }

      prisma.triggerIntegration.findMany.mockResolvedValue([])

      const result = await handler(null, { query: {} }, null, mockSession)

      expect(result.items).toEqual([])
    })

    it('should include all trigger configuration fields', async () => {
      const mockSession = {
        user: { id: 'user_config' },
      }

      const mockTriggers = [
        {
          id: 'trigger_config',
          name: 'Config Trigger',
          description: 'Trigger with all config',
          blueprintId: 'blueprint_config',
          botId: 'bot_config',
          secret: 'secret_config_xyz',
          authenticate: false,
          schedule: '*/15 * * * *',
          timezone: 'UTC',
          sessionDuration: 7200000,
          lastTriggerAt: new Date('2024-01-15T10:00:00Z'),
          nextTriggerAt: new Date('2024-01-15T10:15:00Z'),
          meta: { priority: 'high' },
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-16'),
        },
      ]

      prisma.triggerIntegration.findMany.mockResolvedValue(mockTriggers)

      const result = await handler(null, { query: {} }, null, mockSession)

      expect(result.items[0]).toMatchObject({
        id: 'trigger_config',
        name: 'Config Trigger',
        description: 'Trigger with all config',
        blueprintId: 'blueprint_config',
        botId: 'bot_config',
        secret: 'secret_config_xyz',
        authenticate: false,
        schedule: '*/15 * * * *',
        timezone: 'UTC',
        sessionDuration: 7200000,
        meta: { priority: 'high' },
      })
      expect(result.items[0].createdAt).toBeDefined()
      expect(result.items[0].updatedAt).toBeDefined()
      expect(result.items[0].lastTriggerAt).toBeDefined()
      expect(result.items[0].nextTriggerAt).toBeDefined()
    })
  })

  describe('multiple records', () => {
    it('should handle multiple trigger integrations', async () => {
      const mockSession = {
        user: { id: 'user_multiple' },
      }

      const mockTriggers = [
        {
          id: 'trigger_1',
          name: 'First Trigger',
          description: 'First',
          blueprintId: 'blueprint_1',
          botId: 'bot_1',
          secret: 'secret_1',
          authenticate: true,
          schedule: '0 0 * * *',
          timezone: 'America/New_York',
          sessionDuration: 3600000,
          meta: { env: 'prod' },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'trigger_2',
          name: 'Second Trigger',
          description: 'Second',
          blueprintId: null,
          botId: 'bot_2',
          secret: 'secret_2',
          authenticate: false,
          schedule: null,
          timezone: null,
          sessionDuration: null,
          meta: null,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'trigger_3',
          name: 'Third Trigger',
          description: 'Third',
          blueprintId: 'blueprint_3',
          botId: 'bot_3',
          secret: 'secret_3',
          authenticate: true,
          schedule: '*/5 * * * *',
          timezone: 'UTC',
          sessionDuration: 1800000,
          meta: { priority: 'low' },
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        },
      ]

      prisma.triggerIntegration.findMany.mockResolvedValue(mockTriggers)

      const result = await handler(null, { query: {} }, null, mockSession)

      expect(result.items).toHaveLength(3)
      expect(result.items[0].id).toBe('trigger_1')
      expect(result.items[1].id).toBe('trigger_2')
      expect(result.items[2].id).toBe('trigger_3')
    })

    it('should handle triggers with null optional fields', async () => {
      const mockSession = {
        user: { id: 'user_nulls' },
      }

      const mockTriggers = [
        {
          id: 'trigger_null',
          name: 'Null Fields Trigger',
          description: '',
          blueprintId: null,
          botId: 'bot_null',
          secret: 'secret_null',
          authenticate: false,
          schedule: null,
          timezone: null,
          sessionDuration: null,
          meta: null,
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-10'),
        },
      ]

      prisma.triggerIntegration.findMany.mockResolvedValue(mockTriggers)

      const result = await handler(null, { query: {} }, null, mockSession)

      expect(result.items[0]).toMatchObject({
        blueprintId: null,
        schedule: null,
        timezone: null,
        sessionDuration: null,
        meta: null,
      })
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const mockSession = {
        user: { id: 'user_error' },
      }

      const dbError = new Error('Database connection failed')

      prisma.triggerIntegration.findMany.mockRejectedValue(dbError)

      await expect(
        handler(null, { query: {} }, null, mockSession)
      ).rejects.toThrow('Database connection failed')
    })
  })

  describe('secret handling', () => {
    it('should include secret in response', async () => {
      const mockSession = {
        user: { id: 'user_secret' },
      }

      const mockTriggers = [
        {
          id: 'trigger_secret',
          name: 'Secret Trigger',
          description: 'Has secret',
          blueprintId: null,
          botId: 'bot_secret',
          secret: 'very_secret_token_xyz',
          authenticate: true,
          schedule: null,
          sessionDuration: null,
          meta: null,
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date('2024-01-20'),
        },
      ]

      prisma.triggerIntegration.findMany.mockResolvedValue(mockTriggers)

      const result = await handler(null, { query: {} }, null, mockSession)

      expect(result.items[0].secret).toBe('very_secret_token_xyz')
    })
  })
})
