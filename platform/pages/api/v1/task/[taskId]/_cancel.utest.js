/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'
import { TaskOutcome, TaskStatus } from '@/prisma/types'

import { getNext } from '@/lib/task.schedule'

import handler from './cancel'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    task: {
      findUniqueByIdentifier: jest.fn(),
      updateMany: jest.fn(),
    },
    taskExecution: {
      updateMany: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({
  TaskStatus: {
    idle: 'idle',
    running: 'running',
    canceled: 'canceled',
  },
  TaskOutcome: {
    pending: 'pending',
    success: 'success',
    failure: 'failure',
  },
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

jest.mock('@/lib/task.schedule', () => ({
  getNext: jest.fn(),
}))

describe('/api/v1/task/[taskId]/cancel', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getNext.mockReturnValue(new Date('2027-01-01T00:00:00.000Z'))
  })

  it('should cancel running task executions and reset the task', async () => {
    const task = {
      id: 'task_abc123',
      userId: 'user_123',
      schedule: 'daily',
      timezone: 'America/New_York',
    }

    prisma.task.findUniqueByIdentifier.mockResolvedValue(task)
    prisma.taskExecution.updateMany.mockResolvedValue({ count: 1 })
    prisma.task.updateMany.mockResolvedValue({ count: 1 })

    const req = { query: { taskId: 'task_abc123' } }

    const result = await handler(req, mockSession)

    expect(getNext).toHaveBeenCalledWith('daily', {
      timezone: 'America/New_York',
    })

    expect(prisma.taskExecution.updateMany).toHaveBeenCalledWith({
      where: {
        taskId: 'task_abc123',
        userId: 'user_123',
        status: TaskStatus.running,
      },
      data: {
        status: TaskStatus.canceled,
        outcome: TaskOutcome.failure,
        completedAt: expect.any(Date),
        summary: 'Task execution canceled',
      },
    })

    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'task_abc123',
        status: TaskStatus.running,
      },
      data: {
        status: TaskStatus.idle,
        outcome: TaskOutcome.failure,
        nextRunAt: new Date('2027-01-01T00:00:00.000Z'),
      },
    })

    expect(result).toEqual({ status: 200, body: { id: 'task_abc123' } })
  })

  it('should return 404 when task is not found', async () => {
    prisma.task.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(
      { query: { taskId: 'task_missing' } },
      mockSession
    )

    expect(result.status).toBe(404)
    expect(prisma.taskExecution.updateMany).not.toHaveBeenCalled()
    expect(prisma.task.updateMany).not.toHaveBeenCalled()
  })

  it('should return 403 when task belongs to another user', async () => {
    prisma.task.findUniqueByIdentifier.mockResolvedValue({
      id: 'task_abc123',
      userId: 'other_user',
      schedule: null,
    })

    const result = await handler(
      { query: { taskId: 'task_abc123' } },
      mockSession
    )

    expect(result.status).toBe(403)
    expect(prisma.taskExecution.updateMany).not.toHaveBeenCalled()
    expect(prisma.task.updateMany).not.toHaveBeenCalled()
  })

  it('should set nextRunAt to null when getNext returns a past date', async () => {
    const task = {
      id: 'task_abc123',
      userId: 'user_123',
      schedule: 'daily',
      timezone: null,
    }

    // Mock getNext to return a date in the past
    getNext.mockReturnValue(new Date('2020-01-01T00:00:00.000Z'))

    prisma.task.findUniqueByIdentifier.mockResolvedValue(task)
    prisma.taskExecution.updateMany.mockResolvedValue({ count: 1 })
    prisma.task.updateMany.mockResolvedValue({ count: 1 })

    await handler({ query: { taskId: 'task_abc123' } }, mockSession)

    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nextRunAt: null,
        }),
      })
    )
  })

  it('should not call getNext and set nextRunAt to null when task has no schedule', async () => {
    const task = {
      id: 'task_abc123',
      userId: 'user_123',
      schedule: null,
      timezone: null,
    }

    prisma.task.findUniqueByIdentifier.mockResolvedValue(task)
    prisma.taskExecution.updateMany.mockResolvedValue({ count: 1 })
    prisma.task.updateMany.mockResolvedValue({ count: 1 })

    await handler({ query: { taskId: 'task_abc123' } }, mockSession)

    expect(getNext).not.toHaveBeenCalled()
    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nextRunAt: null,
        }),
      })
    )
  })

  it('should set nextRunAt to null when getNext returns null for a never schedule', async () => {
    const task = {
      id: 'task_abc123',
      userId: 'user_123',
      schedule: 'never',
      timezone: null,
    }

    // schedule is truthy so getNext is called, but returns null for 'never'
    getNext.mockReturnValue(null)

    prisma.task.findUniqueByIdentifier.mockResolvedValue(task)
    prisma.taskExecution.updateMany.mockResolvedValue({ count: 1 })
    prisma.task.updateMany.mockResolvedValue({ count: 1 })

    await handler({ query: { taskId: 'task_abc123' } }, mockSession)

    expect(getNext).toHaveBeenCalledWith('never', { timezone: null })
    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nextRunAt: null,
        }),
      })
    )
  })

  it('should still succeed when there are no running executions to cancel', async () => {
    const task = {
      id: 'task_abc123',
      userId: 'user_123',
      schedule: null,
      timezone: null,
    }

    prisma.task.findUniqueByIdentifier.mockResolvedValue(task)
    // updateMany returns count:0 meaning no running executions were found
    prisma.taskExecution.updateMany.mockResolvedValue({ count: 0 })
    prisma.task.updateMany.mockResolvedValue({ count: 0 })

    const result = await handler(
      { query: { taskId: 'task_abc123' } },
      mockSession
    )

    expect(result).toEqual({ status: 200, body: { id: 'task_abc123' } })
    // both updates are still called regardless of count
    expect(prisma.taskExecution.updateMany).toHaveBeenCalled()
    expect(prisma.task.updateMany).toHaveBeenCalled()
  })

  it('should look up the task with the select fields required for cancel logic', async () => {
    const task = {
      id: 'task_abc123',
      userId: 'user_123',
      schedule: null,
      timezone: null,
    }

    prisma.task.findUniqueByIdentifier.mockResolvedValue(task)
    prisma.taskExecution.updateMany.mockResolvedValue({ count: 1 })
    prisma.task.updateMany.mockResolvedValue({ count: 1 })

    await handler({ query: { taskId: 'task_abc123' } }, mockSession)

    expect(prisma.task.findUniqueByIdentifier).toHaveBeenCalledWith(
      mockSession.user,
      'task_abc123',
      {
        select: {
          id: true,
          userId: true,
          schedule: true,
          timezone: true,
        },
      }
    )
  })
})
