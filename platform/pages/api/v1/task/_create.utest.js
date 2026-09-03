/**
 * @jest-environment node
 */
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

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
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

    return new Date('2030-02-01T10:00:00Z')
  }),
}))

/* eslint-disable @typescript-eslint/no-require-imports */
const { getNext } = require('@/lib/task.schedule')

describe('POST /api/v1/task/create', () => {
  const mockSession = {
    user: {
      id: 'user_test123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should create a task with minimal required fields', async () => {
      const mockTask = {
        id: 'task_abc123',
      }

      prisma.task.create.mockResolvedValue(mockTask)

      const body = {
        name: 'Test Task',
        description: 'A test task',
        schedule: 'daily',
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('task_abc123')
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_test123',
          name: 'Test Task',
          description: 'A test task',
          contactId: undefined,
          botId: undefined,
          schedule: 'daily',
          timezone: undefined,
          nextRunAt: new Date('2030-02-02T00:00:00Z'),
          sessionDuration: undefined,
          meta: undefined,
        },
        select: {
          id: true,
        },
      })
    })

    it('should create a task with all optional fields', async () => {
      const mockTask = {
        id: 'task_full123',
      }

      prisma.task.create.mockResolvedValue(mockTask)

      const body = {
        name: 'Full Task',
        description: 'A task with all fields',
        contactId: { id: 'contact_abc456' },
        botId: { id: 'bot_xyz789' },
        schedule: 'hourly',
        timezone: 'America/New_York',
        sessionDuration: 1800000,
        meta: {
          priority: 'high',
        },
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('task_full123')
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_test123',
          name: 'Full Task',
          description: 'A task with all fields',
          contactId: 'contact_abc456',
          botId: 'bot_xyz789',
          schedule: 'hourly',
          timezone: 'America/New_York',
          nextRunAt: new Date('2030-02-01T12:00:00Z'),
          sessionDuration: 1800000,
          maxIterations: undefined,
          maxTime: undefined,
          meta: {
            priority: 'high',
          },
        },
        select: {
          id: true,
        },
      })
    })

    it('should create task without bot or contact', async () => {
      const mockTask = {
        id: 'task_standalone',
      }

      prisma.task.create.mockResolvedValue(mockTask)

      const body = {
        name: 'Standalone Task',
        description: 'Task without associations',
        schedule: 'hourly',
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            botId: undefined,
            contactId: undefined,
          }),
        })
      )
    })
  })

  describe('schedule types', () => {
    it('should handle predefined interval: hourly', async () => {
      const mockTask = {
        id: 'task_hourly',
      }

      prisma.task.create.mockResolvedValue(mockTask)

      const body = {
        name: 'Hourly Task',
        description: 'Runs every hour',
        schedule: 'hourly',
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: 'hourly',
            nextRunAt: new Date('2030-02-01T12:00:00Z'),
          }),
        })
      )
    })

    it('should handle predefined interval: daily', async () => {
      const mockTask = {
        id: 'task_daily',
      }

      prisma.task.create.mockResolvedValue(mockTask)

      const body = {
        name: 'Daily Task',
        description: 'Runs every day',
        schedule: 'daily',
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: 'daily',
            nextRunAt: new Date('2030-02-02T00:00:00Z'),
          }),
        })
      )
    })

    it('should handle predefined interval: weekly', async () => {
      const mockTask = {
        id: 'task_weekly',
      }

      prisma.task.create.mockResolvedValue(mockTask)

      const body = {
        name: 'Weekly Task',
        description: 'Runs every week',
        schedule: 'weekly',
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: 'weekly',
            nextRunAt: new Date('2030-02-08T00:00:00Z'),
          }),
        })
      )
    })

    it('should normalize empty string schedule to null', async () => {
      const mockTask = {
        id: 'task_empty_schedule',
      }

      prisma.task.create.mockResolvedValue(mockTask)

      const body = {
        name: 'No Schedule Task',
        description: 'Empty schedule should clear scheduling',
        schedule: '',
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: null,
          }),
        })
      )

      expect(prisma.task.create.mock.calls[0][0].data.nextRunAt).toBeUndefined()
    })

    it('should clear nextRunAt when getNext returns a past date', async () => {
      const mockTask = {
        id: 'task_past_schedule',
      }

      prisma.task.create.mockResolvedValue(mockTask)

      const body = {
        name: 'Past Schedule Task',
        description: 'Past schedules should not remain immediately due',
        schedule: '2020-01-01T00:00:00Z',
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: '2020-01-01T00:00:00Z',
            nextRunAt: null,
          }),
        })
      )
    })

    it('should normalize empty string timezone to null', async () => {
      const mockTask = {
        id: 'task_null_timezone',
      }

      prisma.task.create.mockResolvedValue(mockTask)

      const body = {
        name: 'Null Timezone Task',
        description: 'Timezone should be cleared',
        schedule: 'daily',
        timezone: '',
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(getNext).toHaveBeenCalledWith('daily', { timezone: null })
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: 'daily',
            timezone: null,
            nextRunAt: new Date('2030-02-02T00:00:00Z'),
          }),
        })
      )
    })
  })

  describe('session duration', () => {
    it('should handle sessionDuration at minimum (0)', async () => {
      const mockTask = {
        id: 'task_min_duration',
      }

      prisma.task.create.mockResolvedValue(mockTask)

      const body = {
        name: 'Min Duration Task',
        description: 'Immediate timeout',
        schedule: 'hourly',
        sessionDuration: 0,
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionDuration: 0,
          }),
        })
      )
    })

    it('should handle sessionDuration at maximum (1 hour)', async () => {
      const mockTask = {
        id: 'task_max_duration',
      }

      prisma.task.create.mockResolvedValue(mockTask)

      const body = {
        name: 'Max Duration Task',
        description: 'One hour timeout',
        schedule: 'daily',
        sessionDuration: 3600000,
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionDuration: 3600000,
          }),
        })
      )
    })

    it('should handle null sessionDuration', async () => {
      const mockTask = {
        id: 'task_null_duration',
      }

      prisma.task.create.mockResolvedValue(mockTask)

      const body = {
        name: 'Null Duration Task',
        description: 'No session duration',
        schedule: 'daily',
        sessionDuration: null,
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionDuration: null,
          }),
        })
      )
    })
  })

  describe('error handling', () => {
    it('should handle database errors', async () => {
      prisma.task.create.mockRejectedValue(new Error('Database error'))

      const body = {
        name: 'Test Task',
        description: 'This will fail',
        schedule: 'hourly',
      }

      await expect(handler({}, mockSession, body)).rejects.toThrow(
        'Database error'
      )
    })
  })

  describe('schema validation', () => {
    it('should validate bodySchema structure', () => {
      expect(bodySchema).toBeDefined()
      expect(bodySchema.describe).toBeDefined()
    })

    it('should define required fields', () => {
      const schema = bodySchema.describe()

      expect(schema.keys.name).toBeDefined()
      expect(schema.keys.description).toBeDefined()
      expect(schema.keys.schedule).toBeDefined()
    })

    it('should define optional configuration fields', () => {
      const schema = bodySchema.describe()

      expect(schema.keys.contactId).toBeDefined()
      expect(schema.keys.botId).toBeDefined()
      expect(schema.keys.timezone).toBeDefined()
      expect(schema.keys.sessionDuration).toBeDefined()
      expect(schema.keys.meta).toBeDefined()
    })
  })

  describe('response format', () => {
    it('should return only id in response', async () => {
      const mockTask = {
        id: 'task_resp123',
      }

      prisma.task.create.mockResolvedValue(mockTask)

      const body = {
        name: 'Test Task',
        description: 'Response test',
        schedule: 'hourly',
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(Object.keys(result.body)).toEqual(['id'])
      expect(result.body.id).toBe('task_resp123')
    })
  })
})
