/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './update'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    task: {
      findUniqueByIdentifier: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/task.schedule', () => ({
  getNext: jest.fn((schedule) => {
    if (schedule === '2020-01-01T00:00:00Z') {
      return new Date('2020-01-01T00:00:00Z')
    }

    if (schedule === 'hourly') {
      return new Date('2030-01-01T12:00:00Z')
    }

    if (schedule === 'daily') {
      return new Date('2030-01-02T00:00:00Z')
    }

    return new Date('2030-01-01T10:00:00Z')
  }),
}))

jest.mock('@/lib/meta', () => {
  const actual = jest.requireActual('@/lib/meta')

  return {
    ...actual,
    getMeta: jest.fn(actual.getMeta),
  }
})

/* eslint-disable @typescript-eslint/no-require-imports */
const { getNext } = require('@/lib/task.schedule')
const { getMeta } = require('@/lib/meta')

describe('/api/v1/task/[taskId]/update', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should update task fields and return its id', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
        meta: null,
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.update.mockResolvedValue({ id: 'task_abc123' })

      const req = { query: { taskId: 'task_abc123' } }
      const body = {
        name: 'Updated Name',
        description: 'Updated description',
      }

      const result = await handler(req, mockSession, body)

      expect(result).toEqual({ status: 200, body: { id: 'task_abc123' } })
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_abc123' },
        data: expect.objectContaining({
          name: 'Updated Name',
          description: 'Updated description',
        }),
      })
    })

    it('should recalculate nextRunAt when schedule is provided', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
        meta: null,
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.update.mockResolvedValue({ id: 'task_abc123' })

      const req = { query: { taskId: 'task_abc123' } }
      const body = { schedule: 'daily' }

      await handler(req, mockSession, body)

      expect(getNext).toHaveBeenCalledWith('daily', { timezone: undefined })
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_abc123' },
        data: expect.objectContaining({
          schedule: 'daily',
          nextRunAt: new Date('2030-01-02T00:00:00Z'),
        }),
      })
    })

    it('should use the existing timezone when schedule changes without timezone input', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
        schedule: 'hourly',
        timezone: 'America/New_York',
        meta: null,
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.update.mockResolvedValue({ id: 'task_abc123' })

      const req = { query: { taskId: 'task_abc123' } }
      const body = { schedule: 'daily' }

      await handler(req, mockSession, body)

      expect(getNext).toHaveBeenCalledWith('daily', {
        timezone: 'America/New_York',
      })
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_abc123' },
        data: expect.objectContaining({
          schedule: 'daily',
          timezone: undefined,
          nextRunAt: new Date('2030-01-02T00:00:00Z'),
        }),
      })
    })

    it('should NOT set nextRunAt when schedule is not provided', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
        meta: null,
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.update.mockResolvedValue({ id: 'task_abc123' })

      const req = { query: { taskId: 'task_abc123' } }
      const body = { name: 'New Name' }

      await handler(req, mockSession, body)

      expect(getNext).not.toHaveBeenCalled()
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_abc123' },
        data: expect.not.objectContaining({ nextRunAt: expect.anything() }),
      })
    })

    it('should recalculate nextRunAt when timezone is provided without schedule', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
        schedule: '0 9 * * *',
        timezone: 'UTC',
        meta: null,
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.update.mockResolvedValue({ id: 'task_abc123' })

      const req = { query: { taskId: 'task_abc123' } }
      const body = { timezone: 'America/New_York' }

      await handler(req, mockSession, body)

      expect(getNext).toHaveBeenCalledWith('0 9 * * *', {
        timezone: 'America/New_York',
      })
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_abc123' },
        data: expect.objectContaining({
          timezone: 'America/New_York',
          nextRunAt: new Date('2030-01-01T10:00:00Z'),
        }),
      })
    })

    it('should normalize empty string timezone to null and recalculate nextRunAt', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
        schedule: '0 9 * * *',
        timezone: 'UTC',
        meta: null,
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.update.mockResolvedValue({ id: 'task_abc123' })

      const req = { query: { taskId: 'task_abc123' } }
      const body = { timezone: '' }

      await handler(req, mockSession, body)

      expect(getNext).toHaveBeenCalledWith('0 9 * * *', {
        timezone: null,
      })
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_abc123' },
        data: expect.objectContaining({
          timezone: null,
          nextRunAt: new Date('2030-01-01T10:00:00Z'),
        }),
      })
    })

    it('should clear nextRunAt when timezone changes but there is no existing schedule', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
        schedule: null,
        timezone: 'UTC',
        meta: null,
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.update.mockResolvedValue({ id: 'task_abc123' })

      const req = { query: { taskId: 'task_abc123' } }
      const body = { timezone: 'America/New_York' }

      await handler(req, mockSession, body)

      expect(getNext).not.toHaveBeenCalled()
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_abc123' },
        data: expect.objectContaining({
          timezone: 'America/New_York',
          nextRunAt: null,
        }),
      })
    })

    it('should clear nextRunAt when schedule is set to null', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
        schedule: 'daily',
        meta: null,
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.update.mockResolvedValue({ id: 'task_abc123' })

      const req = { query: { taskId: 'task_abc123' } }
      const body = { schedule: null }

      await handler(req, mockSession, body)

      expect(getNext).not.toHaveBeenCalled()
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_abc123' },
        data: expect.objectContaining({
          schedule: null,
          nextRunAt: null,
        }),
      })
    })

    it('should normalize empty string schedule to null', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
        schedule: 'daily',
        meta: null,
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.update.mockResolvedValue({ id: 'task_abc123' })

      const req = { query: { taskId: 'task_abc123' } }
      const body = { schedule: '' }

      await handler(req, mockSession, body)

      expect(getNext).not.toHaveBeenCalled()
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_abc123' },
        data: expect.objectContaining({
          schedule: null,
          nextRunAt: null,
        }),
      })
    })

    it('should clear nextRunAt when getNext returns a past date', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
        schedule: 'daily',
        meta: null,
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.update.mockResolvedValue({ id: 'task_abc123' })

      const req = { query: { taskId: 'task_abc123' } }
      const body = { schedule: '2020-01-01T00:00:00Z' }

      await handler(req, mockSession, body)

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_abc123' },
        data: expect.objectContaining({
          schedule: '2020-01-01T00:00:00Z',
          nextRunAt: null,
        }),
      })
    })

    it('should update resource links (contactId, botId)', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
        meta: null,
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.update.mockResolvedValue({ id: 'task_abc123' })

      const req = { query: { taskId: 'task_abc123' } }
      const body = {
        contactId: { id: 'contact_456' },
        botId: { id: 'bot_789' },
      }

      await handler(req, mockSession, body)

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_abc123' },
        data: expect.objectContaining({
          contactId: 'contact_456',
          botId: 'bot_789',
        }),
      })
    })

    it('should merge meta updates with existing metadata', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
        meta: { existing: true },
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.update.mockResolvedValue({ id: 'task_abc123' })

      const req = { query: { taskId: 'task_abc123' } }
      const body = {
        meta: {
          $update: {
            added: 'value',
          },
        },
      }

      await handler(req, mockSession, body)

      expect(getMeta).toHaveBeenCalledWith(body.meta, { existing: true })
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task_abc123' },
        data: expect.objectContaining({
          meta: { existing: true, added: 'value' },
        }),
      })
    })
  })

  describe('authorization', () => {
    it('should return 404 when task is not found', async () => {
      prisma.task.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { taskId: 'task_nonexistent' } }
      const body = { name: 'Updated' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(prisma.task.update).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the task', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'other_user_999',
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)

      const req = { query: { taskId: 'task_abc123' } }
      const body = { name: 'Updated' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(403)
      // Critical: must NOT update a task owned by another user
      expect(prisma.task.update).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should propagate database lookup errors', async () => {
      prisma.task.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB connection failed')
      )

      const req = { query: { taskId: 'task_abc123' } }

      await expect(handler(req, mockSession, {})).rejects.toThrow(
        'DB connection failed'
      )
      expect(prisma.task.update).not.toHaveBeenCalled()
    })

    it('should propagate database update errors', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
        meta: null,
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.update.mockRejectedValue(new Error('Update failed'))

      const req = { query: { taskId: 'task_abc123' } }

      await expect(handler(req, mockSession, {})).rejects.toThrow(
        'Update failed'
      )
    })
  })
})
