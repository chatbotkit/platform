import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { bodySchema } from './create'

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
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

jest.mock('@/lib/task.schedule', () => ({
  getNext: jest.fn((schedule) => {
    if (schedule === '2020-01-01T00:00:00Z') {
      return new Date('2020-01-01T00:00:00Z')
    }

    if (schedule === 'hourly') {
      return new Date('2030-02-01T12:00:00Z')
    }

    if (schedule === 'daily') {
      return new Date('2030-02-02T00:00:00Z')
    }

    if (schedule === 'weekly') {
      return new Date('2030-02-08T00:00:00Z')
    }

    // cron: return a fixed date for testing
    return new Date('2030-02-01T10:00:00Z')
  }),
}))

/* eslint-disable @typescript-eslint/no-require-imports */
const { getNext } = require('@/lib/task.schedule')

describe('/api/v1/integration/trigger/create', () => {
  const mockSession = {
    user: { id: 'user_789' },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('bodySchema validation', () => {
    it('should accept valid trigger integration body', async () => {
      const validBody = {
        name: 'Test Trigger',
        description: 'A test trigger',
        botId: 'bot_123',
        authenticate: true,
        schedule: 'daily',
        sessionDuration: 3600000,
        meta: { env: 'test' },
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue({
        userId: 'user_789',
        visibility: 'private',
      })

      await expect(
        bodySchema.validateAsync(validBody, {
          context: { session: mockSession },
        })
      ).resolves.toBeDefined()
    })

    it('should accept minimal valid body with only required fields', async () => {
      const minimalBody = {
        name: 'Minimal Trigger',
        description: '',
        botId: 'bot_456',
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue({
        userId: 'user_789',
        visibility: 'private',
      })

      await expect(
        bodySchema.validateAsync(minimalBody, {
          context: { session: mockSession },
        })
      ).resolves.toBeDefined()
    })

    it('should accept null values for optional numeric fields', async () => {
      const body = {
        name: 'Trigger with nulls',
        botId: 'bot_789',
        sessionDuration: null,
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue({
        userId: 'user_789',
        visibility: 'private',
      })

      await expect(
        bodySchema.validateAsync(body, {
          context: { session: mockSession },
        })
      ).resolves.toBeDefined()
    })

    it('should reject negative sessionDuration', async () => {
      const body = {
        name: 'Negative Session',
        botId: 'bot_123',
        sessionDuration: -1000,
      }

      prisma.bot.findUniqueByIdentifier.mockResolvedValue({
        userId: 'user_789',
        visibility: 'private',
      })

      await expect(
        bodySchema.validateAsync(body, {
          context: { session: mockSession },
        })
      ).rejects.toBeDefined()
    })

    it('should accept a timezone', async () => {
      await expect(
        bodySchema.validateAsync(
          { timezone: 'America/New_York' },
          {
            context: { session: mockSession },
          }
        )
      ).resolves.toBeDefined()
    })
  })

  describe('handler', () => {
    it('should create trigger integration with all fields', async () => {
      const body = {
        name: 'Test Trigger',
        description: 'Test description',
        blueprintId: { id: 'blueprint_123' },
        botId: { id: 'bot_456' },
        authenticate: true,
        schedule: '0 0 * * *',
        timezone: 'America/New_York',
        sessionDuration: 7200000,
        meta: { environment: 'production' },
      }

      prisma.triggerIntegration.create.mockResolvedValue({
        id: 'trigger_abc123',
      })

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('trigger_abc123')
      expect(getNext).toHaveBeenCalledWith('0 0 * * *', {
        timezone: 'America/New_York',
      })
      expect(prisma.triggerIntegration.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_789',
          name: 'Test Trigger',
          description: 'Test description',
          blueprintId: 'blueprint_123',
          botId: 'bot_456',
          secret: expect.any(String),
          authenticate: true,
          schedule: '0 0 * * *',
          timezone: 'America/New_York',
          nextTriggerAt: expect.any(Date),
          sessionDuration: 7200000,
          meta: { environment: 'production' },
        },
        select: {
          id: true,
        },
      })
    })

    it('should generate a random secret on creation', async () => {
      const body = {
        name: 'Secret Trigger',
        botId: { id: 'bot_123' },
      }

      prisma.triggerIntegration.create.mockResolvedValue({
        id: 'trigger_secret',
      })

      await handler({}, mockSession, body)

      const createCall = prisma.triggerIntegration.create.mock.calls[0][0]

      expect(createCall.data.secret).toBeDefined()
      expect(typeof createCall.data.secret).toBe('string')
      expect(createCall.data.secret.length).toBe(64)
    })

    it('should create trigger with minimal fields', async () => {
      const body = {
        name: 'Minimal Trigger',
        description: '',
        botId: { id: 'bot_minimal' },
      }

      prisma.triggerIntegration.create.mockResolvedValue({
        id: 'trigger_minimal',
      })

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('trigger_minimal')
      expect(prisma.triggerIntegration.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_789',
          alias: undefined,
          name: 'Minimal Trigger',
          description: '',
          blueprintId: undefined,
          botId: 'bot_minimal',
          secret: expect.any(String),
          authenticate: true,
          schedule: undefined,
          timezone: undefined,
          sessionDuration: undefined,
          meta: undefined,
        },
        select: {
          id: true,
        },
      })
    })

    it('should normalize empty string timezone to null', async () => {
      const body = {
        name: 'Null Timezone Trigger',
        schedule: 'daily',
        timezone: '',
      }

      prisma.triggerIntegration.create.mockResolvedValue({
        id: 'trigger_null_timezone',
      })

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(getNext).toHaveBeenCalledWith('daily', {
        timezone: null,
      })
      expect(prisma.triggerIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: 'daily',
            timezone: null,
            nextTriggerAt: new Date('2030-02-02T00:00:00Z'),
          }),
        })
      )
    })

    it('should handle bot reference with id property', async () => {
      const body = {
        name: 'Bot Ref Trigger',
        botId: { id: 'bot_ref' },
      }

      prisma.triggerIntegration.create.mockResolvedValue({
        id: 'trigger_bot_ref',
      })

      await handler({}, mockSession, body)

      expect(prisma.triggerIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            botId: 'bot_ref',
          }),
        })
      )
    })

    it('should handle bot reference as string', async () => {
      const body = {
        name: 'Bot String Trigger',
        botId: 'bot_string',
      }

      prisma.triggerIntegration.create.mockResolvedValue({
        id: 'trigger_bot_string',
      })

      await handler({}, mockSession, body)

      expect(prisma.triggerIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            botId: 'bot_string',
          }),
        })
      )
    })

    it('should propagate database errors', async () => {
      const body = {
        name: 'Error Trigger',
        botId: { id: 'bot_error' },
      }

      const dbError = new Error('Database connection failed')

      prisma.triggerIntegration.create.mockRejectedValue(dbError)

      await expect(handler({}, mockSession, body)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle zero sessionDuration', async () => {
      const body = {
        name: 'Zero Session',
        botId: { id: 'bot_zero' },
        sessionDuration: 0,
      }

      prisma.triggerIntegration.create.mockResolvedValue({
        id: 'trigger_zero',
      })

      await handler({}, mockSession, body)

      expect(prisma.triggerIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionDuration: 0,
          }),
        })
      )
    })

    it('should handle null for optional numeric fields', async () => {
      const body = {
        name: 'Null Fields',
        botId: { id: 'bot_null' },
        sessionDuration: null,
      }

      prisma.triggerIntegration.create.mockResolvedValue({
        id: 'trigger_null',
      })

      await handler({}, mockSession, body)

      expect(prisma.triggerIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionDuration: null,
          }),
        })
      )
    })
  })

  describe('schedule validation', () => {
    it('should accept a cron expression in bodySchema schedule', async () => {
      const body = {
        name: 'Cron Trigger',
        schedule: '0 0 * * *',
      }

      await expect(
        bodySchema.validateAsync(body, {
          context: { session: mockSession },
        })
      ).resolves.toBeDefined()
    })

    it('should accept a complex cron expression in bodySchema schedule', async () => {
      const body = {
        name: 'Complex Cron',
        schedule: '*/15 * * * *',
      }

      await expect(
        bodySchema.validateAsync(body, {
          context: { session: mockSession },
        })
      ).resolves.toBeDefined()
    })

    it('should reject an invalid schedule string in bodySchema', async () => {
      const body = {
        name: 'Bad Schedule',
        schedule: 'not-valid-schedule',
      }

      await expect(
        bodySchema.validateAsync(body, {
          context: { session: mockSession },
        })
      ).rejects.toBeDefined()
    })
  })

  describe('nextTriggerAt computation', () => {
    it('should store nextTriggerAt when creating with an interval schedule', async () => {
      prisma.triggerIntegration.create.mockResolvedValue({
        id: 'trigger_scheduled',
      })

      const body = {
        name: 'Daily Trigger',
        schedule: 'daily',
      }

      await handler({}, mockSession, body)

      expect(prisma.triggerIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: 'daily',
            nextTriggerAt: new Date('2030-02-02T00:00:00Z'),
          }),
        })
      )
    })

    it('should store nextTriggerAt when creating with a cron schedule', async () => {
      prisma.triggerIntegration.create.mockResolvedValue({
        id: 'trigger_cron',
      })

      const body = {
        name: 'Cron Trigger',
        schedule: '0 9 * * MON',
      }

      await handler({}, mockSession, body)

      expect(prisma.triggerIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: '0 9 * * MON',
            nextTriggerAt: expect.any(Date),
          }),
        })
      )
    })

    it('should not set nextTriggerAt when creating without a schedule', async () => {
      prisma.triggerIntegration.create.mockResolvedValue({
        id: 'trigger_no_schedule',
      })

      const body = {
        name: 'No Schedule Trigger',
      }

      await handler({}, mockSession, body)

      const createCall = prisma.triggerIntegration.create.mock.calls[0][0]

      expect(createCall.data.nextTriggerAt).toBeUndefined()
    })

    it('should normalize empty string schedule to null', async () => {
      prisma.triggerIntegration.create.mockResolvedValue({
        id: 'trigger_empty_schedule',
      })

      const body = {
        name: 'No Schedule Trigger',
        schedule: '',
      }

      await handler({}, mockSession, body)

      expect(prisma.triggerIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: null,
          }),
        })
      )

      const createCall = prisma.triggerIntegration.create.mock.calls[0][0]

      expect(createCall.data.nextTriggerAt).toBeUndefined()
    })

    it('should clear nextTriggerAt when getNext returns a past date', async () => {
      prisma.triggerIntegration.create.mockResolvedValue({
        id: 'trigger_past_schedule',
      })

      const body = {
        name: 'Past Schedule Trigger',
        schedule: '2020-01-01T00:00:00Z',
      }

      await handler({}, mockSession, body)

      expect(prisma.triggerIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: '2020-01-01T00:00:00Z',
            nextTriggerAt: null,
          }),
        })
      )
    })
  })
})
